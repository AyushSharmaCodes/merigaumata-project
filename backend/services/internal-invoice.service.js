const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const { TaxEngine, TAX_TYPE } = require('./tax-engine.service');
const log = createModuleLogger('InternalInvoiceService');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../../storage/invoices');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Logo path
const LOGO_PATH = path.join(__dirname, '../../frontend/public/favicon.ico');

class InternalInvoiceService {

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

            // Prepare Template Data
            const templateData = await this._prepareTemplateData(order, invoiceNumber, invoiceType, isGstInvoice);

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
                storagePath = await this._uploadToStorage(filename, pdfBuffer);
                // Note: publicUrl remains null for private bucket
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

            log.operationSuccess('GENERATE_INTERNAL_INVOICE', {
                invoiceId: invoiceRecord.id,
                path: filePath
            }, Date.now() - startTime);

            return {
                success: true,
                invoiceId: invoiceRecord.id,
                filePath: filePath || invoiceRecord.file_path,
                invoiceNumber,
                publicUrl: publicUrl || invoiceRecord.public_url
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

    static async _prepareTemplateData(order, invoiceNumber, invoiceType, isGstInvoice) {
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

        let logoDataUrl = '';
        try {
            if (fs.existsSync(LOGO_PATH)) {
                const logoBuffer = fs.readFileSync(LOGO_PATH);
                logoDataUrl = `data:image/x-icon;base64,${logoBuffer.toString('base64')}`;
            }
        } catch (e) { log.warn('Failed to load logo', e); }

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
                rate: quantity > 0 ? (taxable / quantity).toFixed(2) : "0.00",
                taxableValue: taxable.toFixed(2),
                gstRate: itemGstRate,
                cgstAmount: (isInterState ? 0 : (cgst || (itemTax / 2))).toFixed(2),
                sgstAmount: (isInterState ? 0 : (sgst || (itemTax / 2))).toFixed(2),
                igstAmount: (isInterState ? (igst || itemTax) : 0).toFixed(2),
                totalAmount: amount.toFixed(2),
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
                rate: totalDeliveryCharge.toFixed(2),
                taxableValue: totalDeliveryCharge.toFixed(2),
                gstRate: deliveryGstRate || 18,
                cgstAmount: (isInterState ? 0 : totalDeliveryGst / 2).toFixed(2),
                sgstAmount: (isInterState ? 0 : totalDeliveryGst / 2).toFixed(2),
                igstAmount: (isInterState ? totalDeliveryGst : 0).toFixed(2),
                totalAmount: (totalDeliveryCharge + totalDeliveryGst).toFixed(2),
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
                items: invoiceItems,
                isInterState,
                summary: {
                    taxableAmount: taxable.toFixed(2),
                    totalCgst: cgst.toFixed(2),
                    totalSgst: sgst.toFixed(2),
                    totalIgst: igst.toFixed(2),
                    grandTotal: total.toFixed(2)
                },
                amountInWords: this._amountToWords(total)
            };
        };

        const productInvoice = buildInvoiceData(productItems, invoiceNumber, 'Tax Invoice');
        const deliveryInvoice = deliveryItems.length > 0 ?
            buildInvoiceData(deliveryItems, invoiceNumber + '-D', 'Tax Invoice') : null;

