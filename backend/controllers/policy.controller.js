const policyService = require('../services/policy.service');
const logger = require('../utils/logger');

const PolicyMessages = require('../constants/messages/PolicyMessages');

exports.uploadPolicy = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: PolicyMessages.NO_FILE_UPLOADED });
        }
        const { policyType, title } = req.body;

        // Basic validation
        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: PolicyMessages.INVALID_POLICY_TYPE });
        }

        let policyTitle = title;
        if (!policyTitle) {
            if (policyType === 'shipping-refund') {
                policyTitle = PolicyMessages.SHIPPING_REFUND_TITLE;
            } else if (policyType === 'privacy') {
                policyTitle = PolicyMessages.PRIVACY_POLICY_TITLE;
            } else if (policyType === 'terms') {
                policyTitle = PolicyMessages.TERMS_CONDITIONS_TITLE;
            } else {
                policyTitle = PolicyMessages.GENERIC_POLICY_TITLE;
            }
        }

        const policy = await policyService.uploadPolicy(
            req.file,
            policyType,
            policyTitle,
            req.user.id
        );

        res.status(201).json({
            message: PolicyMessages.POLICY_UPLOADED,
            policy: {
                policyType: policy.policy_type,
                version: policy.version,
                contentHtml: policy.content_html,
                title: policy.title,
                updatedAt: policy.updated_at
            }
        });
    } catch (error) {
        logger.error({ err: error }, PolicyMessages.LOG_UPLOAD_ERROR);
        next(error);
    }
};

exports.getPublicPolicy = async (req, res, next) => {
    try {
        const { policyType } = req.params;

        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: PolicyMessages.INVALID_POLICY_TYPE });
        }

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const policy = await policyService.getActivePolicy(policyType, lang);

        if (!policy) {
            return res.status(404).json({ error: PolicyMessages.POLICY_NOT_FOUND });
        }

        res.json({
            policyType: policy.policy_type,
            version: policy.version,
            contentHtml: policy.content_html,
            title: policy.title,
            updatedAt: policy.updated_at
        });
    } catch (error) {
        logger.error({ err: error }, PolicyMessages.LOG_GET_ERROR);
        next(error);
    }
};

exports.getPolicyVersion = async (req, res, next) => {
    try {
        const { policyType } = req.params;

        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: PolicyMessages.INVALID_POLICY_TYPE });
        }

        const policy = await policyService.getActivePolicy(policyType);

        if (!policy) {
            return res.status(404).json({ error: PolicyMessages.POLICY_NOT_FOUND });
        }

        res.json({ version: policy.version });
    } catch (error) {
        logger.error({ err: error }, PolicyMessages.LOG_VERSION_ERROR);
        next(error);
    }
};

exports.getAllLanguageVersions = async (req, res, next) => {
    try {
        const { policyType } = req.params;

        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: PolicyMessages.INVALID_POLICY_TYPE });
        }

        const policy = await policyService.getActivePolicy(policyType);

        if (!policy) {
            return res.status(404).json({ error: PolicyMessages.POLICY_NOT_FOUND });
        }

        res.json({
            policyType: policy.policy_type,
            titleI18n: policy.title_i18n,
            contentHtmlI18n: policy.content_html_i18n,
            updatedAt: policy.updated_at
        });
    } catch (error) {
        logger.error({ err: error }, PolicyMessages.LOG_GET_ERROR);
        next(error);
    }
};
