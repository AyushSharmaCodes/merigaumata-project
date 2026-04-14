const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const multer = require('multer');

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — industry standard for policy docs
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
    checkPermission('can_manage_policies'),
    requestLock('policy-upload'),
    idempotency(),
    upload.single('file'),
    policyController.uploadPolicy
);

router.get(
    '/admin/:policyType/languages',
    authenticateToken,
    checkPermission('can_manage_policies'),
    policyController.getAllLanguageVersions
);

// Public routes
router.get('/public/:policyType/version', policyController.getPolicyVersion);
router.get('/public/:policyType', policyController.getPublicPolicy);

module.exports = router;
