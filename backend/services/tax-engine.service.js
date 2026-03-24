/**
 * Tax Engine Service
 * Handles GST calculation for Indian e-commerce compliance
 * 
 * GST Rules:
 * - Intra-state (same state): CGST + SGST (each = GST Rate / 2)
 * - Inter-state (different states): IGST (= full GST Rate)
 * - Price-inclusive: Reverse calculate tax from selling price
 * - Price-exclusive: Forward calculate tax on base price
 */

const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('TaxEngine');

// Indian State Codes (First 2 digits of GSTIN)
const INDIA_STATE_CODES = {
    '01': 'Jammu & Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli and Daman & Diu',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman & Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh'
};

// Valid GST Rates
const VALID_GST_RATES = [0, 5, 12, 18, 28];

// Tax Type Constants
const TAX_TYPE = {
    INTRA_STATE: 'INTRA', // CGST + SGST
    INTER_STATE: 'INTER'  // IGST
};

class TaxEngine {
    /**
     * Get seller state code from environment
     * @returns {string} Two-digit state code
     */
    static getSellerStateCode() {
        const stateCode = process.env.SELLER_STATE_CODE || '27'; // Default to Maharashtra
        if (!INDIA_STATE_CODES[stateCode]) {
            log.warn('TAX_CONFIG', `Invalid SELLER_STATE_CODE: ${stateCode}, defaulting to 27 (Maharashtra)`);
            return '27';
        }
        return stateCode;
    }

    /**
     * Extract state code from address
     * Supports: state name matching, pincode prefix, or explicit state_code field
     * @param {Object} address - Address object with state field
     * @returns {string|null} Two-digit state code or null
     */
    static extractStateCodeFromAddress(address) {
        if (!address) return null;

        // If state_code is explicitly provided
        if (address.state_code && INDIA_STATE_CODES[address.state_code]) {
            return address.state_code;
        }

        // Match by state name
        const stateName = (address.state || '').toLowerCase().trim();
        for (const [code, name] of Object.entries(INDIA_STATE_CODES)) {
            if (name.toLowerCase() === stateName ||
                name.toLowerCase().includes(stateName) ||
                stateName.includes(name.toLowerCase())) {
                return code;
            }
        }

        log.warn('TAX_EXTRACT_STATE', `Could not determine state code for: ${address.state}`, { address });
        return null;
    }

    /**
     * Determine tax type based on seller and buyer states
     * @param {string} sellerStateCode 
     * @param {string} buyerStateCode 
     * @returns {string} TAX_TYPE.INTRA_STATE or TAX_TYPE.INTER_STATE
     */
    static determineTaxType(sellerStateCode, buyerStateCode) {
        if (!buyerStateCode) {
            // If buyer state unknown, default to intra-state (safer for seller)
            log.warn('TAX_TYPE', 'Buyer state unknown, defaulting to intra-state');
            return TAX_TYPE.INTRA_STATE;
        }
        return sellerStateCode === buyerStateCode ? TAX_TYPE.INTRA_STATE : TAX_TYPE.INTER_STATE;
    }

    /**
     * Calculate tax for a single item
     * @param {Object} item - Item with price, quantity, and tax metadata
     * @param {string} taxType - TAX_TYPE.INTRA_STATE or TAX_TYPE.INTER_STATE
     * @returns {Object} Tax calculation result
     */
    static calculateItemTax(item, taxType) {
        const {
            sellingPrice,
            quantity = 1,
            taxApplicable = false,
            gstRate = 0,
            priceIncludesTax = true
        } = item;

        // If tax not applicable, return zero taxes
        if (!taxApplicable || gstRate === 0) {
            const totalAmount = sellingPrice * quantity;
            return {
                taxable_amount: totalAmount,
                cgst: 0,
                sgst: 0,
                igst: 0,
                total_tax: 0,
                total_amount: totalAmount,
                gst_rate: 0,
                tax_type: null
            };
        }

        const gstMultiplier = gstRate / 100;
        let taxableAmount, totalTax;

        if (priceIncludesTax) {
            // Reverse calculation: Price includes GST
            // taxable = price / (1 + gstRate/100)
            const pricePerUnit = sellingPrice;
            const taxablePerUnit = pricePerUnit / (1 + gstMultiplier);
            taxableAmount = taxablePerUnit * quantity;
            totalTax = (pricePerUnit * quantity) - taxableAmount;
        } else {
            // Forward calculation: Price excludes GST
            // tax = price * gstRate/100
            taxableAmount = sellingPrice * quantity;
            totalTax = taxableAmount * gstMultiplier;
        }

        // Round to 2 decimal places
        taxableAmount = Math.round(taxableAmount * 100) / 100;
        totalTax = Math.round(totalTax * 100) / 100;

        let cgst = 0, sgst = 0, igst = 0;

        if (taxType === TAX_TYPE.INTER_STATE) {
            // Inter-state: Full IGST
            igst = totalTax;
        } else {
            // Intra-state: Split CGST + SGST
            cgst = Math.round((totalTax / 2) * 100) / 100;
            sgst = totalTax - cgst; // Remainder to avoid rounding issues
        }

        return {
            taxable_amount: taxableAmount,
            cgst,
            sgst,
            igst,
            total_tax: totalTax,
            total_amount: taxableAmount + totalTax,
            gst_rate: gstRate,
            tax_type: taxType
        };
    }

