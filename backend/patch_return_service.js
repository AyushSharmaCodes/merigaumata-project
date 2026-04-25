const fs = require('fs');
const filePath = '/Users/ayushsharma/Developer/Projects/MGM project/merigaumata-project/backend/services/return.service.js';
let content = fs.readFileSync(filePath, 'utf8');

const newFunc = `
const getReturnRequestById = async (returnId, userId = null) => {
    let query = supabase
        .from('returns')
        .select(\`
            id, order_id, user_id, status, refund_amount, reason, created_at,
            return_items (
                id,
                status,
                quantity,
                reason,
                images,
                order_item_id,
                order_items (id, product_id, title)
            )
        \`)
        .eq('id', returnId)
        .single();

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    
    if (error) {
        if (error.code === 'PGRST116') {
            const err = new Error('Return request not found');
            err.status = 404;
            throw err;
        }
        logger.error({ err: error, returnId }, 'Failed to fetch return request by id');
        throw error;
    }
    
    return await refreshReturnRequestImages(data);
};

`;

content = content.replace('const getOrderReturnRequests = async (orderId, userId = null) => {', newFunc + 'const getOrderReturnRequests = async (orderId, userId = null) => {');
content = content.replace('getOrderReturnRequests,', 'getReturnRequestById,\n    getOrderReturnRequests,');

fs.writeFileSync(filePath, content);
