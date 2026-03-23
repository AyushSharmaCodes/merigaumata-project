const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { LOGS, REVIEWS } = require('../constants/messages');

/**
 * Review Service
 * Handles business logic, purchase verification, and rating aggregation for product reviews.
 */
class ReviewService {
    /**
     * Get reviews for a specific product
     */
    static async getProductReviews(productId) {
        logger.debug({ productId }, 'Fetching reviews for product');

        const { data, error } = await supabase
            .from('reviews')
            .select(`
                *,
                profiles:user_id (
                    name,
                    avatar_url
                )
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error({ err: error, productId }, 'REVIEWS_FETCH_FAILED');
            throw error;
        }

        return data.map(review => ({
            id: review.id,
            productId: review.product_id,
            userId: review.user_id,
            userName: review.profiles?.name || 'Anonymous',
            userAvatar: review.profiles?.avatar_url,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            verified: review.is_verified,
            createdAt: review.created_at
        }));
    }

    /**
     * Create a new review
     * Checks for existing reviews and verifies purchase
     */
    static async createReview(reviewData) {
        const { productId, userId, rating, title, comment } = reviewData;
        const opMeta = { productId, userId, rating };

        logger.info(opMeta, 'Attempting to create product review');

        try {
            // 1. Check for existing review (one review per product per user)
            const { data: existing, error: checkError } = await supabase
                .from('reviews')
                .select('id')
                .eq('product_id', productId)
                .eq('user_id', userId)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                logger.warn(opMeta, 'REVIEW_DUPLICATE_ATTEMPT');
                const error = new Error(REVIEWS.ALREADY_REVIEWED);
                error.status = 400;
                throw error;
            }

            // 2. Check for "Verified Purchase"
            // Look for a delivered order containing this product for this user
            const { data: purchase, error: purchaseError } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', userId)
                .eq('status', 'delivered')
                .contains('items', [{ product_id: productId }])
                .maybeSingle();

            if (purchaseError) {
                logger.warn({ err: purchaseError, ...opMeta }, 'PURCHASE_VERIFICATION_ERROR_INGNORED');
            }

            const isVerified = !!purchase;
            if (isVerified) {
                logger.debug({ ...opMeta }, 'REVIEW_PURCHASE_VERIFIED');
            }

            // 3. Insert review
            const { data: review, error: insertError } = await supabase
                .from('reviews')
                .insert([{
                    product_id: productId,
                    user_id: userId,
                    rating,
                    title,
                    comment,
                    is_verified: isVerified
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // 4. Update product rating aggregation
            // We do this asynchronously to avoid blocking response, but handle errors
            this.updateProductRatingAggregation(productId).catch(err => {
                logger.error({ err, productId }, 'RATING_AGGREGATION_UPDATE_FAILED');
            });

            logger.info({ reviewId: review.id, ...opMeta }, 'REVIEW_CREATED_SUCCESS');
            return review;

        } catch (error) {
            if (error.status) throw error;
            logger.error({ err: error, ...opMeta }, 'REVIEW_CREATION_FAILED');
            throw error;
        }
    }

    /**
     * Delete a review
     */
    static async deleteReview(reviewId) {
        logger.info({ reviewId }, 'Admin/Manager deleting review');

        try {
            // Get product ID first so we can update aggregation
            const { data: review, error: fetchError } = await supabase
                .from('reviews')
                .select('productId')
                .eq('id', reviewId)
                .single();

            if (fetchError) throw fetchError;

            const { error: deleteError } = await supabase
                .from('reviews')
                .delete()
                .eq('id', reviewId);

            if (deleteError) throw deleteError;

            // Update aggregation
            this.updateProductRatingAggregation(review.product_id).catch(err => {
                logger.error({ err, productId: review.product_id }, 'RATING_AGGREGATION_UPDATE_FAILED_AFTER_DELETE');
            });

            logger.info({ reviewId, productId: review.product_id }, 'REVIEW_DELETED_SUCCESS');
            return true;
        } catch (error) {
            logger.error({ err: error, reviewId }, 'REVIEW_DELETION_FAILED');
            throw error;
        }
    }

    /**
     * Get all reviews with pagination (Admin)
     */
    static async getAllReviews(page = 1, limit = 10) {
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const { data, count, error } = await supabase
            .from('reviews')
            .select(`
                *,
                profiles:user_id (
                    name,
                    avatar_url
                ),
                products:product_id (
                    title,
                    images
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end);

        if (error) throw error;

        const reviews = data.map(review => ({
            id: review.id,
            productId: review.product_id,
            productName: review.products?.title || 'Unknown Product',
            productImage: review.products?.images?.[0] || null,
            userId: review.user_id,
            userName: review.profiles?.name || 'Anonymous',
            userAvatar: review.profiles?.avatar_url,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            verified: review.is_verified,
            createdAt: review.created_at
        }));

        return {
            reviews,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        };
    }

    /**
     * Recalculates and updates rating/ratingCount on products table
     * This ensures high performance for landing pages/listings
     */
    static async updateProductRatingAggregation(productId) {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('rating')
            .eq('product_id', productId);

        if (error) throw error;

        const count = reviews.length;
        const average = count > 0
            ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
            : 0;

        const { error: updateError } = await supabase
            .from('products')
            .update({
                rating: average,
                ratingCount: count,
                reviewCount: count
            })
            .eq('id', productId);

        if (updateError) {
            throw updateError;
        }

        logger.info({ productId, average, count }, 'PRODUCT_RATING_AGGREGATED');
    }
}

module.exports = ReviewService;
