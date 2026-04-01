/**
 * Jest Test Setup
 * Runs before each test file
 */

// Load environment variables from .env for testing
require('dotenv').config();

// Override environment for testing
process.env.NODE_ENV = 'test';

const { installExpressAsyncErrors } = require('../utils/install-express-async-errors');
installExpressAsyncErrors();

// Mock logger to reduce noise during tests
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
    // Allow any pending async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
});
