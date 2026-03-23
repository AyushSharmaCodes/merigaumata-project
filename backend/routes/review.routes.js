const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createReviewSchema } = require('../schemas/review.schema');
const ReviewService = require('../services/review.service');

/**
 * GET /api/reviews/product/:productId
 * Get reviews for a product (Public)
 */
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await ReviewService.getProductReviews(productId);
        res.json(reviews);
    } catch (error) {
        // Detailed logging happens inside service
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * GET /api/reviews
 * Get all reviews (Admin/Manager only)
 */
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await ReviewService.getAllReviews(page, limit);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
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
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * DELETE /api/reviews/:id
 * Delete a review (Admin/Manager only)
 */
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        await ReviewService.deleteReview(id);
        res.json({ success: true, message: req.t('success.review.deleted') });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

module.exports = router;

