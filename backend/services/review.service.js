const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { LOGS, REVIEWS } = require('../constants/messages');

/**
 * Review Service
 * Handles business logic, purchase verification, and rating aggregation for product reviews.
 */
class ReviewService {
    static normalizeReviewRecord(review) {
        return {
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
        };
    }

    static async ensureProductExists(productId) {
        // Validate UUID format to prevent database crashes on malformed input (e.g. "undefined")
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!productId || typeof productId !== 'string' || !uuidRegex.test(productId)) {
            const error = new Error('Invalid Product ID format');
            error.status = 400;
            throw error;
        }

        const { data: product, error } = await supabase
            .from('products')
            .select('id')
            .eq('id', productId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!product) {
            const notFoundError = new Error(REVIEWS.NOT_FOUND);
            notFoundError.status = 404;
            throw notFoundError;
        }
    }

    static async hasVerifiedPurchase(userId, productId) {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                items,
                order_items (
                    product_id
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'delivered')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            logger.warn({ err: error, userId, productId }, 'PURCHASE_VERIFICATION_ERROR_IGNORED');
            return false;
        }

        const normalizedProductId = String(productId);

        return (orders || []).some((order) => {
            const relationalMatch = Array.isArray(order.order_items) && order.order_items.some(
                (item) => String(item?.product_id) === normalizedProductId
            );

            if (relationalMatch) {
                return true;
            }

            if (!Array.isArray(order.items)) {
                return false;
            }

            return order.items.some((item) => {
                const candidateId = item?.product_id ?? item?.productId ?? item?.product?.id ?? null;
                return candidateId ? String(candidateId) === normalizedProductId : false;
            });
        });
    }

    /**
     * Get reviews for a specific product
     */
    static async getProductReviews(productId, { page = 1, limit = 5 } = {}) {
        logger.debug({ productId, page, limit }, 'Fetching reviews for product');
        
        // 1. Validate UUID format and check existence
        await this.ensureProductExists(productId);

        const safePage = Math.max(1, page);
        const safeLimit = Math.max(1, limit);

        // 2. Optimized RPC for reviews + distribution + total count
        const { data, error } = await supabase.rpc('get_product_reviews_paginated_v2', {
            p_product_id: productId,
            p_page: safePage,
            p_limit: safeLimit
        });

        if (error) {
            logger.error({ err: error, productId }, 'REVIEWS_FETCH_RPC_FAILED');
            throw error;
        }

        const { reviews: rawReviews, totalCount, distribution } = data;
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...(distribution || {}) };

        // 3. Normalize for frontend
        const reviews = (rawReviews || []).map(rev => ({
            id: rev.id,
            productId: rev.product_id,
            userId: rev.user_id,
            userName: rev.user_name || 'Anonymous',
            userAvatar: rev.user_avatar,
            rating: rev.rating,
            title: rev.title,
            comment: rev.comment,
            verified: rev.is_verified,
            createdAt: rev.created_at
        }));

        const totalReviews = totalCount || 0;
        const weightedTotal = Object.entries(counts).reduce(
            (sum, [stars, reviewCount]) => sum + (Number(stars) * reviewCount),
            0
        );

        const averageRating = totalReviews > 0
            ? Number((weightedTotal / totalReviews).toFixed(1))
            : 0;

        return {
            reviews,
            total: totalReviews,
            page: safePage,
            totalPages: Math.max(1, Math.ceil(totalReviews / safeLimit)),
            summary: {
                averageRating,
                totalReviews,
                ratingDistribution: [5, 4, 3, 2, 1].map((stars) => ({
                    stars,
                    count: counts[stars] || 0,
                    percentage: totalReviews > 0 ? ((counts[stars] || 0) / totalReviews) * 100 : 0
                }))
            }
        };
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
            await this.ensureProductExists(productId);

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
            const isVerified = await this.hasVerifiedPurchase(userId, productId);
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

            if (insertError) {
                const duplicateReviewViolation = insertError.code === '23505'
                    && String(insertError.message || '').toLowerCase().includes('review');

                if (duplicateReviewViolation) {
                    const duplicateError = new Error(REVIEWS.ALREADY_REVIEWED);
                    duplicateError.status = 400;
                    throw duplicateError;
                }

                throw insertError;
            }

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
                .select('product_id')
                .eq('id', reviewId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!review) {
                const notFoundError = new Error(REVIEWS.NOT_FOUND);
                notFoundError.status = 404;
                throw notFoundError;
            }

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
    static async getAllReviews({ page = 1, limit = 10, search = '' } = {}) {
        const safePage = Math.max(1, page);
        const safeLimit = Math.max(1, limit);
        const start = (safePage - 1) * safeLimit;
        const end = start + safeLimit - 1;

        let query = supabase
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
            .order('created_at', { ascending: false });

        if (search) {
            const sanitizedSearch = search.replace(/[%_]/g, '');
            query = query.or([
                `title.ilike.%${sanitizedSearch}%`,
                `comment.ilike.%${sanitizedSearch}%`
            ].join(','));
        }

        const { data, count, error } = await query.range(start, end);

        if (error) throw error;

        const reviews = (data || []).map(review => ({
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
            total: count || 0,
            page: safePage,
            totalPages: Math.max(1, Math.ceil((count || 0) / safeLimit))
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
