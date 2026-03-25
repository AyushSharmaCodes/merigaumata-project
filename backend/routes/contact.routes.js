const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const rateLimit = require('express-rate-limit');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');

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


router.post('/', contactLimiter, requestLock('contact-form-submit'), idempotency(), contactController.submitContactForm);

// Admin Routes
router.get('/', authenticateToken, checkPermission('can_manage_contact_messages'), contactController.getMessages);
router.get('/:id', authenticateToken, checkPermission('can_manage_contact_messages'), contactController.getMessageDetail);
router.patch('/:id/status', authenticateToken, checkPermission('can_manage_contact_messages'), requestLock((req) => `contact-message-status:${req.params.id}`), idempotency(), contactController.updateMessageStatus);

module.exports = router;
