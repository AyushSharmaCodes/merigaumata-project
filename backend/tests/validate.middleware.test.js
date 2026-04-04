const { z } = require('zod');
const validate = require('../middleware/validate.middleware');

describe('validate middleware', () => {
    test('returns the field message directly when there is a single validation error', () => {
        const middleware = validate(z.object({
            email: z.string().email('Please enter a valid email address.')
        }));

        const req = {
            body: { email: 'not-an-email' },
            path: '/api/auth/register'
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        middleware(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Please enter a valid email address.',
            code: 'VALIDATION_ERROR',
            details: [
                {
                    field: 'email',
                    message: 'Please enter a valid email address.'
                }
            ]
        });
    });
});
