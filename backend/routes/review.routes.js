const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticateToken, requireRole, checkPermission } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createReviewSchema } = require('../schemas/review.schema');
const ReviewService = require('../services/review.service');
const { getFriendlyMessage } = require('../utils/error-messages');

/**
 * GET /api/reviews/product/:productId
 * Get reviews for a product (Public)
 */
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
        const reviews = await ReviewService.getProductReviews(productId, { page, limit });
        res.json(reviews);
    } catch (error) {
        logger.error({ err: error, productId: req.params.productId }, 'Failed to fetch product reviews');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * GET /api/reviews
 * Get all reviews (Admin/Manager only)
 */
router.get('/', authenticateToken, checkPermission('can_manage_reviews'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        const result = await ReviewService.getAllReviews({ page, limit, search });
        res.json(result);
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch all reviews');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/reviews
 * Create a new review (Authenticated)
 * Validates purchase and updates product ratings
 */
router.post('/', authenticateToken, validate(createReviewSchema), async (req, res) => {
    try {
        // Ensure user is only reviewing as themselves
        if (req.body.userId !== req.user.id) {
            return res.status(403).json({ error: req.t('errors.review.ownAccountOnly') });
        }

        const review = await ReviewService.createReview(req.body);
        res.status(201).json({
            success: true,
            message: req.t('success.review.submitted'),
            data: review
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id, body: req.body }, 'Failed to create review');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * DELETE /api/reviews/:id
 * Delete a review (Admin/Manager only)
 */
router.delete('/:id', authenticateToken, checkPermission('can_manage_reviews'), async (req, res) => {
    try {
        const { id } = req.params;
        await ReviewService.deleteReview(id);
        res.json({ success: true, message: req.t('success.review.deleted') });
    } catch (error) {
        logger.error({ err: error, reviewId: req.params.id }, 'Failed to delete review');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
