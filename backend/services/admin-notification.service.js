const { supabaseAdmin: supabase } = require('../lib/supabase');
const logger = require('../utils/logger');

/**
 * Admin Notification Service
 * Handles order notifications for admin users
 */

// Get admin notifications with order details
const getAdminNotifications = async (adminId, filters = {}) => {
    let query = supabase
        .from('order_notifications')
        .select(`
            *,
            orders (
                id,
                orderNumber,
                customerName,
                totalAmount,
                status,
                createdAt
            )
        `)
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

// Get unread notification count
const getUnreadCount = async (adminId) => {
    const { count, error } = await supabase
        .from('order_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', adminId)
        .eq('status', 'unread');

    if (error) throw error;
    return count || 0;
};

// Mark notification as read
const markAsRead = async (notificationId, adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('admin_id', adminId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Mark all as read
const markAllAsRead = async (adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('admin_id', adminId)
        .eq('status', 'unread')
        .select();

    if (error) throw error;
    return data;
};

// Archive notification
const archiveNotification = async (notificationId, adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({ status: 'archived' })
        .eq('id', notificationId)
        .eq('admin_id', adminId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Create notification for all admins (e.g., for new returns/refunds)
const createNotification = async (orderId) => {
    try {
        const { data: admins, error: adminError } = await supabase
            .from('profiles')
            .select(`
                id,
                roles!inner (
                    name
                )
            `)
            .eq('roles.name', 'admin');

        if (adminError) {
            logger.error({ err: adminError }, 'Failed to fetch admins for notification');
            return null;
        }

        if (!admins || admins.length === 0) {
            return null;
        }

        const notifications = admins.map(admin => ({
            order_id: orderId,
            admin_id: admin.id,
            status: 'unread'
        }));

        const { data, error: insertError } = await supabase
            .from('order_notifications')
            .insert(notifications)
            .select();

        if (insertError) {
            logger.error({ err: insertError, orderId }, 'Failed to insert admin notifications');
            return null;
        }

        return data;
    } catch (err) {
        logger.error({ err, orderId }, 'Error in createNotification');
        return null;
    }
};

module.exports = {
    getAdminNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    createNotification
};
