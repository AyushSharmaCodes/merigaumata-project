const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { LOGS } = require('../constants/messages');
const realtimeService = require('./realtime.service');

/**
 * Admin Alert Service
 * Handles persistent dashboard alerts for admin users
 */
const AdminAlertService = {
    /**
     * Create a new admin alert
     */
    async createAlert({ type, reference_id, title, content, priority = 'medium', metadata = {} }) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .insert([{
                    type,
                    reference_id,
                    title,
                    content,
                    priority,
                    metadata
                }])
                .select()
                .single();

            if (error) throw error;
            realtimeService.publish({
                topic: 'admin_alerts',
                type: 'admin_alert.created',
                audience: 'staff',
                payload: data
            });
            return data;
        } catch (error) {
            logger.error({ err: error, type, title }, LOGS.ALERT_CREATE_FAIL);
            throw error;
        }
    },

    /**
     * Create an unread alert if one does not already exist for the same reference.
     */
    async createOrUpdateUnreadAlert({ type, reference_id, title, content, priority = 'medium', metadata = {} }) {
        try {
            const { data: existing, error: existingError } = await supabase
                .from('admin_alerts')
                .select('*')
                .eq('type', type)
                .eq('reference_id', reference_id)
                .eq('status', 'unread')
                .maybeSingle();

            if (existingError) throw existingError;

            if (existing) {
                const { data, error } = await supabase
                    .from('admin_alerts')
                    .update({
                        title,
                        content,
                        priority,
                        metadata,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                realtimeService.publish({
                    topic: 'admin_alerts',
                    type: 'admin_alert.updated',
                    audience: 'staff',
                    payload: data
                });
                return data;
            }

            return await this.createAlert({ type, reference_id, title, content, priority, metadata });
        } catch (error) {
            logger.error({ err: error, type, reference_id }, LOGS.ALERT_CREATE_FAIL);
            throw error;
        }
    },

    /**
     * Get unread alerts
     */
    async getUnreadAlerts() {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .select('*')
                .eq('status', 'unread')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error }, LOGS.ALERT_FETCH_UNREAD_FAIL);
            throw error;
        }
    },

    /**
     * Mark alert as read (dismiss)
     */
    async markAsRead(id) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (data) {
                realtimeService.publish({
                    topic: 'admin_alerts',
                    type: 'admin_alert.updated',
                    audience: 'staff',
                    payload: data
                });
            }
            return data;
        } catch (error) {
            logger.error({ err: error, id }, LOGS.ALERT_MARK_READ_FAIL);
            throw error;
        }
    },

    /**
     * Mark all as read
     */
    async markAllAsRead() {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('status', 'unread')
                .select();

            if (error) throw error;
            (data || []).forEach((alert) => {
                realtimeService.publish({
                    topic: 'admin_alerts',
                    type: 'admin_alert.updated',
                    audience: 'staff',
                    payload: alert
                });
            });
            return data;
        } catch (error) {
            logger.error({ err: error }, LOGS.ALERT_MARK_ALL_READ_FAIL);
            throw error;
        }
    },

    /**
     * Mark alert as read by reference ID
     */
    async markAsReadByReference(type, reference_id) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('type', type)
                .eq('reference_id', reference_id)
                .eq('status', 'unread')
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                data.forEach(alert => {
                    realtimeService.publish({
                        topic: 'admin_alerts',
                        type: 'admin_alert.updated',
                        audience: 'staff',
                        payload: alert
                    });
                });
            }
            return data;
        } catch (error) {
            logger.error({ err: error, type, reference_id }, LOGS.ALERT_MARK_REF_READ_FAIL);
            throw error;
        }
    }
};

module.exports = AdminAlertService;
