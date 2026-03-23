const { z } = require('zod');

const passwordValidation = z.string()
    .min(8, 'errors.auth.passwordMinLength')
    .regex(/[a-z]/, 'errors.auth.passwordLowercase')
    .regex(/[A-Z]/, 'errors.auth.passwordUppercase')
    .regex(/[0-9]/, 'errors.auth.passwordNumber')
    .regex(/[^a-zA-Z0-9]/, 'errors.auth.passwordSpecial');

const loginSchema = z.object({
    email: z.string().email('errors.auth.invalidEmail'),
    password: z.string().min(1, 'errors.auth.passwordRequired')
});

const registerSchema = z.object({
    email: z.string().email('errors.auth.invalidEmail'),
    password: passwordValidation,
    name: z.string().min(2, 'errors.auth.nameMinLength'),
    phone: z.string().optional(),
    otpVerified: z.boolean().optional()
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'errors.auth.passwordRequired'),
    newPassword: passwordValidation,
    otp: z.string().length(6, 'errors.auth.otpInvalid')
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "errors.auth.passwordSameAsOld",
    path: ["newPassword"]
});

module.exports = {
    loginSchema,
    registerSchema,
    changePasswordSchema
};
