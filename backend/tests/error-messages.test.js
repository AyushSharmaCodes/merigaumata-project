const { z } = require('zod');
const { getErrorInfo } = require('../utils/error-messages');

describe('getErrorInfo', () => {
    test('maps RLS violations to a clear permission error', () => {
        const error = {
            code: '42501',
            message: 'new row violates row-level security policy for table "orders"',
            hint: 'Use the owner account'
        };

        expect(getErrorInfo(error, 500)).toEqual(expect.objectContaining({
            statusCode: 403,
            code: 'RLS_VIOLATION',
            message: 'You do not have permission to perform this action.',
            details: expect.objectContaining({
                reason: 'This action was blocked by database access rules.',
                hint: 'Use the owner account'
            })
        }));
    });

    test('maps duplicate key violations to a field-specific message', () => {
        const error = {
            code: '23505',
            message: 'duplicate key value violates unique constraint "profiles_email_key"',
            details: 'Key (email)=(test@example.com) already exists.'
        };

        expect(getErrorInfo(error, 409)).toEqual(expect.objectContaining({
            statusCode: 409,
            code: 'DUPLICATE_RECORD',
            message: 'Email already exists.',
            details: expect.objectContaining({
                field: 'email',
                value: 'test@example.com'
            })
        }));
    });

    test('surfaces zod validation issues with field details', () => {
        const schema = z.object({
            email: z.string().email('Please enter a valid email address.'),
            age: z.number().min(18, 'You must be at least 18 years old.')
        });

        const result = schema.safeParse({
            email: 'invalid',
            age: 16
        });

        expect(result.success).toBe(false);
        expect(getErrorInfo(result.error, 400)).toEqual(expect.objectContaining({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Please correct the highlighted fields and try again.',
            details: [
                { field: 'email', message: 'Please enter a valid email address.' },
                { field: 'age', message: 'You must be at least 18 years old.' }
            ]
        }));
    });
});
