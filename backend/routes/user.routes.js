const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all users - Admin/Manager only
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(users);
    } catch (error) {
        logger.error({ err: error }, 'Get Users Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Block/Unblock a user - Admin/Manager only
router.post('/:id/block', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;

        if (typeof isBlocked !== 'boolean') {
            return res.status(400).json({ error: req.t('errors.user.isBlockedBoolean') });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ is_blocked: isBlocked })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: isBlocked ? req.t('success.user.blocked') : req.t('success.user.unblocked'), user: data });
    } catch (error) {
        logger.error({ err: error }, 'Error blocking/unblocking user:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
