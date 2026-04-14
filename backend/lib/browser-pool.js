/**
 * Browser Pool
 *
 * Manages a single shared Puppeteer browser instance across the entire process.
 * Eliminates the per-request Chromium launch overhead (100–300 MB each) that
 * was the primary cause of memory spikes.
 *
 * Usage:
 *   const BrowserPool = require('../lib/browser-pool');
 *   const pdf = await BrowserPool.withPage(async (page) => {
 *       await page.setContent(html);
 *       return page.pdf({ format: 'A4' });
 *   });
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

// Chromium launch arguments optimised for low-memory container environments
const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // Avoids /dev/shm exhaustion in containers
    '--disable-gpu',
    '--no-zygote',              // Reduces child-process overhead
    '--single-process',         // Further reduces RAM at slight stability cost (acceptable for server-side PDF)
];

// How long to wait for a new page to be ready before timing out
const PAGE_TIMEOUT_MS = 60_000;

let _browser = null;
let _launching = null; // In-flight launch promise to prevent concurrent launches

/**
 * Returns or lazily creates the shared Chromium browser instance.
 * Thread-safe: concurrent callers share the same launch promise.
 */
async function getBrowser() {
    // Reuse existing healthy browser
    if (_browser) {
        try {
            // Quick liveness check — will throw if browser is gone
            const pages = await _browser.pages();
            void pages; // suppress unused var warning
            return _browser;
        } catch {
            logger.warn('[BrowserPool] Existing browser became unreachable, relaunching…');
            _browser = null;
        }
    }

    // Deduplicate concurrent launch requests
    if (_launching) {
        return _launching;
    }

    logger.info('[BrowserPool] Launching shared Chromium browser…');

    _launching = puppeteer
        .launch({
            headless: 'new',
            args: LAUNCH_ARGS,
        })
        .then((browser) => {
            _browser = browser;
            _launching = null;

            // Auto-restart on unexpected disconnect
            browser.on('disconnected', () => {
                logger.warn('[BrowserPool] Browser disconnected unexpectedly — will relaunch on next request');
                _browser = null;
            });

            logger.info('[BrowserPool] Shared Chromium browser ready');
            return browser;
        })
        .catch((err) => {
            _launching = null;
            logger.error({ err }, '[BrowserPool] Failed to launch Chromium browser');
            throw err;
        });

    return _launching;
}

/**
 * Opens a fresh page on the shared browser, runs `fn(page)`, then closes
 * the page.  The browser itself is kept alive for subsequent calls.
 *
 * @template T
 * @param {(page: import('puppeteer').Page) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withPage(fn) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set a generous navigation timeout to avoid hanging on complex HTML
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    try {
        return await fn(page);
    } finally {
        // Always close the page, even if fn throws — the browser lives on
        await page.close().catch((err) => {
            logger.warn({ err }, '[BrowserPool] Failed to close page after use');
        });
    }
}

/**
 * Gracefully shuts down the browser.
 * Called from server graceful-shutdown logic.
 */
async function shutdown() {
    if (_browser) {
        logger.info('[BrowserPool] Closing shared Chromium browser…');
        try {
            await _browser.close();
        } catch (err) {
            logger.warn({ err }, '[BrowserPool] Error while closing browser during shutdown');
        } finally {
            _browser = null;
        }
    }
}

module.exports = { withPage, shutdown };
