class CommentMessages {
    // Errors
    static NOT_FOUND = 'errors.comment.notFound';
    static UNAUTHORIZED = 'errors.comment.unauthorized';
    static EMPTY_CONTENT = 'errors.comment.emptyContent';
    static UPDATE_FAILED = 'errors.comment.updateFailed';
    static DELETE_FAILED = 'errors.comment.deleteFailed';

    // Success
    static POSTED = 'success.comment.posted';
    static UPDATED = 'success.comment.updated';
    static DELETED = 'success.comment.deleted';
    static REPLY_POSTED = 'success.comment.replyPosted';
}

module.exports = CommentMessages;
