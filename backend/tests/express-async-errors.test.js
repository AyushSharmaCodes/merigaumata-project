const Layer = require('express/lib/router/layer');

describe('express async error installation', () => {
    test('forwards rejected async route handlers to next(err)', async () => {
        const expectedError = Object.assign(new Error('Async route failed'), {
            statusCode: 418,
            code: 'ASYNC_ROUTE_FAILED'
        });

        const layer = new Layer('/boom', {}, async (req, res, next) => {
            throw expectedError;
        });

        await new Promise((resolve, reject) => {
            layer.handle_request(
                { method: 'GET', url: '/boom' },
                {},
                (error) => {
                    try {
                        expect(error).toBe(expectedError);
                        resolve();
                    } catch (assertionError) {
                        reject(assertionError);
                    }
                }
            );
        });
    });

    test('forwards rejected async error middleware to next(err)', async () => {
        const originalError = new Error('Initial failure');
        const expectedError = Object.assign(new Error('Async error middleware failed'), {
            code: 'ASYNC_ERROR_MIDDLEWARE_FAILED'
        });

        const layer = new Layer('/boom', {}, async (err, req, res, next) => {
            expect(err).toBe(originalError);
            throw expectedError;
        });

        await new Promise((resolve, reject) => {
            layer.handle_error(
                originalError,
                { method: 'GET', url: '/boom' },
                {},
                (error) => {
                    try {
                        expect(error).toBe(expectedError);
                        resolve();
                    } catch (assertionError) {
                        reject(assertionError);
                    }
                }
            );
        });
    });
});