        return {
            productInvoice,
            deliveryInvoice,
            isDual: !!deliveryInvoice
        };
    }

    static async _generatePdf(data) {
        let browser;
        try {
            log.info('Launching Puppeteer for invoice generation...');
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            log.info('Puppeteer launched successfully');

            const page = await browser.newPage();

            const renderInvoiceHtml = (invoice) => `
            <div class="invoice-page">
              <div class="header">
                <div class="header-left">
                    <img src="${invoice.logoDataUrl}" class="logo" />
                    <div class="company-info">
                        <h3>Sold By: ${invoice.seller.name}</h3>
                        <p><strong>Ship-from Address:</strong> ${invoice.seller.address.line1}, ${invoice.seller.address.line2 ? invoice.seller.address.line2 + ', ' : ''}${invoice.seller.address.city}, ${invoice.seller.address.state} - ${invoice.seller.address.zip}</p>
                        <p><strong>GSTIN -</strong> ${invoice.seller.gstin}</p>
                        ${invoice.seller.cin ? `<p><strong>CIN:</strong> ${invoice.seller.cin}</p>` : ''}
                    </div>
                </div>
                <div class="header-right">
                    <div class="tax-invoice-label">${invoice.title || 'TAX INVOICE'}</div>
                    <div class="invoice-num-box">
                        Invoice Number #<br>${invoice.invoiceNumber}
                    </div>
                </div>
              </div>

              <div class="address-section">
                <div class="order-info">
                    <p><strong>Order ID:</strong> ${invoice.orderNumber}</p>
                    <p><strong>Order Date:</strong> ${invoice.orderDate}</p>
                    <p><strong>Invoice Date:</strong> ${invoice.invoiceDate}</p>
                </div>
                <div class="billing-address">
                    <h4>Billing Address</h4>
                    <p>${invoice.customer.name}</p>
                    <p>${invoice.customer.billing_address?.line1 || 'N/A'}</p>
                    <p>${invoice.customer.billing_address?.city || ''} ${invoice.customer.billing_address?.pincode || ''} ${invoice.customer.billing_address?.state || ''}</p>
                    <p>Phone: ${invoice.customer.phone}</p>
                </div>
                <div class="shipping-address">
                    <h4>Ship To</h4>
                    <p>${invoice.customer.name}</p>
                    <p>${invoice.customer.shipping_address?.line1 || 'N/A'}</p>
                    <p>${invoice.customer.shipping_address?.city || ''} ${invoice.customer.shipping_address?.pincode || ''} ${invoice.customer.shipping_address?.state || ''}</p>
                    <p>Phone: ${invoice.customer.phone}</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 40%">Description</th>
                    <th style="width: 5%; text-align: center;">Qty</th>
                    <th style="width: 10%; text-align: right;">Rate ₹</th>
                    <th style="width: 10%; text-align: right;">Taxable value ₹</th>
                    ${invoice.isInterState ?
                    `<th style="width: 12%; text-align: right;">IGST ₹</th>` :
                    `<th style="width: 10%; text-align: right;">CGST ₹</th><th style="width: 10%; text-align: right;">SGST ₹</th>`
                }
                    <th style="width: 13%; text-align: right;">Total ₹</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoice.items.map(item => `
                  <tr>
                    <td>
                        <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px;">${item.name}</div>
                        ${item.variant ? `<div style="font-size: 11px; color: #444; margin-bottom: 2px;">Variant: ${item.variant}</div>` : ''}
                        <div style="font-size: 10px; color: #777;">
                            HSN: ${item.hsn_code} 
                            ${item.isGstApplicable ? `| GST: ${item.gstRate}%` : ''}
                        </div>
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${item.rate}</td>
                    <td style="text-align: right;">${item.taxableValue}</td>
                    ${invoice.isInterState ?
                        `<td style="text-align: right;">${item.igstAmount}</td>` :
                        `<td style="text-align: right;">${item.cgstAmount}</td><td style="text-align: right;">${item.sgstAmount}</td>`
                    }
                    <td style="text-align: right;">${item.totalAmount}</td>
                  </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td>Total</td>
                        <td style="text-align: center;">${invoice.items.reduce((acc, curr) => acc + curr.quantity, 0)}</td>
                    <td style="text-align: right;">-</td>
                    <td style="text-align: right;">${invoice.summary.taxableAmount}</td>
                        ${invoice.isInterState ?
                    `<td style="text-align: right;">${invoice.summary.totalIgst}</td>` :
                    `<td style="text-align: right;">${invoice.summary.totalCgst}</td><td style="text-align: right;">${invoice.summary.totalSgst}</td>`
                }
                        <td style="text-align: right;">${invoice.summary.grandTotal}</td>
                    </tr>
                </tfoot>
              </table>

              <div class="grand-total-section">
                <div class="grand-total-label">Grand Total</div>
                <div class="grand-total-value">₹ ${invoice.summary.grandTotal}</div>
              </div>

              <div class="signature-section">
                <p><strong>Sold By:</strong> ${invoice.seller.name}</p>
                <div class="signature-box">
                    <img src="${invoice.logoDataUrl}" style="height: 40px; opacity: 0.3;" />
                </div>
                <p>Authorized Signatory</p>
              </div>

            <div class="footer">
                <div class="policy-section" style="margin-bottom: 15px; font-size: 10px; color: #555; border-top: 1px solid #eee; padding-top: 12px; page-break-inside: avoid;">
                    <p><strong>Returns Policy:</strong> At Meri Gau Mata we try to deliver perfectly each and every time. But in the off-chance that you need to return the item, please do so with the original Brand box/price tag, original packing and invoice without which it will be really difficult for us to act on your request. Please help us in helping you. Terms and conditions apply.</p>
                    <p style="margin-top: 5px;">The goods sold as are intended for end user consumption and not for re-sale.</p>
                </div>
                <div style="position: relative;">
                    <p>Regd. office: ${invoice.seller.name}, ${invoice.seller.address.line1}, ${invoice.seller.address.city}, ${invoice.seller.address.state} - ${invoice.seller.address.zip}</p>
                    <p>Contact: ${invoice.seller.email} | ${invoice.seller.website}</p>
                    <div class="eoe">E. & O.E.</div>
                </div>
            </div>
            </div>`;

            const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.4; }
              .invoice-page { padding: 40px; display: flex; flex-direction: column; min-height: 277mm; page-break-after: always; box-sizing: border-box; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
              .header-left { display: flex; align-items: flex-start; gap: 20px; }
              .logo { width: 60px; height: 60px; object-fit: contain; }
              .company-info h3 { margin: 0; font-size: 16px; }
              .company-info p { margin: 2px 0; font-size: 11px; color: #555; max-width: 400px; }
              
              .header-right { text-align: right; min-width: 180px; }
              .tax-invoice-label { font-size: 20px; font-weight: bold; text-transform: uppercase; }
              .invoice-num-box { border: 1px dashed #999; padding: 8px 12px; display: block; margin-top: 10px; font-size: 13px; min-width: 160px; max-width: 200px; word-break: break-word; line-height: 1.5; text-align: center; box-sizing: border-box; }

              .address-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
              .address-section h4 { margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
              .address-section p { margin: 2px 0; font-size: 12px; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; }
              th { border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 12px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
              td { padding: 15px 10px; border-bottom: 1px solid #f9f9f9; font-size: 12px; vertical-align: top; overflow-wrap: break-word; }
              .total-row td { font-weight: bold; border-top: 2px solid #eee; border-bottom: none; background: #fafafa; padding: 12px 10px; }

              .grand-total-section { display: flex; justify-content: flex-end; align-items: center; gap: 40px; margin-top: 20px; padding: 0 10px; page-break-inside: avoid; }
              .grand-total-label { font-size: 18px; color: #666; }
              .grand-total-value { font-size: 24px; font-weight: bold; }
              
              .signature-section { margin-top: 30px; text-align: right; padding-right: 10px; page-break-inside: avoid; }
              .signature-box { height: 60px; display: flex; align-items: center; justify-content: flex-end; }
              .signature-section p { margin: 5px 0; font-size: 12px; }
              
              .footer { margin-top: auto; font-size: 10px; color: #777; padding-top: 20px; }
              .footer p { margin: 2px 0; }
              .eoe { position: absolute; right: 0; bottom: 0; font-weight: bold; font-size: 10px;}
            </style>
            </head>
            <body>
              ${renderInvoiceHtml(data.productInvoice)}
              ${data.isDual ? renderInvoiceHtml(data.deliveryInvoice) : ''}
            </body>
            </html>
            `;

            await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({ format: 'A4', printBackground: true });

            log.info('PDF generated successfully');
            return pdf;
        } catch (error) {
            log.operationError('PDF_GENERATION', error, { msg: 'Puppeteer/PDF generation failed' });
            throw error;
        } finally {
            if (browser) {
                await browser.close();
                log.info('Puppeteer browser closed');
            }
        }
    }

    static async _uploadToStorage(filename, fileBuffer) {
        try {
            const bucketName = 'invoices';
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filename, fileBuffer, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            // Bucket is private, return the path/filename for storage_path column
            return filename;
        } catch (error) {
            log.operationError('UPLOAD_STORAGE_FAIL', error);
            return null;
        }
    }

    static _amountToWords(amount) {
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
        let output = numToWords(Number(parts[0])) + 'Rupees';
        if (Number(parts[1]) > 0) {
            output += ' and ' + numToWords(Number(parts[1])) + 'Paise';
        }
        return output + ' Only';
    }
}

module.exports = InternalInvoiceService;
