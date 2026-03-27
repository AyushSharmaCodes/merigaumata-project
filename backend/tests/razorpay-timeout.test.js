const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');

describe('wrapRazorpayWithTimeout', () => {
    test('times out deeply nested Razorpay methods with ETIMEDOUT', async () => {
        const neverSettles = new Promise(() => {});
        const razorpay = {
            subscriptions: {
                pause: jest.fn().mockReturnValue(neverSettles)
            }
        };

        const wrapped = wrapRazorpayWithTimeout(razorpay, 5);

        await expect(wrapped.subscriptions.pause('sub_123', { pause_at: 'now' })).rejects.toMatchObject({
            code: 'ETIMEDOUT',
            timeout: 5
        });
    });

    test('passes through successful nested Razorpay calls', async () => {
        const razorpay = {
            qrCode: {
                create: jest.fn().mockResolvedValue({ id: 'qr_123' })
            }
        };

        const wrapped = wrapRazorpayWithTimeout(razorpay, 50);

        await expect(wrapped.qrCode.create({ usage: 'multiple_use' })).resolves.toEqual({ id: 'qr_123' });
        expect(razorpay.qrCode.create).toHaveBeenCalledWith({ usage: 'multiple_use' });
    });
});
