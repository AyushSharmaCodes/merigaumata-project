const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate.middleware');
const { addToCartSchema, updateCartSchema, applyCouponSchema } = require('../schemas/cart.schema');
const {
    getUserCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    applyCouponToCart,
    removeCouponFromCart,
    calculateCartTotals,
    clearCart
} = require('../services/cart.service');
const logger = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth.middleware');

/**
 * Cart Routes
 * User-authenticated endpoints for managing shopping cart
 * Note: All routes require authentication and use user_id from auth middleware or header
 */


// Use optional authentication - guests are allowed
router.use(optionalAuth);

// Helper to get User ID or Guest ID
const getContextIds = (req) => {
    const userId = req.user?.id;
    // Guest ID from header (x-guest-id) or cookie (guest_id)
    const guestId = req.headers['x-guest-id'] || req.cookies?.guest_id;
    return { userId, guestId };
};

// Start Cart Routes
// Note: All service functions now accept ({ userId, guestId }) object or similar arguments
// but to minimize service signature changes, we might pass both or overload the first arg?
// Decision: Update Service to accept `userId` (string|null) and `guestId` (string|null).
// Or better: Pass an object context?
// Let's look at service: `getUserCart(userId)`
// I will update service to `getUserCart(userId, guestId)`

// Get user's cart with items and totals
router.get('/', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(400).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const cart = await getUserCart(userId, guestId);
        const totals = await calculateCartTotals(userId, guestId);

        res.json({
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching cart');
        res.status(500).json({ error: error.message });
    }
});

// Add item to cart
router.post('/items', validate(addToCartSchema), async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(400).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { product_id, quantity, variant_id } = req.body; // Added variant_id support if missing in schema? Schema handles it?
        // Note: The schema needs to support optional variant_id if not already

        const cart = await addToCart(userId, guestId, product_id, quantity, variant_id);
        const totals = await calculateCartTotals(userId, guestId);

        res.json({
            message: req.t('success.cart.itemAdded'),
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error adding to cart');
        res.status(500).json({ error: error.message });
    }
});

// Update cart item quantity
router.put('/items/:product_id', validate(updateCartSchema), async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { product_id } = req.params;
        const { quantity } = req.body;
        let { variant_id } = req.query; // Support variant_id in query for updates

        if (variant_id === 'undefined') {
            variant_id = null;
        }

        const cart = await updateCartItem(userId, guestId, product_id, quantity, variant_id);
        // OPTIMIZATION: Skip full coupon validation on quantity changes, just recalculate discount
        const totals = await calculateCartTotals(userId, guestId, null, { skipValidation: true });

        res.json({
            message: req.t('success.cart.cartUpdated'),
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error updating cart item');
        res.status(500).json({ error: error.message });
    }
});

// Remove item from cart
router.delete('/items/:product_id', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { product_id } = req.params;
        let { variant_id } = req.query;

        if (variant_id === 'undefined') {
            variant_id = null;
        }

        const cart = await removeFromCart(userId, guestId, product_id, variant_id);
        const totals = await calculateCartTotals(userId, guestId);

        res.json({
            message: req.t('success.cart.itemRemoved'),
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error removing from cart');
        res.status(500).json({ error: error.message });
    }
});

// Apply coupon to cart
router.post('/apply-coupon', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: req.t('errors.payment.invalidCoupon') });
        }

        const result = await applyCouponToCart(userId, guestId, code);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const totals = await calculateCartTotals(userId, guestId);

        res.json({
            message: result.message,
            cart: result.cart,
            coupon: result.coupon,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error applying coupon');
        res.status(500).json({ error: error.message });
    }
});

// Remove coupon from cart
router.delete('/coupon', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const cart = await removeCouponFromCart(userId, guestId);
        const totals = await calculateCartTotals(userId, guestId);

        res.json({
            message: req.t('success.cart.couponRemoved'),
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error removing coupon');
        res.status(500).json({ error: error.message });
    }
});

// Calculate cart totals (with delivery and discounts)
router.post('/calculate', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const totals = await calculateCartTotals(userId, guestId);

        res.json(totals);
    } catch (error) {
        logger.error({ err: error }, 'Error calculating cart totals');
        res.status(500).json({ error: error.message });
    }
});

// Clear cart (after order is placed)
router.delete('/', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        await clearCart(userId, guestId);

        res.json({ message: req.t('success.cart.cartCleared') });
    } catch (error) {
        logger.error({ err: error }, 'Error clearing cart');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
