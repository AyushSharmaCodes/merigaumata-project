const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdminOrManager } = require('../middleware/adminOnly.middleware');
const multer = require('multer');

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(req.t('errors.upload.invalidPolicyFileType')));
        }
    }
});

// Admin routes
router.post(
    '/upload',
    authenticateToken,
    requireAdminOrManager,
    upload.single('file'),
    policyController.uploadPolicy
);

router.get(
    '/admin/:policyType/languages',
    authenticateToken,
    requireAdminOrManager,
    policyController.getAllLanguageVersions
);

// Public routes
router.get('/public/:policyType/version', policyController.getPolicyVersion);
router.get('/public/:policyType', policyController.getPublicPolicy);

module.exports = router;
