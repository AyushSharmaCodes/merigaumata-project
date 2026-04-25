const fs = require('fs');
const filePath = '/Users/ayushsharma/Developer/Projects/MGM project/merigaumata-project/backend/routes/return.routes.js';
let content = fs.readFileSync(filePath, 'utf8');

const newRoute = `
/**
 * GET /api/returns/:returnId
 * Get a specific return request by ID (Admin/User)
 */
router.get('/:returnId', authenticateToken, async (req, res) => {
    try {
        const userId = (req.user.role === 'admin' || req.user.role === 'manager') ? null : req.user.id;
        const returnRequest = await returnService.getReturnRequestById(req.params.returnId, userId);
        res.json(returnRequest);
    } catch (error) {
        res.status(error.status || 400).json({ error: getFriendlyMessage(error, error.status || 400) });
    }
});
`;

content = content.replace('/**\n * GET /api/returns/orders/:orderId/all', newRoute + '\n/**\n * GET /api/returns/orders/:orderId/all');

fs.writeFileSync(filePath, content);
