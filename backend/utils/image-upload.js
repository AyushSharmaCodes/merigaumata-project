const multer = require('multer');

const IMAGE_UPLOAD_MAX_BYTES = 1 * 1024 * 1024;
const IMAGE_UPLOAD_MAX_MB_LABEL = '1MB';
const IMAGE_UPLOAD_TOO_LARGE_MESSAGE = `Image must be ${IMAGE_UPLOAD_MAX_MB_LABEL} or smaller.`;

function imageFileFilter(req, file, cb) {
    if (file.mimetype?.startsWith('image/')) {
        cb(null, true);
        return;
    }

    cb(new Error('errors.upload.imagesOnly'));
}

function createImageUploadMiddleware() {
    return multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: IMAGE_UPLOAD_MAX_BYTES,
        },
        fileFilter: imageFileFilter,
    });
}

function handleImageUpload(uploadMiddleware, fieldName) {
    return (req, res, next) => {
        uploadMiddleware.single(fieldName)(req, res, (error) => {
            if (!error) {
                next();
                return;
            }

            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: IMAGE_UPLOAD_TOO_LARGE_MESSAGE });
            }

            return res.status(400).json({
                error: error.message === 'errors.upload.imagesOnly'
                    ? req.t('errors.upload.imagesOnly')
                    : error.message
            });
        });
    };
}

module.exports = {
    IMAGE_UPLOAD_MAX_BYTES,
    IMAGE_UPLOAD_MAX_MB_LABEL,
    IMAGE_UPLOAD_TOO_LARGE_MESSAGE,
    createImageUploadMiddleware,
    handleImageUpload
};
