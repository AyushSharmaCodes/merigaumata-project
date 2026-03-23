export class CheckoutMessages {
    static readonly LOAD_ERROR = "checkout.loadError";
    static readonly TITLE = "checkout.title";
    static readonly SHIPPING = "checkout.shipping";
    static readonly BILLING = "checkout.billing";
    static readonly SAME_AS_SHIPPING = "checkout.sameAsShipping";
    static readonly PAYMENT_GATEWAY_LOAD_ERROR = "checkout.paymentGatewayLoadError";
    static readonly ORDER_PLACE_SUCCESS = "checkout.orderPlaceSuccess";
    static readonly NETWORK_ERROR = "checkout.networkError";
    static readonly ORDER_ERROR = "checkout.orderError";
    static readonly PAYMENT_CANCELLED = "checkout.paymentCancelled";
    static readonly PAYMENT_FAILED = "checkout.paymentFailed";
    static readonly PAYMENT_INIT_ERROR = "checkout.paymentInitError";
    static readonly PROCESSING = "checkout.processing";
    static readonly VERIFYING_PAYMENT = "checkout.verifyingPayment";
    static readonly FINALIZING_ORDER = "checkout.finalizingOrder";
    static readonly REDIRECTING = "checkout.redirecting";
    static readonly BACK_TO_CART = "checkout.backToCart";
    static readonly SECURE = "checkout.secure";
    static readonly SECURE_CHECKOUT_SUB = "checkout.secureCheckoutSub";
    static readonly ITEMS_IN_ORDER = "checkout.itemsInOrder";
    static readonly PAY = "checkout.pay";
    static readonly SECURE_GATEWAY = "checkout.secureGateway";
    static readonly PHONE_WARNING_TITLE = "checkout.phoneWarning.title";
    static readonly PHONE_WARNING_DESC = "checkout.phoneWarning.desc";
    static readonly PHONE_WARNING_ACTION = "checkout.phoneWarning.action";
    static readonly PREPARING = "checkout.preparing";
    static readonly ORDER_SUMMARY = "checkout.orderSummary";
    static readonly DELIVERY = "checkout.delivery";
    static readonly COD_NOT_SUPPORTED = "checkout.codNotSupported";

    // Stock Issues
    static readonly STOCK_UNAVAILABLE = "checkout.stock.unavailable";
    static readonly STOCK_DESC = "checkout.stock.desc";
    static readonly OUT_OF_STOCK = "checkout.stock.outOfStock";
    static readonly ONLY_AVAILABLE = "checkout.stock.onlyAvailable";
    static readonly YOU_REQUESTED = "checkout.stock.youRequested";
    static readonly UPDATE_CART = "checkout.updateCart";

    // Shared with Summary/Breakdown
    static readonly QTY = "profile.qty";
    static readonly INCL_TAX_AMOUNT = "profile.inclTaxAmount";
    static readonly PAYMENT_DETAILS = "profile.paymentDetails";
    static readonly SUBTOTAL_MRP = "profile.subtotalMRP";
    static readonly PRODUCT_DISCOUNT = "profile.productDiscount";
    static readonly SELLING_PRICE = "profile.sellingPrice";
    static readonly COUPON = "profile.coupon";
    static readonly APPLIED = "profile.applied";
    static readonly NON_REFUNDABLE = "profile.nonRefundable";
    static readonly INCL_TAX = "profile.inclTax";
    static readonly REFUNDABLE_SURCHARGE = "profile.refundableSurcharge";
    static readonly ADDITIONAL_PROCESSING = "profile.additionalProcessing";
    static readonly NON_REF = "profile.nonRef";
    static readonly TAX_BREAKDOWN_GST = "profile.taxBreakdownGst";
    static readonly IGST_FULL = "profile.igstFull";
    static readonly CGST_FULL = "profile.cgstFull";
    static readonly SGST_FULL = "profile.sgstFull";
    static readonly TOTAL_TAX_INCLUDED = "profile.totalTaxIncluded";
    static readonly VIEW_PRODUCT_WISE_TAX = "profile.viewProductWiseTax";
    static readonly TAXABLE_AMOUNT = "profile.taxableAmount";
    static readonly TAX_AMOUNT = "profile.taxAmount";
    static readonly STANDARD_DELIVERY_GST = "profile.standardDeliveryGst";
    static readonly SURCHARGE_GST = "profile.surchargeGst";
    static readonly TOTAL_PAYABLE = "profile.totalPayable";
    static readonly SAVINGS_SHORT = "profile.savingsShort";

    // Address Form
    static readonly ADDRESS_TYPE = "checkout.addressForm.addressType";
    static readonly ADDRESS_SHIPPING = "checkout.addressForm.shipping";
    static readonly ADDRESS_BILLING = "checkout.addressForm.billing";
    static readonly ADDRESS_BOTH = "checkout.addressForm.both";
    static readonly FULL_NAME_LABEL = "checkout.addressForm.fullName";
    static readonly PHONE_LABEL = "checkout.addressForm.phone";
    static readonly ADDRESS_LINE1 = "checkout.addressForm.addressLine1";
    static readonly ADDRESS_LINE2 = "checkout.addressForm.addressLine2";
    static readonly CITY = "checkout.addressForm.city";
    static readonly STATE = "checkout.addressForm.state";
    static readonly POSTAL_CODE = "checkout.addressForm.postalCode";
    static readonly COUNTRY = "checkout.addressForm.country";
    static readonly SET_PRIMARY = "checkout.addressForm.setPrimary";
    static readonly SAVING = "checkout.addressForm.saving";
    static readonly UPDATE_ADDRESS = "checkout.addressForm.updateAddress";
    static readonly ADD_ADDRESS = "checkout.addressForm.addAddress";
    static readonly COUNTRY_INDIA = "checkout.addressForm.india";
    static readonly RZP_ADDRESS = "checkout.rzpAddress";
}
