const { z } = require('zod');
const logger = require('../utils/logger');
const contactService = require('../services/contact.service');
const emailService = require('../services/email');
const AdminAlertService = require('../services/admin-alert.service');
const { CONTACT, VALIDATION, COMMON, SYSTEM } = require('../constants/messages');

// Validation schema
const contactSchema = z.object({
    name: z.string().min(1, VALIDATION.NAME_REQUIRED).max(100),
    email: z.string().email(VALIDATION.EMAIL_INVALID),
    message: z.string().min(10, VALIDATION.MESSAGE_MIN_LENGTH).max(2000)
});

exports.submitContactForm = async (req, res, next) => {
    try {
        // 1. Validation
        const validatedData = contactSchema.parse(req.body);

        // 2. Extract client info
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        logger.info({ email: validatedData.email }, CONTACT.PROCESSING_SUBMISSION);

        // 3. Store in Database
        const message = await contactService.createMessage({
            ...validatedData,
            ipAddress,
            userAgent
        });

        // 3.5. Trigger Admin Alert (Persistent on Dashboard)
        AdminAlertService.createAlert({
            type: 'contact_message',
            reference_id: message.id,
            title: CONTACT.NEW_MESSAGE_ALERT,
            content: validatedData.message.substring(0, 100) + (validatedData.message.length > 100 ? '...' : ''),
            priority: 'medium',
            metadata: {
                email: validatedData.email,
                name: validatedData.name
            }
        }).catch(err => logger.error({ err }, CONTACT.ALERT_CREATE_FAILED));

        // 4. Send Internal Notification (Async - don't block response)
        // We catch errors here to ensure API still returns success to user if DB save worked
        emailService.sendContactNotification(message).catch(err => {
            logger.error({ err, messageId: message.id }, CONTACT.INTERNAL_NOTIFY_FAILED);
        });

        // 5. Send Auto-Reply (Async)
        const lang = req.get('x-user-lang') || 'en';
        emailService.sendContactAutoReply(validatedData.email, validatedData.name, lang).catch(err => {
            logger.error({ err, email: validatedData.email }, CONTACT.AUTO_REPLY_FAILED);
        });

        // 6. Return Success
        res.status(201).json({
            success: true,
            message: COMMON.CONTACT_RECEIVED,
            data: {
                id: message.id
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: SYSTEM.VALIDATION_ERROR,
                errors: error.errors
            });
        }
        next(error);
    }
};
exports.getMessages = async (req, res) => {
    try {
        const messages = await contactService.getAll();
        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        logger.error({ err: error }, CONTACT.FETCH_MESSAGES_ERROR);
        res.status(500).json({ error: SYSTEM.INTERNAL_ERROR });
    }
};

exports.getMessageDetail = async (req, res) => {
    try {
        const messageId = req.params.id;
        logger.info({ messageId }, CONTACT.FETCH_DETAIL_INIT);
        const message = await contactService.getById(messageId);
        if (message) logger.info({ messageId }, CONTACT.FETCH_DETAIL_SUCCESS);
        else logger.info({ messageId }, CONTACT.NO_MESSAGE_FOUND);

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error({ err: error, id: req.params.id }, CONTACT.FETCH_DETAIL_ERROR);
        res.status(500).json({ error: SYSTEM.INTERNAL_ERROR, details: error.message });
    }
};

exports.updateMessageStatus = async (req, res) => {
    try {
        const messageId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, error: SYSTEM.VALIDATION_ERROR });
        }

        await contactService.updateStatus(messageId, status);

        if (status === 'READ') {
            logger.info({ messageId }, CONTACT.SYNC_ALERT_STATUS);
            await AdminAlertService.markAsReadByReference('contact_message', messageId).catch(err => {
                logger.error({ err, messageId }, CONTACT.SYNC_ALERT_FAILED);
            });
        }

        const updatedMessage = await contactService.getById(messageId);

        res.json({
            success: true,
            data: updatedMessage
        });
    } catch (error) {
        logger.error({ err: error, id: req.params.id }, 'CONTACT_UPDATE_STATUS_ERROR');
        res.status(500).json({ error: SYSTEM.INTERNAL_ERROR, details: error.message });
    }
};
