const fs = require('fs');
const path = require('path');
const pdfmake = require('pdfmake');
const PdfPrinter = require('pdfmake/js/Printer').default;
const URLResolver = require('pdfmake/js/URLResolver').default;
const axios = require('axios');
const { getInvoiceDefinition } = require('./templates/invoice-pdf.template');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const { TaxEngine, TAX_TYPE } = require('./tax-engine.service');
const { CurrencyExchangeService } = require('./currency-exchange.service');
const log = createModuleLogger('InternalInvoiceService');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../../storage/invoices');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Logo URL
// Logo URL
const LOGO_URL = process.env.BRAND_LOGO_URL || 'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/brand-assets/brand-logo.png';

// pdfmake font configuration (using standard fonts)
const FONTS = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

class InternalInvoiceService {
    static LOGO_CACHE = new Map();
    static LOGO_CACHE_TTL = 3600000; // 1 hour
    static getCurrencySymbol(currency = 'INR') {
        if (currency === 'USD') return 'USD ';
        if (currency === 'EUR') return 'EUR ';
        if (currency === 'GBP') return 'GBP ';
        return currency === 'INR' ? 'Rs ' : `${currency} `;
    }

    static convertAmount(amount, rate = 1) {
        return ((Number(amount) || 0) * (Number(rate) || 1)).toFixed(2);
    }

