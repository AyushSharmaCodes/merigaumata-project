const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake/js/Printer').default;
const virtualfs = require('pdfmake/js/virtual-fs').default;
const URLResolver = require('pdfmake/js/URLResolver').default;
const axios = require('axios');
const { getInvoiceDefinition } = require('./templates/invoice-pdf.template');
const supabase = require('../config/supabase');

const logger = require('../utils/logger');
const InvoiceMessages = require('../constants/messages/InvoiceMessages');
const { createModuleLogger } = require('../utils/logging-standards');
const { CurrencyExchangeService } = require('./currency-exchange.service');
const { BUCKET_MAP } = require('./storage-asset.service');

const log = createModuleLogger('CustomInvoiceService');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../../storage/invoices');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Logo URL
// Logo URL
const LOGO_URL = process.env.BRAND_LOGO_URL || '';

// pdfmake font configuration
const FONTS = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

class CustomInvoiceService {
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
     * Generate Custom Invoice for a Delivered Order
     * @param {string} orderId - ID of the order
     * @param {string} forcedType - 'TAX_INVOICE' or 'BILL_OF_SUPPLY'
     */
    static async generateCustomInvoice(orderId, forcedType) {
        log.operationStart('GENERATECustomInvoice', { orderId, forcedType });
        const startTime = Date.now();

        try {
            // 1. Fetch full order details
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select(`*, items:order_items(*), profiles(preferred_currency)`)
                .eq('id', orderId)
                .single();

            if (fetchError || !order) throw new Error(InvoiceMessages.ORDER_NOT_FOUND);

            // 2. Validate Status
            if (order.status !== 'delivered') {
                throw new Error(InvoiceMessages.DELIVERED_ONLY);
            }

            // 3. Determine Invoice Title
            const isGstInvoice = forcedType === 'TAX_INVOICE';
            const invoiceTypeDisplay = isGstInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY';

            // 4. Generate Invoice Number
            const year = new Date().getFullYear();
            const prefix = isGstInvoice ? 'GST' : 'BOS';
            const invoiceNumber = `${prefix}-${year}-${Date.now().toString().slice(-6)}`;
            const logoBuffer = await this._getLogoBuffer(LOGO_URL, LOGO_URL);
            const logoDataUrl = logoBuffer ? `data:image/png;base64,${logoBuffer.toString('base64')}` : null;
            const templateData = await this._prepareTemplateData(order, invoiceNumber, logoDataUrl, invoiceTypeDisplay, isGstInvoice);

            // 6. Generate PDF
            const pdfBuffer = await this._generatePdf(templateData, logoBuffer);

            // 7. Storage Strategy Handler
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
                } catch (uploadError) {
                    log.warn('SUPABASE_UPLOAD_FAILED', 'Failed to upload custom invoice to Supabase, but continuing because local copy exists', { error: uploadError.message });
                    if (!saveLocal) throw uploadError;
                }
            }

