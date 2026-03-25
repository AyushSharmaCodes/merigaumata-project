require('dotenv').config();

const AuthService = require('./services/auth.service');

async function run() {
    const email = process.env.DEBUG_AUTH_EMAIL;
    const otp = process.env.DEBUG_AUTH_OTP;

    if (!email || !otp) {
        throw new Error('Set DEBUG_AUTH_EMAIL and DEBUG_AUTH_OTP to use this helper.');
    }

    const result = await AuthService.verifyLoginOtp(email, otp, {
        userAgent: 'debug-script',
        ipAddress: '127.0.0.1'
    });

    console.log(JSON.stringify({
        user: result.user,
        tokens: result.tokens
    }, null, 2));
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
