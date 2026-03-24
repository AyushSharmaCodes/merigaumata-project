const express = require('express');
const router = express.Router();
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const ProductService = require('../services/product.service');
const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all products with dynamic ratings
router.get('/', async (req, res) => {
    try {
        const { page, limit, search, category, sortBy, includeStats } = req.query;
        const result = await ProductService.getAllProducts({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 15,
            search: search || '',
            category: category || 'all',
            sortBy: sortBy || 'newest',
            lang: req.language,
            includeStats: includeStats === 'true'
        });
        res.json(result);
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch products');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Export products - Admin/Manager only
router.get('/export', authenticateToken, checkPermission('can_manage_products'), async (req, res) => {
    try {
        const csvData = await ProductService.exportAllProducts();

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `products_all_details_${dateStr}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvData);
    } catch (error) {
        logger.error({ err: error }, "Export Error");
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await ProductService.getProductById(req.params.id, req.language);
        res.json(product);
    } catch (error) {
        logger.error({ err: error, productId: req.params.id }, 'Failed to fetch product');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create product - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_products'), async (req, res) => {
    try {
        const product = await ProductService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create product');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update product - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_products'), async (req, res) => {
    try {
        const product = await ProductService.updateProduct(req.params.id, req.body);
        res.json(product);
    } catch (error) {
        logger.error({ err: error, productId: req.params.id, body: req.body }, 'Failed to update product');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});



// Delete product - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_products'), async (req, res) => {
    try {
        await ProductService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, productId: req.params.id }, 'Failed to delete product');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