            // 8. Persist Metadata in DB
            const { data: invoiceRecord, error: dbError } = await supabase
                .from('invoices')
                .insert({
                    order_id: order.id,
                    type: forcedType,
                    invoice_number: invoiceNumber,
                    public_url: publicUrl,
                    storage_path: storagePath,
                    status: 'GENERATED'
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // 9. Update Order to point to this as the latest official invoice
            await supabase.from('orders').update({
                invoice_id: invoiceRecord.id,
                invoice_status: 'generated',
                invoice_url: `/api/invoices/${invoiceRecord.id}/download`
            }).eq('id', orderId);

            log.operationSuccess('GENERATE_CUSTOM_INVOICE', {
                invoiceId: invoiceRecord.id,
                invoiceNumber
            }, Date.now() - startTime);

            return {
                success: true,
                invoiceId: invoiceRecord.id,
                invoiceNumber,
                publicUrl: invoiceRecord.public_url,
                filePath: filePath || null
            };

        } catch (error) {
            log.operationError('GENERATE_CUSTOM_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    // --- Template & PDF Logic (Borrowed from InternalInvoiceService) ---

    static async _prepareTemplateData(order, invoiceNumber, hasLogo, invoiceType, isGstInvoice) {
        // ... (Same logic as InternalInvoiceService._prepareTemplateData)
        // I will copy it here to ensure it works independently and allow customization for Bill of Supply if needed
        const seller = {
            name: process.env.SELLER_NAME || process.env.SMTP_FROM_NAME || 'Meri Gau Mata',
            address: {
                line1: process.env.SELLER_ADDRESS_LINE1 || 'Default Address',
                city: process.env.SELLER_CITY || 'Mumbai',
                state: process.env.SELLER_STATE || 'Maharashtra',
                zip: process.env.SELLER_ZIP || '400000'
            },
            gstin: process.env.SELLER_GSTIN || 'URP',
            pan: process.env.SELLER_PAN || 'N/A',
            city: process.env.SELLER_CITY || 'Mumbai'
        };

        const customerState = String(order.shipping_address?.state || 'Maharashtra');
        const sellerState = String(seller.address.state || 'Maharashtra');
        const isInterState = !customerState.toLowerCase().includes(sellerState.toLowerCase());

        const normalizeAddress = (addr) => {
            if (!addr) return null;

            return {
                full_name: addr.full_name || addr.name || order.customer_name || 'Valued Customer',
                line1: addr.address_line1 || addr.addressLine1 || addr.street_address || addr.line1 || 'N/A',
                line2: addr.address_line2 || addr.addressLine2 || addr.apartment || addr.line2 || null,
                city: addr.city || 'N/A',
                state: addr.state || 'N/A',
                zip: addr.postal_code || addr.postalCode || addr.pincode || addr.zip || 'N/A',
                country: addr.country || 'India',
                phone: addr.phone || order.customer_phone || 'N/A'
            };
        };

        const shippingAddress = normalizeAddress(order.shipping_address || order.shippingAddress);
        const billingAddress = normalizeAddress(order.billing_address || order.billingAddress) || shippingAddress;

        const storedCurrency = [order.display_currency, order.currency, order.profiles?.preferred_currency]
            .find((value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase()));
        const displayCurrency = (storedCurrency || 'INR').trim().toUpperCase();

        let currencyRate = order.currency_rate || 1;

        // Fetch conversion rate if we need a non-INR currency and no stored rate is available
        if ((!order.currency_rate || Number(order.currency_rate) === 1) && displayCurrency !== 'INR') {
            try {
                const currencyContext = await CurrencyExchangeService.getCurrencyContext('INR', displayCurrency);
                currencyRate = currencyContext.rate || 1;
            } catch (error) {
                log.warn('INVOICE_CURRENCY_FALLBACK', 'Failed to convert custom invoice currency, defaulting to INR values', {
                    orderId: order.id,
                    displayCurrency,
                    error: error.message
                });
            }
        }

        const currencySymbol = this.getCurrencySymbol(displayCurrency);

        let grandTotal = 0;
        let totalTaxable = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        const items = order.items.map((item, index) => {
            const quantity = item.quantity || 1;
            const amount = parseFloat(item.total_amount || 0);
            const taxable = parseFloat(item.taxable_amount || 0);
            const cgst = parseFloat(item.cgst || 0);
            const sgst = parseFloat(item.sgst || 0);
            const igst = parseFloat(item.igst || 0);

            totalTaxable += taxable * currencyRate;
            totalCgst += cgst * currencyRate;
            totalSgst += sgst * currencyRate;
            totalIgst += igst * currencyRate;
            grandTotal += amount * currencyRate;

            const rate = quantity > 0 ? this.convertAmount(taxable / quantity, currencyRate) : "0.00";

            return {
                index: index + 1,
                name: item.title || item.product?.title || 'Product',
                variant: item.variant_snapshot?.size_label || item.size_label || null,
                hsn_code: item.hsn_code || 'N/A',
                quantity,
                rate,
                taxableValue: this.convertAmount(taxable, currencyRate),
                gstRate: item.gst_rate || 0,
                cgstAmount: this.convertAmount(cgst, currencyRate),
                sgstAmount: this.convertAmount(sgst, currencyRate),
                igstAmount: this.convertAmount(igst, currencyRate),
                totalAmount: this.convertAmount(amount, currencyRate)
            };
        });

        const deliveryBase = Number(order.delivery_charge) || 0;
        const deliveryGst = Number(order.delivery_gst) || 0;
        let refundableDeliveryCharge = null;
        let nonRefundableDeliveryCharge = null;

        if (deliveryBase > 0 || deliveryGst > 0) {
            grandTotal += (deliveryBase + deliveryGst) * currencyRate;
            if (isInterState) {
                totalIgst += deliveryGst * currencyRate;
            } else {
                totalCgst += (deliveryGst / 2) * currencyRate;
                totalSgst += (deliveryGst / 2) * currencyRate;
            }

            const refundableDeliveryBase = order.items.reduce((sum, item) => {
                const snapshot = item.delivery_calculation_snapshot || {};
                if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                    return sum + (Number(item.delivery_charge) || 0);
                }
                return sum;
            }, 0);

            const nonRefundableDeliveryBase = Math.max(0, deliveryBase - refundableDeliveryBase);
            if (refundableDeliveryBase > 0) refundableDeliveryCharge = this.convertAmount(refundableDeliveryBase, currencyRate);
            if (nonRefundableDeliveryBase > 0) nonRefundableDeliveryCharge = this.convertAmount(nonRefundableDeliveryBase, currencyRate);
        }

        const invoiceData = {
            title: invoiceType,
            invoiceType,
            invoiceNumber,
            invoiceDate: new Date().toLocaleDateString('en-IN'),
            placeOfSupply: `${customerState} (${isInterState ? 'Inter-State' : 'Intra-State'})`,
            orderNumber: order.order_number,
            orderDate: new Date(order.created_at || Date.now()).toLocaleString('en-IN', { 
                day: 'numeric', month: 'short', year: 'numeric', 
                hour: 'numeric', minute: 'numeric', hour12: true 
            }),
            logoDataUrl: hasLogo,
            seller,
            customer: {
                name: order.customer_name || 'Valued Customer',
                billing_address: billingAddress,
                shipping_address: shippingAddress,
                phone: billingAddress?.phone || shippingAddress?.phone || order.customer_phone || 'N/A',
                gstin: order.customer_gstin || null
            },
            currency: displayCurrency,
            currencySymbol,
            items,
            isGstInvoice,
            isInterState,
            summary: {
                taxableAmount: totalTaxable.toFixed(2),
                totalCgst: totalCgst.toFixed(2),
                totalSgst: totalSgst.toFixed(2),
                totalIgst: totalIgst.toFixed(2),
                deliveryCharge: deliveryBase > 0 ? this.convertAmount(deliveryBase, currencyRate) : null,
                refundableDeliveryCharge,
                nonRefundableDeliveryCharge,
                grandTotal: grandTotal.toFixed(2)
            },
            amountInWords: this._amountToWords(grandTotal, displayCurrency)
        };

        return {
            productInvoice: invoiceData,
            deliveryInvoice: null,
            isDual: false
        };
    }

    static async _generatePdf(data, logoBuffer = null) {
        try {
            // 1. Get document definition
            const docDefinition = getInvoiceDefinition(data);
 
            // 2. Set default font
            docDefinition.defaultStyle = {
                font: 'Helvetica'
            };
 
            // Add images dictionary for deduplication
            if (logoBuffer) {
                const base64Logo = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                docDefinition.images = {
                    brand_logo: base64Logo
                };
            }

            // 5. Create Printer and generate PDF
            const printer = new PdfPrinter(FONTS, virtualfs, new URLResolver(virtualfs));
            const pdfDoc = await printer.createPdfKitDocument(docDefinition);
            
            return new Promise((resolve, reject) => {
                const chunks = [];
                pdfDoc.on('data', (chunk) => chunks.push(chunk));
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.on('error', (err) => reject(err));
                pdfDoc.end();
            });

        } catch (error) {
            log.operationError('PDF_GENERATION_CUSTOM_INTERNAL', error);
            throw error;
        }
    }

    /**
     * Convert standard Supabase object URL to optimized render URL
     */
    static _getOptimizedLogoUrl(url, width = 400) {
        // Supabase Free Plan does not support /render/ transformation.
        // We now recommend using the original URL directly for compatibility.
        return url;
    }

    static async _getLogoBuffer(url, fallbackUrl = null) {
        if (!url) return null;

        const now = Date.now();
        const cached = this.LOGO_CACHE.get(url);

        if (cached && (now - cached.timestamp < this.LOGO_CACHE_TTL)) {
            log.info('Logo Cache Hit (Custom)', { url });
            return cached.buffer;
        }

        try {
            log.info('Downloading logo for custom invoice', { url });
            const response = await axios.get(url, { 
                responseType: 'arraybuffer', 
                timeout: 10000,
                headers: { 'Accept': 'image/*' }
            });
            
            const buffer = Buffer.from(response.data);
            
            // MAGIC BYTE CHECK: pdfmake/pdfkit does NOT support WebP on server-side.
            // WebP files start with 'RIFF' (hex: 52 49 46 46)
            if (buffer.length > 4 && 
                buffer[0] === 0x52 && buffer[1] === 0x49 && 
                buffer[2] === 0x46 && buffer[3] === 0x46) {
                log.warn('INCOMPATIBLE_LOGO_FORMAT', 'Logo is a WebP file (RIFF header detected). Skipping logo to prevent server crash. Please upload a real PNG/JPEG.', { url });
                return null;
            }

            log.info('Logo download successful', { bytes: buffer.length });

            this.LOGO_CACHE.set(url, {
                buffer,
                timestamp: now
            });

            return buffer;
        } catch (error) {
            // FALLBACK LOGIC: If optimized URL fails (e.g. 403 Forbidden), try the original
            if (fallbackUrl && fallbackUrl !== url && (error.response?.status === 403 || error.response?.status === 404)) {
                log.warn('LOGO_OPTIMIZATION_FAILED_CUSTOM', 'Supabase transformation failed (403/404), falling back to original...', { 
                    url, 
                    fallbackUrl,
                    status: error.response?.status
                });
                return this._getLogoBuffer(fallbackUrl, null); // Call recursively once with fallback
            }

            log.warn('LOGO_FETCH_FAILED', 'Failed to fetch logo for custom invoice, proceeding without logo', { 
                url, 
                error: error.message
            });
            return null;
        }
    }

    static async _uploadToStorage(filename, fileBuffer) {
        try {
            const bucketName = BUCKET_MAP.invoice;
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filename, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Bucket is private, return filename as storagePath
            return filename;

        } catch (error) {
            log.operationError('UPLOAD_STORAGE_FAIL', error);
            return null;
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

module.exports = CustomInvoiceService;