    /**
     * Generate Internal GST Invoice for a Delivered Order
     */
    static async generateInvoice(order, options = {}) {
        log.operationStart('GENERATEInternalInvoice', { orderId: order.id });
        const startTime = Date.now();

        try {
            const isGstInvoice = this._isGstApplicable(order);
            const invoiceType = isGstInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY';
            const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

            const optimizedLogoUrl = this._getOptimizedLogoUrl(LOGO_URL);
            const logoDataUrl = await this._getLogoDataUri(optimizedLogoUrl, LOGO_URL);

            // Prepare Template Data
            const templateData = await this._prepareTemplateData(order, invoiceNumber, logoDataUrl, invoiceType, isGstInvoice);

            // Generate PDF
            const pdfBuffer = await this._generatePdf(templateData);

            // Storage strategy
            const strategy = (process.env.INVOICE_STORAGE_STRATEGY || 'BOTH').toUpperCase();
            const saveLocal = ['LOCAL', 'BOTH'].includes(strategy);
            const saveSupabase = ['SUPABASE', 'BOTH'].includes(strategy);

            const filename = `${invoiceNumber}.pdf`;
            let storagePath = null;
            let filePath = null;
            let publicUrl = null;

            if (saveLocal) {
                filePath = path.join(STORAGE_DIR, filename);
                fs.writeFileSync(filePath, pdfBuffer);
            }

            if (saveSupabase) {
                try {
                    storagePath = await this._uploadToStorage(filename, pdfBuffer);
                    // Note: publicUrl remains null for private bucket
                } catch (uploadError) {
                    log.warn('SUPABASE_UPLOAD_FAILED', 'Failed to upload to Supabase, but continuing because local copy exists', { error: uploadError.message });
                    // Proceeding without storagePath/publicUrl is acceptable if saveLocal was successful
                    if (!saveLocal) throw uploadError;
                }
            }

            // Persist Metadata (Skip for Events or if requested)
            let invoiceRecord = { id: null, file_path: filePath, public_url: publicUrl, storage_path: storagePath };

            if (!options.skipDb) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30);

                const { data: insertedRec, error } = await supabase
                    .from('invoices')
                    .insert({
                        order_id: order.id,
                        type: isGstInvoice ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY',
                        invoice_number: invoiceNumber,
                        file_path: filePath,
                        public_url: publicUrl,
                        storage_path: storagePath,
                        status: 'GENERATED',
                        generated_at: new Date().toISOString(),
                        expires_at: expiryDate.toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                invoiceRecord = insertedRec;
            }

            if (!invoiceRecord) {
                log.error('INVOICE_RECORD_NULL', 'Database returned null for inserted invoice record', { invoiceNumber });
                throw new Error('Failed to retrieve generated invoice record');
            }

            log.operationSuccess('GENERATE_INTERNAL_INVOICE', {
                invoiceId: invoiceRecord.id,
                path: filePath
            }, Date.now() - startTime);

            return {
                success: true,
                invoiceId: invoiceRecord.id || null,
                filePath: filePath || invoiceRecord?.file_path || null,
                invoiceNumber,
                publicUrl: publicUrl || invoiceRecord?.public_url || null
            };

        } catch (error) {
            log.operationError('GENERATE_INTERNAL_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    static _isGstApplicable(order) {
        const hasItemGst = order.items?.some(item => (item.gst_rate && item.gst_rate > 0));
        const hasDeliveryGst = (order.delivery_gst || 0) > 0;
        return hasItemGst || hasDeliveryGst;
    }

    // In-memory cache for static contact info
    static _contactCache = null;
    static _contactCacheTime = 0;
    static CACHE_TTL = 1000 * 60 * 60; // 1 hour

    static async _prepareTemplateData(order, invoiceNumber, logoDataUrl, invoiceType, isGstInvoice) {
        // Fetch Seller & Contact info (with caching)
        const now = Date.now();
        if (!this._contactCache || (now - this._contactCacheTime > this.CACHE_TTL)) {
            const [{ data: contactData }, { data: emailData }] = await Promise.all([
                supabase.from('contact_info').select('*').limit(1).single(),
                supabase.from('contact_emails').select('email').eq('is_primary', true).limit(1).single()
            ]);
            this._contactCache = { contactData, emailData };
            this._contactCacheTime = now;
        }

        const { contactData, emailData } = this._contactCache;

        const websiteUrl = process.env.FRONTEND_URL ?
            process.env.FRONTEND_URL.split(',')[0].trim().replace(/https?:\/\//, '').replace(/\/$/, '') :
            'merigaumata.in';

        const seller = {
            name: "OJHA TRADING COMPANY",
            address: {
                line1: contactData?.address_line1 || process.env.SELLER_ADDRESS_LINE1 || 'Default Address',
                line2: contactData?.address_line2 || process.env.SELLER_ADDRESS_LINE2 || '',
                city: contactData?.city || process.env.SELLER_CITY || 'Mumbai',
                state: contactData?.state || process.env.SELLER_STATE || 'Maharashtra',
                zip: contactData?.pincode || process.env.SELLER_ZIP || '400000'
            },
            email: emailData?.email || 'info@merigaumata.in',
            website: websiteUrl,
            gstin: process.env.SELLER_GSTIN || 'N/A',
            cin: process.env.SELLER_CIN || null,
            pan: process.env.SELLER_PAN || 'N/A'
        };

        // Address Normalization Helper
        const normalizeAddress = (addr) => {
            if (!addr) return null;
            return {
                line1: addr.address_line1 || addr.street_address || 'N/A',
                city: addr.city || 'N/A',
                state: addr.state || 'N/A',
                pincode: addr.pincode || addr.postal_code || addr.zip || 'N/A'
            };
        };

        const shippingAddr = normalizeAddress(order.shipping_address);
        const billingAddr = normalizeAddress(order.billing_address) || shippingAddr;

        const sellerStateCode = TaxEngine.getSellerStateCode();
        const buyerStateCode = TaxEngine.extractStateCodeFromAddress(order.shipping_address);
        const taxType = TaxEngine.determineTaxType(sellerStateCode, buyerStateCode);
        const isInterState = taxType === TAX_TYPE.INTER_STATE;

        const customerState = shippingAddr?.state || 'N/A';
        const sellerState = seller.address.state;
        const storedCurrency = [order.display_currency, order.currency, order.profiles?.preferred_currency]
            .find((value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase()));
        const displayCurrency = (storedCurrency || 'INR').trim().toUpperCase();
        
        let currencyRate = order.currency_rate || 1;

        // If no rate is stored or it's 1, but we need another currency, fetch it
        if ((!order.currency_rate || Number(order.currency_rate) === 1) && displayCurrency !== 'INR') {
            try {
                const currencyContext = await CurrencyExchangeService.getCurrencyContext('INR', displayCurrency);
                currencyRate = currencyContext.rate || 1;
            } catch (error) {
                log.warn('INVOICE_CURRENCY_FALLBACK', 'Failed to convert invoice currency, defaulting to INR values', {
                    orderId: order.id,
                    displayCurrency,
                    error: error.message
                });
            }
        }
        const currencySymbol = this.getCurrencySymbol(displayCurrency);

        const productItems = [];
        const deliveryItems = [];

        if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
            log.warn('ORDER_ITEMS_EMPTY', 'No items found in order object for invoice generation. Invoice will be empty.', { orderId: order.id });
        }

        (order.items || []).forEach((item) => {
            const quantity = item.quantity || 1;
            const amount = parseFloat(item.total_amount || 0);
            const taxable = parseFloat(item.taxable_amount || 0);
            const cgst = parseFloat(item.cgst || 0);
            const sgst = parseFloat(item.sgst || 0);
            const igst = parseFloat(item.igst || 0);

            const itemTax = amount - taxable;
            const itemGstRate = item.gst_rate || 0;

            productItems.push({
                index: productItems.length + 1,
                name: item.title || item.product?.title || item.product_snapshot?.title || item.name || 'Product',
                variant: item.variant_snapshot?.size_label || item.size_label || null,
                hsn_code: item.hsn_code || 'N/A',
                quantity,
                rate: quantity > 0 ? this.convertAmount(taxable / quantity, currencyRate) : "0.00",
                taxableValue: this.convertAmount(taxable, currencyRate),
                gstRate: itemGstRate,
                cgstAmount: this.convertAmount(isInterState ? 0 : (cgst || (itemTax / 2)), currencyRate),
                sgstAmount: this.convertAmount(isInterState ? 0 : (sgst || (itemTax / 2)), currencyRate),
                igstAmount: this.convertAmount(isInterState ? (igst || itemTax) : 0, currencyRate),
                totalAmount: this.convertAmount(amount, currencyRate),
                isGstApplicable: itemGstRate > 0
            });
        });

        // Delivery breakdown (Include ALL delivery charges: Product-specific + Global)
        let totalDeliveryCharge = 0;
        let totalDeliveryGst = 0;
        let deliveryGstRate = 0;

        (order.items || []).forEach(item => {
            totalDeliveryCharge += (item.delivery_charge || 0);
            totalDeliveryGst += (item.delivery_gst || 0);

            if ((item.delivery_gst || 0) > 0 && !deliveryGstRate) {
                // Determine rate from snapshot or fallback to 18
                deliveryGstRate = item.delivery_calculation_snapshot?.gst_rate || 18;
            }
        });

        // Add global delivery charges if they exist in the order summary but weren't fully mapped to items
        // (Though in modern orders they should be mapped, this is a safety fallback)
        const orderTotalDelivery = (order.delivery_charge || 0);
        const orderTotalDeliveryGst = (order.delivery_gst || 0);

        if (orderTotalDelivery > totalDeliveryCharge) {
            totalDeliveryCharge = orderTotalDelivery;
        }
        if (orderTotalDeliveryGst > totalDeliveryGst) {
            totalDeliveryGst = orderTotalDeliveryGst;
        }

        if (totalDeliveryCharge > 0 || totalDeliveryGst > 0) {
            deliveryItems.push({
                index: 1,
                name: 'Delivery and Handling Charges',
                hsn_code: '996812',
                quantity: 1,
                rate: this.convertAmount(totalDeliveryCharge, currencyRate),
                taxableValue: this.convertAmount(totalDeliveryCharge, currencyRate),
                gstRate: deliveryGstRate || 18,
                cgstAmount: this.convertAmount(isInterState ? 0 : totalDeliveryGst / 2, currencyRate),
                sgstAmount: this.convertAmount(isInterState ? 0 : totalDeliveryGst / 2, currencyRate),
                igstAmount: this.convertAmount(isInterState ? totalDeliveryGst : 0, currencyRate),
                totalAmount: this.convertAmount(totalDeliveryCharge + totalDeliveryGst, currencyRate),
                isGstApplicable: totalDeliveryGst > 0
            });
        }

        const buildInvoiceData = (invoiceItems, invNumber, title) => {
            let taxable = 0, cgst = 0, sgst = 0, igst = 0, total = 0;

            invoiceItems.forEach(item => {
                taxable += parseFloat(item.taxableValue);
                cgst += parseFloat(item.cgstAmount);
                sgst += parseFloat(item.sgstAmount);
                igst += parseFloat(item.igstAmount);
                total += parseFloat(item.totalAmount);
            });

            return {
                title,
                invoiceNumber: invNumber,
                invoiceDate: new Date(order.created_at || Date.now()).toLocaleDateString('en-IN'),
                placeOfSupply: `${customerState}`,
                orderNumber: order.order_number,
                orderDate: new Date(order.created_at || Date.now()).toLocaleDateString('en-IN'),
                logoDataUrl,
                seller,
                customer: {
                    name: order.customer_name || 'Valued Customer',
                    billing_address: billingAddr,
                    shipping_address: shippingAddr,
                    phone: order.customer_phone || shippingAddr?.phone || 'N/A'
                },
                currency: displayCurrency,
                currencySymbol,
                items: invoiceItems,
                isInterState,
                summary: {
                    taxableAmount: taxable.toFixed(2),
                    totalCgst: cgst.toFixed(2),
                    totalSgst: sgst.toFixed(2),
                    totalIgst: igst.toFixed(2),
                    grandTotal: total.toFixed(2)
                },
                amountInWords: this._amountToWords(Number(total.toFixed(2)), displayCurrency)
            };
        };

        const allInvoiceItems = [...productItems];
        if (deliveryItems.length > 0) {
            deliveryItems.forEach((item, index) => {
                allInvoiceItems.push({
                    ...item,
                    index: productItems.length + index + 1
                });
            });
        }

        const productInvoice = buildInvoiceData(productItems, invoiceNumber, 'TAX INVOICE');
        const deliveryInvoice = deliveryItems.length > 0 
            ? buildInvoiceData(deliveryItems, invoiceNumber, 'TAX INVOICE')
            : null;

        return {
            productInvoice,
            deliveryInvoice,
            isDual: !!deliveryInvoice
        };
    }

    static async _generatePdf(data) {
        try {
            log.info('Generating PDF internally using pdfmake...');
            
            // 1. Fetch logo and convert to data URL if not already one
            const logoUrl = data.productInvoice?.logoDataUrl || data.deliveryInvoice?.logoDataUrl;
            
            if (logoUrl) {
                log.info('Logo Buffer prepared for template', { bytes: logoUrl.length });
            } else {
                log.warn('No logoBuffer provided in template data');
            }

            // 2. Get document definition
            const docDefinition = getInvoiceDefinition(data);

            // 3. Set default font and images dictionary
            docDefinition.defaultStyle = {
                font: 'Helvetica'
            };

            // Add images dictionary for deduplication
            if (logoUrl) {
                docDefinition.images = {
                    brand_logo: logoUrl
                };
            }

            // 4. Create Printer and generate PDF
            log.info('Initializing PdfPrinter...');
            const printer = new PdfPrinter(FONTS, pdfmake.virtualfs, new URLResolver(pdfmake.virtualfs));
            
            log.info('Starting createPdfKitDocument (async)...');
            const pdfDoc = await printer.createPdfKitDocument(docDefinition);
            log.info('PdfKitDocument created successfully');
            
            return new Promise((resolve, reject) => {
                const chunks = [];
                log.info('Streaming PDF chunks...');
                pdfDoc.on('data', (chunk) => chunks.push(chunk));
                pdfDoc.on('end', () => {
                    const resultBuffer = Buffer.concat(chunks);
                    log.info('PDF stream ended', { totalBytes: resultBuffer.length });
                    resolve(resultBuffer);
                });
                pdfDoc.on('error', (err) => {
                    log.error('PDF stream error', { error: err.message });
                    reject(err);
                });
                pdfDoc.end();
            });

        } catch (error) {
            log.operationError('PDF_GENERATION_INTERNAL', error);
            throw error;
        }
    }

    /**
     * Convert standard Supabase object URL to optimized render URL
     */
    static _getOptimizedLogoUrl(url, width = 400) {
        if (!url || !url.includes('supabase.co')) return url;
        
        // Handle conversion from /object/public/ to /render/image/public/
        if (url.includes('/storage/v1/object/public/')) {
            const optimized = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
            return `${optimized}?width=${width}&resize=contain&quality=80`;
        }
        
        return url;
    }

    static async _getLogoDataUri(url, fallbackUrl = null) {
        if (!url) return null;

        const now = Date.now();
        const cached = this.LOGO_CACHE.get(url);

        if (cached && (now - cached.timestamp < this.LOGO_CACHE_TTL)) {
            log.info('Logo Cache Hit', { url });
            return cached.dataUri;
        }

        try {
            log.info('Downloading logo from external URL', { url });
            const response = await axios.get(url, { 
                responseType: 'arraybuffer', 
                timeout: 10000,
                headers: { 'Accept': 'image/*' }
            });
            
            const contentType = response.headers['content-type'] || 'image/png';
            const base64 = Buffer.from(response.data).toString('base64');
            const dataUri = `data:${contentType};base64,${base64}`;
            
            log.info('Logo download and conversion successful', { bytes: response.data.length, dataUriLength: dataUri.length });

            this.LOGO_CACHE.set(url, {
                dataUri,
                timestamp: now
            });

            return dataUri;
        } catch (error) {
            // FALLBACK LOGIC: If optimized URL fails (e.g. 403 Forbidden), try the original
            if (fallbackUrl && fallbackUrl !== url && (error.response?.status === 403 || error.response?.status === 404)) {
                log.warn('LOGO_OPTIMIZATION_FAILED', 'Supabase transformation failed (403/404), falling back to original...', { 
                    url, 
                    fallbackUrl,
                    status: error.response?.status
                });
                return this._getLogoDataUri(fallbackUrl, null); // Call recursively once with fallback
            }

            log.warn('LOGO_FETCH_FAILED', 'Failed to fetch logo for invoice, proceeding without logo', { 
                url, 
                error: error.message
            });
            return null;
        }
    }

    static async _uploadToStorage(filename, fileBuffer) {
        try {
            const bucketName = 'invoices';
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filename, fileBuffer, { contentType: 'application/pdf', upsert: true });

            if (uploadError) {
                // If it failed because the bucket doesn't exist, try creating it
                if (uploadError.message && (uploadError.message.includes('bucket') || uploadError.message.includes('not found') || uploadError.name === 'storage/object-not-found')) {
                    log.info('Attempting to create missing invoices bucket...');
                    const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
                        public: false // Internal invoices should be private
                    });

                    if (!createBucketError || createBucketError.message.includes('already exists')) {
                        // Retry upload after bucket creation
                        const { error: retryError } = await supabase.storage
                            .from(bucketName)
                            .upload(filename, fileBuffer, { contentType: 'application/pdf', upsert: true });
                        if (retryError) throw retryError;
                        return filename;
                    }
                }
                throw uploadError;
            }

            // Bucket is private, return the path/filename for storage_path column
            return filename;
        } catch (error) {
            log.operationError('UPLOAD_STORAGE_FAIL', error);
            // Throw so the orchestrator knows it failed and doesn't create a broken record.
            throw error;
        }
    }

    static _amountToWords(amount, currency = 'INR') {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const numToWords = (num) => {
            if ((num = num.toString()).length > 9) return 'overflow';
            const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return;
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
            return str;
        };

        const parts = amount.toFixed(2).split('.');
        const majorUnit = currency === 'USD' ? 'Dollars' : currency === 'EUR' ? 'Euros' : currency === 'GBP' ? 'Pounds' : 'Rupees';
        const minorUnit = currency === 'USD' ? 'Cents' : currency === 'EUR' ? 'Cents' : currency === 'GBP' ? 'Pence' : 'Paise';

        let output = numToWords(Number(parts[0])) + majorUnit;
        if (Number(parts[1]) > 0) {
            output += ' and ' + numToWords(Number(parts[1])) + minorUnit;
        }
        return output + ' Only';
    }
}

module.exports = InternalInvoiceService;
