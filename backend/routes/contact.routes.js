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
    message: {
        success: false,
        message: 'Too many messages sent from this IP, please try again after an hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


router.post('/', contactLimiter, contactController.submitContactForm);

// Admin Routes
router.get('/', authenticateToken, authorizeRole('admin', 'manager'), contactController.getMessages);
router.get('/:id', authenticateToken, authorizeRole('admin', 'manager'), contactController.getMessageDetail);

module.exports = router;
