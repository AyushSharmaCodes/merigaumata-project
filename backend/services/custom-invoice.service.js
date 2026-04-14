const fs = require('fs');
const path = require('path');
const BrowserPool = require('../lib/browser-pool');
const handlebars = require('handlebars');
const supabase = require('../config/supabase');

const logger = require('../utils/logger');
const InvoiceMessages = require('../constants/messages/InvoiceMessages');
const { createModuleLogger } = require('../utils/logging-standards');
const { CurrencyExchangeService } = require('./currency-exchange.service');

const log = createModuleLogger('CustomInvoiceService');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../../storage/invoices');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Logo URL
const LOGO_URL = process.env.BRAND_LOGO_URL || 'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/brand-assets/brand-logo.png';

class CustomInvoiceService {
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

            // 5. Prepare Template Data (Reusing logic if possible, but copying for safety)
            const templateData = await this._prepareTemplateData(order, invoiceNumber, invoiceTypeDisplay, isGstInvoice);

            // 6. Generate PDF
            const pdfBuffer = await this._generatePdf(templateData);

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
                storagePath = await this._uploadToStorage(filename, pdfBuffer);
            }

            // 8. Persist Metadata in DB
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 Days Retention

            const { data: invoiceRecord, error: dbError } = await supabase
                .from('invoices')
                .insert({
                    order_id: order.id,
                    type: forcedType,
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

            if (dbError) throw dbError;

            // 9. Update Order to point to this as the latest official invoice
            await supabase.from('orders').update({
                invoice_id: invoiceRecord.id,
                invoice_number: invoiceNumber,
                invoice_status: 'generated',
                invoice_generated_at: new Date().toISOString(),
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
                filePath: invoiceRecord.file_path
            };

        } catch (error) {
            log.operationError('GENERATE_CUSTOM_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    // --- Template & PDF Logic (Borrowed from InternalInvoiceService) ---

    static async _prepareTemplateData(order, invoiceNumber, invoiceType, isGstInvoice) {
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

        const customerState = order.shipping_address?.state || 'Maharashtra';
        const sellerState = seller.address.state;
        const isInterState = !customerState.toLowerCase().includes(sellerState.toLowerCase());

        const logoDataUrl = LOGO_URL;
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

        const amountInWords = this._amountToWords(Number(grandTotal.toFixed(2)), displayCurrency);

        return {
            title: invoiceType,
            invoiceType,
            invoiceNumber,
            invoiceDate: new Date().toLocaleDateString('en-IN'),
            placeOfSupply: `${customerState} (${isInterState ? 'Inter-State' : 'Intra-State'})`,
            orderNumber: order.order_number,
            logoDataUrl,
            seller,
            customer: {
                name: order.customer_name || 'Valued Customer',
                billing_address: order.billing_address || order.shipping_address,
                shipping_address: order.shipping_address,
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
            amountInWords
        };
    }

    static async _generatePdf(data) {
        return BrowserPool.withPage(async (page) => {
            // Using a slightly more polished template style similar to the user's existing one
            const templateHtml = `
            <!DOCTYPE html>
            <html>
            <head>
            <style>
              body { font-family: Helvetica, sans-serif; padding: 40px; color: #333; }
              .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
              .company-info h3 { margin: 0 0 5px 0; font-size: 20px; color: #000; }
              .company-info p { margin: 0; font-size: 12px; color: #555; }
              .invoice-title { font-size: 24px; font-weight: bold; text-align: right; color: #fb923c; }
              .invoice-details { text-align: right; font-size: 13px; margin-top: 10px; }
              .invoice-details p { margin: 2px 0; }
              
              .bill-to { margin-bottom: 30px; }
              .bill-to h4 { margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; color: #666; }
              .bill-to p { margin: 0; font-size: 14px; }

              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #fffaf0; border-bottom: 2px solid #fb923c; padding: 10px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; }
              td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; font-size: 12px; }
              td.right { text-align: right; }
              th.right { text-align: right; }
              
              .totals { margin-top: 30px; float: right; width: 45%; }
              .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
              .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #fb923c; border-bottom: 2px solid #fb923c; padding: 10px 0; margin-top: 10px; color: #c2410c; }
              
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
            </head>
            <body>
              <div class="header">
                <div class="company-info">
                    {{#if logoDataUrl}}<img src="{{logoDataUrl}}" style="height: 40px; margin-bottom: 10px;" />{{/if}}
                    <h3>{{seller.name}}</h3>
                    <p>{{seller.address.line1}}</p>
                    <p>{{seller.address.city}}, {{seller.address.state}} - {{seller.address.zip}}</p>
                    <p><strong>GSTIN:</strong> {{seller.gstin}}</p>
                </div>
                <div>
                    <div class="invoice-title">{{title}}</div>
                    <div class="invoice-details">
                        <p><strong>No:</strong> {{invoiceNumber}}</p>
                        <p><strong>Date:</strong> {{invoiceDate}}</p>
                        <p><strong>Place:</strong> {{placeOfSupply}}</p>
                    </div>
                </div>
              </div>

              <div class="bill-to">
                  <h4>Bill To</h4>
                  <p><strong>{{customer.name}}</strong></p>
                  {{#if customer.shipping_address}}
                  <p>{{customer.shipping_address.address_line1}}, {{customer.shipping_address.city}}</p>
                  <p>{{customer.shipping_address.state}} - {{customer.shipping_address.pincode}}</p>
                  {{/if}}
                  {{#if customer.gstin}}
                  <p><strong>GSTIN:</strong> {{customer.gstin}}</p>
                  {{/if}}
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 5%">#</th>
                    <th style="width: 35%">Item</th>
                    <th style="width: 10%">HSN</th>
                    <th style="width: 8%">Qty</th>
                    <th class="right" style="width: 12%">Rate</th>
                    {{#if isGstInvoice}}
                      <th class="right" style="width: 15%">Taxable</th>
                      <th class="right" style="width: 15%">{{#if isInterState}}IGST{{else}}CGST+SGST{{/if}}</th>
                    {{/if}}
                    <th class="right" style="width: 15%">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {{#each items}}
                  <tr>
                    <td>{{index}}</td>
                    <td>{{name}} {{#if variant}}<br><small style="color: #666">({{variant}})</small>{{/if}}</td>
                    <td>{{hsn_code}}</td>
                    <td>{{quantity}}</td>
                    <td class="right">{{rate}}</td>
                    {{#if ../isGstInvoice}}
                      <td class="right">{{taxableValue}}</td>
                      <td class="right">
                        {{#if ../isInterState}}{{igstAmount}}
                        {{else}}{{cgstAmount}} + {{sgstAmount}}{{/if}}
                      </td>
                    {{/if}}
                    <td class="right">{{totalAmount}}</td>
                  </tr>
                  {{/each}}
                </tbody>
              </table>

              <div class="totals">
                  {{#if isGstInvoice}}
                    <div class="totals-row"><span>Taxable Amount:</span> <span>{{summary.taxableAmount}}</span></div>
                    {{#if isInterState}}
                      <div class="totals-row"><span>Total IGST ({{items.0.gstRate}}%):</span> <span>{{summary.totalIgst}}</span></div>
                    {{else}}
                      <div class="totals-row"><span>Total CGST:</span> <span>{{summary.totalCgst}}</span></div>
                      <div class="totals-row"><span>Total SGST:</span> <span>{{summary.totalSgst}}</span></div>
                    {{/if}}
                  {{/if}}
                  {{#if summary.refundableDeliveryCharge}}
                  <div class="totals-row"><span>Delivery Charges (Refundable):</span> <span>{{summary.refundableDeliveryCharge}}</span></div>
                  {{/if}}
                  {{#if summary.nonRefundableDeliveryCharge}}
                  <div class="totals-row"><span>Delivery Charges (Non-Refundable):</span> <span>{{summary.nonRefundableDeliveryCharge}}</span></div>
                  {{/if}}
                  {{#unless summary.refundableDeliveryCharge}}
                    {{#unless summary.nonRefundableDeliveryCharge}}
                      {{#if summary.deliveryCharge}}
                      <div class="totals-row"><span>Delivery Charges:</span> <span>{{summary.deliveryCharge}}</span></div>
                      {{/if}}
                    {{/unless}}
                  {{/unless}}
                  <div class="totals-row grand-total"><span>Grand Total:</span> <span>{{currencySymbol}}{{summary.grandTotal}}</span></div>
                  <div style="font-size: 11px; margin-top: 10px; text-align: right; font-style: italic;">{{amountInWords}}</div>
              </div>
              
              <div style="clear: both;"></div>
              
              <div class="footer">
                  <p>This is a computer generated document and does not require a signature.</p>
                  <p>Subject to {{seller.city}} Jurisdiction</p>
              </div>
            </body>
            </html>
            `;

            const template = handlebars.compile(templateHtml);
            const html = template(data);

            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({ format: 'A4', printBackground: true });

            return pdf;
        });
    }

    static async _uploadToStorage(filename, fileBuffer) {
        try {
            const bucketName = 'invoices';
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
