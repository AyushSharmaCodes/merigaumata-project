const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const rateLimit = require('express-rate-limit');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

// Rate limiting specific to contact form
// Prevent spam: 5 requests per hour per IP
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: (req) => ({
        success: false,
        message: req.t('errors.rateLimit.contactForm')
    }),
    standardHeaders: true,
    legacyHeaders: false,
});


router.post('/', contactLimiter, contactController.submitContactForm);

// Admin Routes
router.get('/', authenticateToken, authorizeRole('admin', 'manager'), contactController.getMessages);
router.get('/:id', authenticateToken, authorizeRole('admin', 'manager'), contactController.getMessageDetail);
router.patch('/:id/status', authenticateToken, authorizeRole('admin', 'manager'), contactController.updateMessageStatus);

module.exports = router;
