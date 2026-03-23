const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('RazorpaySyncService');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

class RazorpaySyncService {
    /**
     * Create an Item in Razorpay
     * @param {Object} itemData - { name, description, amount (in paise), currency, hsn_code, tax_rate }
     * @returns {Promise<Object>} Razorpay Item object
     */
    static async createItem(itemData) {
        try {
            log.operationStart('CREATEItem', { name: itemData.name });

            // Validate HSN code length: Razorpay might enforce constraints
            // HSN code must be string
            const hsn_code = itemData.hsn_code ? String(itemData.hsn_code) : undefined;

            // Tax rate must be integer or float (percentage)
            // GST rates: 0, 5, 12, 18, 28
            // Razorpay usage: 500 = 5%, 1800 = 18%. Wait, let's verify docs.
            // Docs: tax_rate is in PERCENTAGE. e.g. 18.
            // BUT wait, Razorpay Items API takes 'tax_id' or 'tax_rate'?
            // Checking standard Razorpay Items API payload:
            // { name, description, amount, currency, hsn_code, tax_rate, tax_inclusive }
            // tax_rate is "Two decimal places". e.g. 18.00

            const payload = {
                name: itemData.name.substring(0, 40), // Limit name length if needed
                description: itemData.description ? itemData.description.substring(0, 255) : '',
                amount: Math.round(itemData.amount), // ensure integer paise
                currency: itemData.currency || 'INR',
            };

            // Optional GST fields
            if (hsn_code) payload.hsn_code = hsn_code;
            if (itemData.tax_rate !== undefined) payload.tax_rate = itemData.tax_rate;
            if (itemData.tax_inclusive !== undefined) payload.tax_inclusive = itemData.tax_inclusive;

            const item = await razorpay.items.create(payload);

            log.operationSuccess('CREATE_ITEM', { id: item.id });
            return item;
        } catch (error) {
            log.operationError('CREATE_ITEM', error);
            // Don't throw, just return null so we don't block product creation? 
            // Better to log and return null.
            return null;
        }
    }

    /**
     * Update an Item in Razorpay
     * @param {string} itemId - Razorpay Item ID
     * @param {Object} updates - { name, description, amount, ... }
     * @returns {Promise<Object>} Updated Razorpay Item
     */
    static async updateItem(itemId, updates) {
        try {
            log.operationStart('UPDATEItem', { id: itemId });

            const payload = {};
            if (updates.name) payload.name = updates.name.substring(0, 40);
            if (updates.description) payload.description = updates.description.substring(0, 255);
            if (updates.amount) payload.amount = Math.round(updates.amount);
            if (updates.tax_rate !== undefined) payload.tax_rate = updates.tax_rate;
            if (updates.tax_inclusive !== undefined) payload.tax_inclusive = updates.tax_inclusive;
            if (updates.hsn_code) payload.hsn_code = String(updates.hsn_code);

            const item = await razorpay.items.edit(itemId, payload);

            log.operationSuccess('UPDATE_ITEM', { id: item.id });
            return item;
        } catch (error) {
            log.operationError('UPDATE_ITEM', error);
            return null;
        }
    }

    /**
     * Get Item by ID
     */
    static async getItem(itemId) {
        try {
            return await razorpay.items.fetch(itemId);
        } catch (error) {
            log.operationError('FETCH_ITEM_FAIL', error, { itemId });
            return null;
        }
    }
    /**
     * Delete an Item in Razorpay
     * @param {string} itemId - Razorpay Item ID
     * @returns {Promise<boolean>} Success status
     */
    static async deleteItem(itemId) {
        try {
            log.operationStart('DELETEItem', { id: itemId });
            // Razorpay Items API supports delete
            await razorpay.items.delete(itemId);
            log.operationSuccess('DELETE_ITEM', { id: itemId });
            return true;
        } catch (error) {
            log.operationError('DELETE_ITEM', error);
            // If item is already deleted or not found, consider it success
            return false;
        }
    }

    // Simple in-memory cache for delivery items to avoid repeated API calls
    static itemsCache = null;
    static cacheTimestamp = 0;
    static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get or Create a Delivery Charge Item for a specific amount
     * Reuses existing item if found, otherwise creates new one.
     * @param {number} amount - Delivery charge amount in RUPEES (will be converted to paisa)
     * @returns {Promise<Object>} Razorpay Item object
     */
    static async getOrCreateDeliveryItem(amount) {
        try {
            const amountInPaisa = Math.round(amount * 100);
            const itemName = `Delivery Charge (₹${amount})`;

            log.operationStart('GETOrCreateDeliveryItem', { amount });

            // 1. Refresh cache if needed
            const now = Date.now();
            if (!this.itemsCache || (now - this.cacheTimestamp > this.CACHE_TTL)) {
                log.debug('Refreshing Razorpay items cache');
                // Fetch valid items (active)
                // Razorpay list returns { entity: 'collection', count: N, items: [...] }
                const response = await razorpay.items.all({ count: 100 });
                this.itemsCache = response.items || [];
                this.cacheTimestamp = now;
            }

            // 2. Search in cache
            // Look for item with same amount and "Delivery Charge" in name to be safe
            // Razorpay amount is in paisa
            const existingItem = this.itemsCache.find(item =>
                Math.abs(item.amount - amountInPaisa) < 1 && // Match amount
                item.name.toLowerCase().includes('delivery') && // Match name pattern
                item.active !== false // Ensure active
            );

            if (existingItem) {
                log.info('Found existing delivery item', { id: existingItem.id });
                return existingItem;
            }

            // 3. Create new if not found
            log.info('Creating new delivery item', { amount });
            const newItem = await this.createItem({
                name: itemName,
                description: 'Shipping & Handling Charges',
                amount: amountInPaisa,
                currency: 'INR',
                hsn_code: '9968', // SAC for delivery services
                tax_rate: 18,     // 18% GST default for delivery
                tax_inclusive: false
            });

            if (newItem) {
                // Add to cache
                this.itemsCache.push(newItem);
            }

            return newItem;

        } catch (error) {
            log.operationError('GET_OR_CREATE_DELIVERY_ITEM', error);
            return null;
        }
    }
}

module.exports = RazorpaySyncService;
