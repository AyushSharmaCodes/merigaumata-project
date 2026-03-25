const express = require('express');
const router = express.Router();
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const EventService = require('../services/event.service');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all events
router.get('/', async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;
        const result = await EventService.getAllEvents({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 15,
            search: search || '',
            status: status || 'all',
            lang: req.language
        });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: getFriendlyMessage(error, error.statusCode || 500) });
    }
});

// Get single event
router.get('/:id', async (req, res) => {
    try {
        const event = await EventService.getEventById(req.params.id, req.language);
        res.json(event);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: getFriendlyMessage(error, error.statusCode || 500) });
    }
});

// Create event - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_events'), requestLock('event-create'), idempotency(), async (req, res) => {
    try {
        const event = await EventService.createEvent(req.body);
        res.status(201).json(event);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: getFriendlyMessage(error, error.statusCode || 500) });
    }
});

// Update event - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_events'), requestLock((req) => `event-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const event = await EventService.updateEvent(req.params.id, req.body);
        res.json(event);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: getFriendlyMessage(error, error.statusCode || 500) });
    }
});

// Delete event - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_events'), requestLock((req) => `event-delete:${req.params.id}`), async (req, res) => {
    try {
        await EventService.deleteEvent(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: getFriendlyMessage(error, error.statusCode || 500) });
    }
});

module.exports = router;
