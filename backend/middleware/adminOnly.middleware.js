const AuthMessages = require('../constants/messages/AuthMessages');

/**
 * Middleware to ensure user has admin or manager role
 */
const requireAdminOrManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
    }

    const allowedRoles = ['admin', 'manager'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: AuthMessages.INSUFFICIENT_PERMISSIONS });
    }

    next();
};

module.exports = {
    requireAdminOrManager
};
