/**
 * Pricing Calculator Service
 * Integrates TaxEngine with checkout flow for complete pricing breakdown
 */

const { TaxEngine, TAX_TYPE } = require('./tax-engine.service');
const settingsService = require('./settings.service');
const { validateCoupon, calculateCouponDiscount } = require('./coupon.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('PricingCalculator');

class PricingCalculator {
    /**
     * Calculate complete checkout totals including taxes
     * @param {Array} cartItems - Cart items with product/variant data
     * @param {Object} shippingAddress - Customer's shipping address
     * @param {string} couponCode - Optional coupon code
     * @param {string} userId - User ID for coupon validation
     * @returns {Object} Complete pricing breakdown
     */
    static async calculateCheckoutTotals(cartItems, shippingAddress, couponCode = null, userId = null) {
        log.operationStart('CALCULATECheckoutTotals', {
            itemCount: cartItems.length,
            hasCoupon: !!couponCode,
            hasAddress: !!shippingAddress
        });

        const startTime = Date.now();

        try {
            // 1. Calculate MRP totals (before any discounts)
            let totalMrp = 0;
            let totalSellingPrice = 0;

            const normalizedItems = cartItems.map(item => {
                const variant = item.variant || item.product_variants || {};
                const product = item.product || item.products || {};
                const quantity = item.quantity || 1;

                const price = variant.selling_price || product.price || 0;
                const mrp = variant.mrp || product.mrp || price;

                totalMrp += mrp * quantity;
                totalSellingPrice += price * quantity;

                return {
                    ...item,
                    variant,
                    product,
                    quantity,
                    unitPrice: price,
                    unitMrp: mrp
                };
            });

            // 2. Calculate MRP discount (before coupon)
            const mrpDiscount = totalMrp - totalSellingPrice;

            // 3. Validate and calculate coupon discount
            let productCouponDiscount = 0;
            let deliveryCouponDiscount = 0;
            let validatedCoupon = null;
            let itemDiscountBreakdown = [];

            if (couponCode) {
                const validation = await validateCoupon(couponCode, userId, normalizedItems, totalSellingPrice);
                if (validation.valid) {
                    validatedCoupon = validation.coupon;

                    // Only apply product-level discounts if not free_delivery
                    if (validatedCoupon.type !== 'free_delivery') {
                        const discountResult = calculateCouponDiscount(validatedCoupon, normalizedItems, totalSellingPrice);
                        productCouponDiscount = discountResult.totalDiscount;
                        itemDiscountBreakdown = discountResult.itemDiscounts;

                        // Apply discounts to item prices BEFORE tax calculation
                        // This ensures tax is calculated on the discounted amount
                        if (itemDiscountBreakdown.length > 0) {
                            normalizedItems.forEach(item => {
                                const itemDiscount = itemDiscountBreakdown.find(d =>
                                    (d.variant_id && d.variant_id === item.variant_id) ||
                                    (!d.variant_id && d.product_id === item.product_id)
                                );
                                if (itemDiscount) {
                                    // Subtract discount from the price used by TaxEngine
                                    const discountPerUnit = itemDiscount.discount / item.quantity;

                                    // We create deep copies to avoid polluting original objects if they are cached
                                    if (item.variant) {
                                        item.variant = { ...item.variant, selling_price: item.variant.selling_price - discountPerUnit };
                                    } else if (item.product) {
                                        item.product = { ...item.product, price: item.product.price - discountPerUnit };
                                    }

                                    // Also update the unitPrice helper in normalizedItems
                                    item.unitPrice = item.unitPrice - discountPerUnit;
                                }
                            });
                        }
                    }
                } else {
                    log.warn('COUPON_INVALID', validation.error, { couponCode });
                }
            }

            // 4. Calculate taxes using TaxEngine (on discounted prices)
            const taxResult = TaxEngine.calculateOrderTax(normalizedItems, shippingAddress);

            // Check if free delivery coupon is active
            const isFreeDeliveryCoupon = validatedCoupon && validatedCoupon.type === 'free_delivery';

            // Calculate delivery using the unified service
            // This handles global thresholds, surcharges, and inclusive GST logic
            // 3. Calculate Delivery Charges
            // Always calculate for Cart/Checkout UI estimation even if address is not set
            const deliveryResult = await DeliveryChargeService.calculateCartDelivery(
                normalizedItems,
                totalSellingPrice,
                shippingAddress,
                { forceFreeStandard: isFreeDeliveryCoupon }
            );

            let deliveryCharge = deliveryResult.totalDeliveryCharge;
            let deliveryGst = deliveryResult.totalDeliveryGST;

            // Extract global component for separate UI line item
            let globalDeliveryCharge = 0;
            let productDeliveryCharges = 0;
            let globalDeliveryGST = 0;
            let productDeliveryGST = 0;

            if (deliveryResult.items) {
                deliveryResult.items.forEach(delItem => {
                    const isGlobal = delItem.snapshot?.source === 'global';
                    if (isGlobal) {
                        globalDeliveryCharge += delItem.deliveryCharge;
                        globalDeliveryGST += delItem.deliveryGST;
                    } else {
                        productDeliveryCharges += delItem.deliveryCharge;
                        productDeliveryGST += delItem.deliveryGST;
                    }

                    // Map delivery charges back to normalizedItems for result construction
                    const item = normalizedItems.find(i =>
                        (delItem.variant_id && i.variant_id === delItem.variant_id) ||
                        (!delItem.variant_id && i.product_id === delItem.product_id)
                    );
                    if (item) {
                        item.delivery_charge = delItem.deliveryCharge;
                        item.delivery_gst = delItem.deliveryGST;
                        item.delivery_meta = delItem.snapshot;
                    }
                });
            }

            // 6. Calculate Coupon Discount for display
            // If it's a free_delivery coupon, we show the saved amount.
            // Logic: The "Discount" is the amount the user WOULD have paid for standard delivery.
            if (isFreeDeliveryCoupon) {
                const settings = await settingsService.getDeliverySettings();
                // Only show discount if they simply didn't meet the threshold
                if (totalSellingPrice < settings.delivery_threshold) {
                    // The saving is the standard delivery charge (exclusive)
                    // Note: DeliveryChargeService has already waived this in the actual totals above
                    // We set it to the SAVED base amount for display in coupon_discount
                    deliveryCouponDiscount = settings.delivery_charge;
                }
            }

            // Total coupon discount (applies to items only basically, or purely informational if logic separates them)
            const totalCouponDiscount = productCouponDiscount + deliveryCouponDiscount;

            // 7. Calculate final amount
            // Formula: Final = (Item_Taxable + Item_Tax) - productCouponDiscount + (Delivery + DeliveryGst)
            // Note: productCouponDiscount was already deducted from Item Prices?
            // "Apply discounts to item prices BEFORE tax calculation" -> Yes.
            // So `taxResult.summary.total_amount` is ALREADY the discounted price.
            // So we DO NOT subtract `productCouponDiscount` again.

            const finalAmount = taxResult.summary.total_amount + deliveryCharge + deliveryGst;

            // Fetch settings for result metadata
            const currentSettings = await settingsService.getDeliverySettings();

            const result = {
                // Item details
                items_count: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
                items: taxResult.items.map(item => {
                    // Find the original item in normalizedItems to get original unit prices
                    const originalItem = normalizedItems.find(i =>
                        (i.variant_id && i.variant_id === item.variant_id) ||
                        (!i.variant_id && i.product_id === item.product_id)
                    );

                    // Find delivery info from deliveryResult
                    const deliveryItem = deliveryResult.items ? deliveryResult.items.find(d =>
                        (d.variant_id && d.variant_id === item.variant_id) ||
                        (!d.variant_id && d.product_id === item.product_id)
                    ) : null;

                    // Extract the item-level coupon discount for this specific item
                    const itemDiscount = itemDiscountBreakdown.find(d =>
                        (d.variant_id && d.variant_id === item.variant_id) ||
                        (!d.variant_id && d.product_id === item.product_id)
                    );

                    return {
                        product_id: item.product_id,
                        variant_id: item.variant_id,
                        quantity: item.quantity,
                        unit_price: (originalItem?.unitPrice || item.unitPrice) + (itemDiscount ? (itemDiscount.discount / item.quantity) : 0), // Original price
                        discounted_unit_price: originalItem?.unitPrice || item.unitPrice, // Price used for tax
                        unit_mrp: originalItem?.unitMrp || item.unitMrp,
                        line_total: (originalItem?.unitPrice || item.unitPrice) * item.quantity,
                        coupon_discount: itemDiscount?.discount || 0, // Defensive: ensure never undefined

                        // Delivery Breakdown (Fixed)
                        delivery_charge: deliveryItem?.deliveryCharge || 0,
                        delivery_gst: deliveryItem?.deliveryGST || 0,
                        delivery_meta: deliveryItem?.snapshot || null,

                        tax_breakdown: item.taxBreakdown,
                        // Include objects for downstream formatters (like Razorpay)
                        product: originalItem?.product || item.product,
                        variant: originalItem?.variant || item.variant
                    };
                }),

                // Price breakdown
                total_mrp: Math.round(totalMrp * 100) / 100,
                total_selling_price: Math.round(totalSellingPrice * 100) / 100,
                mrp_discount: Math.round(mrpDiscount * 100) / 100,

                // Coupon (Defensive: ensure never undefined)
                coupon: validatedCoupon || null,
                coupon_code: validatedCoupon?.code || null,
                coupon_discount: Math.round((totalCouponDiscount || 0) * 100) / 100,

                // Subtotal (after MRP discount and PRODUCT coupon, before tax)
                subtotal_before_tax: Math.round((totalSellingPrice - productCouponDiscount) * 100) / 100,

                // Tax breakdown
                tax: {
                    total_taxable_amount: Math.round((taxResult.summary.total_taxable_amount + deliveryCharge) * 100) / 100,

                    // Add delivery GST to the appropriate buckets with precision rounding
                    cgst: Math.round((taxResult.summary.total_cgst + (taxResult.summary.tax_type === TAX_TYPE.INTER_STATE ? 0 : (deliveryGst / 2))) * 100) / 100,
                    sgst: Math.round((taxResult.summary.total_sgst + (taxResult.summary.tax_type === TAX_TYPE.INTER_STATE ? 0 : (deliveryGst / 2))) * 100) / 100,
                    igst: Math.round((taxResult.summary.total_igst + (taxResult.summary.tax_type === TAX_TYPE.INTER_STATE ? deliveryGst : 0)) * 100) / 100,

                    total_tax: Math.round((taxResult.summary.total_tax + deliveryGst) * 100) / 100,
                    tax_type: taxResult.summary.tax_type,
                    is_inter_state: taxResult.summary.tax_type === TAX_TYPE.INTER_STATE
                },

                // Delivery
                delivery_charge: Math.round(deliveryCharge * 100) / 100,
                delivery_gst: Math.round(deliveryGst * 100) / 100,
                delivery_total: Math.round((deliveryCharge + deliveryGst) * 100) / 100,

                // Detailed Breakdown (Added for UI)
                global_delivery_charge: Math.round(globalDeliveryCharge * 100) / 100,
                global_delivery_gst: Math.round(globalDeliveryGST * 100) / 100,
                product_delivery_charges: Math.round(productDeliveryCharges * 100) / 100,
                product_delivery_gst: Math.round(productDeliveryGST * 100) / 100,

                free_delivery_threshold: currentSettings.delivery_threshold,
                delivery_settings: {
                    threshold: currentSettings.delivery_threshold,
                    charge: currentSettings.delivery_charge,
                    gst: currentSettings.delivery_gst
                },

                // Final
                final_amount: Math.round(finalAmount * 100) / 100,

                // Metadata for order creation
                _meta: {
                    seller_state_code: taxResult.summary.seller_state_code,
                    buyer_state_code: taxResult.summary.buyer_state_code,
                    calculated_at: new Date().toISOString()
                }
            };

            log.operationSuccess('CALCULATE_CHECKOUT_TOTALS', {
                finalAmount: result.final_amount,
                taxAmount: result.tax.total_tax,
                taxType: result.tax.tax_type
            }, Date.now() - startTime);

            return result;

        } catch (error) {
            log.operationError('CALCULATE_CHECKOUT_TOTALS', error);
            throw error;
        }
    }

    /**
     * Calculate refund amount for returned items
     * @param {Array} orderItems - Original order items with tax snapshots
     * @param {Array} returnItems - Items being returned with quantities
     * @returns {Object} Refund breakdown
     */
    static calculateRefund(orderItems, returnItems) {
        log.operationStart('CALCULATERefund', {
            orderItemCount: orderItems.length,
            returnItemCount: returnItems.length
        });

        let totalRefund = 0;
        let totalTaxRefund = 0;
        let cgstRefund = 0;
        let sgstRefund = 0;
        let igstRefund = 0;
        let taxableRefund = 0;

        const itemBreakdowns = returnItems.map(returnItem => {
            const orderItem = orderItems.find(oi => oi.id === returnItem.orderItemId);
            if (!orderItem) {
                log.warn('REFUND_ITEM_NOT_FOUND', `Order item ${returnItem.orderItemId} not found`);
                return null;
            }

            const returnQuantity = returnItem.quantity;
            const originalQuantity = orderItem.quantity;
            const refundRatio = returnQuantity / originalQuantity;

            // Calculate proportional refund
            const itemTaxableRefund = (orderItem.taxable_amount || orderItem.price_per_unit * originalQuantity) * refundRatio;
            const itemCgstRefund = (orderItem.cgst || 0) * refundRatio;
            const itemSgstRefund = (orderItem.sgst || 0) * refundRatio;
            const itemIgstRefund = (orderItem.igst || 0) * refundRatio;
            const itemTotalRefund = (orderItem.total_amount || orderItem.price_per_unit * originalQuantity) * refundRatio;

            taxableRefund += itemTaxableRefund;
            cgstRefund += itemCgstRefund;
            sgstRefund += itemSgstRefund;
            igstRefund += itemIgstRefund;
            totalRefund += itemTotalRefund;
            totalTaxRefund += (itemCgstRefund + itemSgstRefund + itemIgstRefund);

            return {
                orderItemId: orderItem.id,
                productTitle: orderItem.title || orderItem.variant_snapshot?.product_title,
                returnQuantity,
                originalQuantity,
                taxableRefund: Math.round(itemTaxableRefund * 100) / 100,
                cgstRefund: Math.round(itemCgstRefund * 100) / 100,
                sgstRefund: Math.round(itemSgstRefund * 100) / 100,
                igstRefund: Math.round(itemIgstRefund * 100) / 100,
                totalRefund: Math.round(itemTotalRefund * 100) / 100
            };
        }).filter(Boolean);

        const result = {
            items: itemBreakdowns,
            summary: {
                taxableRefund: Math.round(taxableRefund * 100) / 100,
                cgstRefund: Math.round(cgstRefund * 100) / 100,
                sgstRefund: Math.round(sgstRefund * 100) / 100,
                igstRefund: Math.round(igstRefund * 100) / 100,
                totalTaxRefund: Math.round(totalTaxRefund * 100) / 100,
                totalRefund: Math.round(totalRefund * 100) / 100
            }
        };

        log.operationSuccess('CALCULATE_REFUND', result.summary);
        return result;
    }

    /**
     * Format pricing for Razorpay invoice line items
     * @param {Array} items - Items with tax breakdowns
     * @returns {Array} Razorpay-formatted line items
     */
    static formatForRazorpayInvoice(items) {
        return items.map(item => {
            const variant = item.variant || {};
            const product = item.product || {};
            const tax = item.taxBreakdown || item.tax_breakdown || {};

            const lineItem = {
                name: `${product.title || 'Product'} - ${variant.size_label || 'Standard'}`,
                description: variant.description || product.description || '',
                amount: Math.round(tax.total_amount / (item.quantity || 1) * 100), // Inclusive amount per unit in paisa
                currency: 'INR',
                quantity: item.quantity || 1,
                tax_inclusive: true
            };

            // Add GST fields only if tax is applicable
            if (tax.gst_rate && tax.gst_rate > 0) {
                lineItem.hsn_code = tax.hsn_code || tax.hsnCode || undefined;
                lineItem.tax_rate = tax.gst_rate;
            }

            return lineItem;
        });
    }
}

module.exports = { PricingCalculator };
