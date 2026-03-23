const express = require('express');
const router = express.Router();
const translationService = require('../services/translation.service');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
    try {
        const { text, targetLang } = req.body;

        if (!text) {
            return res.json({ translatedText: text });
        }

        if (!targetLang || targetLang === 'en') {
            return res.json({ translatedText: text });
        }

        const translatedText = await translationService.translateText(text, targetLang);
        res.json({ translatedText });
    } catch (error) {
        logger.error({ err: error, text: req.body.text }, 'Error in translate endpoint');
        res.status(500).json({ error: 'Translation failed', translatedText: req.body.text });
    }
});

module.exports = router;
