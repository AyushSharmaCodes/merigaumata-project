const { z } = require('zod');

const createReviewSchema = z.object({
    productId: z.string().uuid('errors.cart.invalidProductId'),
    userId: z.string().uuid('errors.auth.invalidUserId'), // I should add this key if not present, using internal key for now
    rating: z.number()
        .min(1, 'errors.review.ratingMin')
        .max(5, 'errors.review.ratingMax')
        .int('errors.review.ratingInt'),
    title: z.string()
        .trim()
        .min(2, 'errors.review.titleShort')
        .max(100, 'errors.review.titleLong'),
    comment: z.string()
        .trim()
        .min(10, 'errors.review.commentShort')
        .max(2000, 'errors.review.commentLong')
});

module.exports = {
    createReviewSchema
};
