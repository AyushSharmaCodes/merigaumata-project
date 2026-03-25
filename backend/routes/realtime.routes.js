const express = require('express');
const realtimeService = require('../services/realtime.service');
const { optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/stream', optionalAuth, (req, res) => {
    const requestedTopics = realtimeService.parseTopics(req.query.topics);
    const validation = realtimeService.validateTopics(requestedTopics, req.user);

    if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    res.write('retry: 5000\n\n');
    realtimeService.registerClient(req, res, validation.topics);
});

module.exports = router;
