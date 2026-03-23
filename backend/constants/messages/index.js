const AuthMessages = require('./AuthMessages');
const CartMessages = require('./CartMessages');
const CheckoutMessages = require('./CheckoutMessages');
const SystemMessages = require('./SystemMessages');
const OrderMessages = require('./OrderMessages');
const EventMessages = require('./EventMessages');
const CouponMessages = require('./CouponMessages');
const ProfileMessages = require('./ProfileMessages');
const ValidationMessages = require('./ValidationMessages');
const LogMessages = require('./LogMessages');
const InventoryMessages = require('./InventoryMessages');
const InvoiceMessages = require('./InvoiceMessages');
const PaymentMessages = require('./PaymentMessages');
const ReviewMessages = require('./ReviewMessages');
const ReturnMessages = require('./ReturnMessages');
const PolicyMessages = require('./PolicyMessages');
const CommentMessages = require('./CommentMessages');
const CommonMessages = require('./CommonMessages');
const ContactMessages = require('./ContactMessages');
const DonationMessages = require('./DonationMessages');
const EmailMessages = require('./EmailMessages');

module.exports = {
    AUTH: AuthMessages,
    CART: CartMessages,
    CHECKOUT: CheckoutMessages,
    SYSTEM: SystemMessages,
    ORDER: OrderMessages,
    REVIEWS: ReviewMessages,
    EVENT: EventMessages,
    COUPON: CouponMessages,
    PROFILE: ProfileMessages,
    VALIDATION: ValidationMessages,
    LOGS: LogMessages,
    INVENTORY: InventoryMessages,
    INVOICE: InvoiceMessages,
    PAYMENT: PaymentMessages,
    RETURN: ReturnMessages,
    POLICY: PolicyMessages,
    COMMENT: CommentMessages,
    COMMON: CommonMessages,
    CONTACT: ContactMessages,
    DONATION: DonationMessages,
    EMAIL: EmailMessages
};
