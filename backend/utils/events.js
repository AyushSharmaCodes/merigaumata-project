const EventEmitter = require('events');

/**
 * Backend Central Event Bus
 */
class AppEmitter extends EventEmitter {}

const appEmitter = new AppEmitter();

module.exports = appEmitter;
