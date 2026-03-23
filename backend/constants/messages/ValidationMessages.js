class ValidationMessages {
    static INVALID_EMAIL = 'validation.auth.invalidEmail';
    static PASSWORD_MIN_LENGTH = 'validation.auth.passwordMinLength';
    static PASSWORD_LOWERCASE = 'validation.auth.passwordLowercase';
    static PASSWORD_UPPERCASE = 'validation.auth.passwordUppercase';
    static PASSWORD_NUMBER = 'validation.auth.passwordNumber';
    static PASSWORD_SPECIAL = 'validation.auth.passwordSpecial';
    static TOKEN_REQUIRED = 'validation.auth.tokenRequired';
    static OTP_REQUIRED = 'validation.auth.otpRequired';
    static NAME_REQUIRED = 'validation.profile.nameRequired';
    static PHONE_INVALID = 'validation.profile.phoneInvalid';
    static MESSAGE_MIN_LENGTH = 'validation.contact.messageMinLength';
    static EMAIL_INVALID = 'validation.contact.emailInvalid';
    static BLOG_ID_REQUIRED = 'validation.blog.idRequired';
    static FAVICON_NOT_FOUND = 'validation.system.faviconNotFound';
    static INVALID_INPUT = 'validation.common.invalidInput';
}

module.exports = ValidationMessages;