    /**
     * Calculate tax for multiple order items
     * @param {Array} items - Array of items with variant/product tax metadata
     * @param {Object} shippingAddress - Customer's shipping address
     * @returns {Object} Aggregated tax calculation
     */
    static calculateOrderTax(items, shippingAddress) {
        const sellerStateCode = this.getSellerStateCode();
        const buyerStateCode = this.extractStateCodeFromAddress(shippingAddress);
        const taxType = this.determineTaxType(sellerStateCode, buyerStateCode);

        log.debug('ORDER_TAX', 'Calculating order tax', {
            sellerState: sellerStateCode,
            buyerState: buyerStateCode,
            taxType,
            itemCount: items.length
        });

        let total_taxable_amount = 0;
        let total_cgst = 0;
        let total_sgst = 0;
        let total_igst = 0;
        let total_tax = 0;
        let total_amount = 0;

        const itemTaxBreakdowns = items.map(item => {
            // Extract tax metadata from variant or product
            const variant = item.variant || item.product_variants || {};
            const product = item.product || item.products || {};

            const taxMeta = {
                sellingPrice: variant.selling_price || product.price || item.price || 0,
                quantity: item.quantity || 1,
                taxApplicable: variant.tax_applicable ?? product.default_tax_applicable ?? product.tax_applicable ?? false,
                gstRate: variant.gst_rate ?? product.default_gst_rate ?? product.gst_rate ?? 0,
                priceIncludesTax: variant.price_includes_tax ?? product.default_price_includes_tax ?? product.price_includes_tax ?? true,
                hsnCode: variant.hsn_code || product.default_hsn_code || product.hsn_code || null
            };

            const taxResult = this.calculateItemTax(taxMeta, taxType);

            total_taxable_amount += taxResult.taxable_amount;
            total_cgst += taxResult.cgst;
            total_sgst += taxResult.sgst;
            total_igst += taxResult.igst;
            total_tax += taxResult.total_tax;
            total_amount += taxResult.total_amount;

            return {
                ...item,
                taxBreakdown: {
                    ...taxResult,
                    hsn_code: taxMeta.hsnCode
                }
            };
        });

        return {
            items: itemTaxBreakdowns,
            summary: {
                total_taxable_amount: Math.round(total_taxable_amount * 100) / 100,
                total_cgst: Math.round(total_cgst * 100) / 100,
                total_sgst: Math.round(total_sgst * 100) / 100,
                total_igst: Math.round(total_igst * 100) / 100,
                total_tax: Math.round(total_tax * 100) / 100,
                total_amount: Math.round(total_amount * 100) / 100,
                tax_type: taxType,
                seller_state_code: sellerStateCode,
                buyer_state_code: buyerStateCode
            }
        };
    }

    /**
     * Create immutable tax snapshot for order item
     * @param {Object} item - Cart item with variant/product
     * @param {Object} taxBreakdown - Calculated tax breakdown
     * @returns {Object} Tax snapshot for storage
     */
    static createTaxSnapshot(item, taxBreakdown) {
        const variant = item.variant || item.product_variants || {};
        const product = item.product || item.products || {};

        return {
            taxable_amount: taxBreakdown.taxableAmount,
            cgst: taxBreakdown.cgst,
            sgst: taxBreakdown.sgst,
            igst: taxBreakdown.igst,
            hsn_code: taxBreakdown.hsnCode || null,
            gst_rate: taxBreakdown.gstRate || null,
            total_amount: taxBreakdown.totalAmount,
            variant_snapshot: {
                variant_id: variant.id || item.variant_id,
                size_label: variant.size_label,
                selling_price: variant.selling_price,
                mrp: variant.mrp,
                description: variant.description,
                product_title: product.title,
                tax_applicable: variant.tax_applicable,
                price_includes_tax: variant.price_includes_tax
            }
        };
    }

    /**
     * Validate GST rate
     * @param {number} rate 
     * @returns {boolean}
     */
    static isValidGstRate(rate) {
        return VALID_GST_RATES.includes(rate);
    }

    /**
     * Validate HSN code format
     * @param {string} hsnCode 
     * @returns {boolean}
     */
    static isValidHsnCode(hsnCode) {
        if (!hsnCode) return true; // Optional
        return /^\d{4,8}$/.test(hsnCode);
    }
}

module.exports = {
    TaxEngine,
    TAX_TYPE,
    INDIA_STATE_CODES,
    VALID_GST_RATES
};
