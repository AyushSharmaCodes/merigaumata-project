const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { CONTACT } = require('../constants/messages');

class ContactService {
    /**
     * Create a new contact message
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.email
     * @param {string} data.message
     * @param {string} [data.ipAddress]
     * @param {string} [data.userAgent]
     * @returns {Promise<Object>} Created message
     */
    async createMessage({ name, email, message, ipAddress, userAgent }) {
        try {
            const { data: newMessage, error } = await supabase
                .from('contact_messages')
                .insert([{
                    name,
                    email,
                    message,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    status: 'NEW'
                }])
                .select()
                .single();

            if (error) throw error;

            logger.info({ messageId: newMessage.id }, CONTACT.CREATE_SUCCESS);
            return newMessage;
        } catch (error) {
            logger.error({ err: error, email }, CONTACT.CREATE_FAILED);
            throw error;
        }
    }

    /**
     * Update message status
     * @param {string} id
     * @param {string} status
     * @returns {Promise<Object>} Updated message
     */
    async updateStatus(id, status) {
        try {
            const { data, error, count } = await supabase
                .from('contact_messages')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                logger.warn({ id, status }, CONTACT.UPDATE_MATCH_ERROR);
                return null;
            }

            return data[0];
        } catch (error) {
            logger.error({ err: error, id, status }, CONTACT.UPDATE_FAILED);
            throw error;
        }
    }
    /**
     * Get all contact messages
     * @returns {Promise<Array>} List of messages
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('contact_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error }, CONTACT.FETCH_MESSAGES_ERROR);
            throw error;
        }
    }

    /**
     * Get contact message by ID
     * @param {string} id
     * @returns {Promise<Object>} Message details
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('contact_messages')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error, id }, CONTACT.FETCH_DETAIL_ERROR);
            throw error;
        }
    }
}

module.exports = new ContactService();
