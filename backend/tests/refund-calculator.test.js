const { RefundCalculator } = require('../services/refund-calculator.service');

describe('RefundCalculator', () => {

    describe('calculateItemRefund', () => {
        test('should calculate full refund correctly', () => {
            const orderItem = {
                quantity: 2,
                taxable_amount: 1000,
                cgst: 90,
                sgst: 90,
                igst: 0
            };
            const returnQuantity = 2;

            const result = RefundCalculator.calculateItemRefund(orderItem, returnQuantity);

            expect(result.taxableRefund).toBe(1000);
            expect(result.cgstRefund).toBe(90);
            expect(result.sgstRefund).toBe(90);
            expect(result.igstRefund).toBe(0);
            expect(result.totalRefund).toBe(1180);
        });

        test('should calculate partial refund correctly (half quantity)', () => {
            const orderItem = {
                quantity: 2,
                taxable_amount: 1000,
                cgst: 90,
                sgst: 90,
                igst: 0
            };
            const returnQuantity = 1;

            const result = RefundCalculator.calculateItemRefund(orderItem, returnQuantity);

            expect(result.taxableRefund).toBe(500);
            expect(result.cgstRefund).toBe(45);
            expect(result.sgstRefund).toBe(45);
            expect(result.igstRefund).toBe(0);
            expect(result.totalRefund).toBe(590);
        });

        test('should handle floating point rounding correctly (1/3 refund)', () => {
            const orderItem = {
                quantity: 3,
                taxable_amount: 100, // 33.33 per item
                cgst: 9, // 3 per item
                sgst: 9,
                igst: 0
            };
            const returnQuantity = 1;

            const result = RefundCalculator.calculateItemRefund(orderItem, returnQuantity);

            // 100 * (1/3) = 33.333... -> 33.33
            expect(result.taxableRefund).toBe(33.33);
            // 9 * (1/3) = 3.00
            expect(result.cgstRefund).toBe(3.00);
            expect(result.sgstRefund).toBe(3.00);
            expect(result.totalRefund).toBe(39.33); // 33.33 + 3 + 3
        });

        test('should return zero if return quantity is zero or invalid', () => {
            const orderItem = { quantity: 1, taxable_amount: 100 };
            expect(RefundCalculator.calculateItemRefund(orderItem, 0).totalRefund).toBe(0);
            expect(RefundCalculator.calculateItemRefund(null, 1).totalRefund).toBe(0);
        });
    });

    describe('calculateReturnTotal', () => {
        test('should sum up refunds from multiple items', () => {
            const orderItems = [
                { id: 'item1', quantity: 2, taxable_amount: 1000, cgst: 90, sgst: 90, igst: 0 },
                { id: 'item2', quantity: 1, taxable_amount: 500, cgst: 0, sgst: 0, igst: 90 }
            ];

            const returnItems = [
                { orderItemId: 'item1', quantity: 1 }, // Half refund = 500 + 45 + 45 = 590
                { orderItemId: 'item2', quantity: 1 }  // Full refund = 500 + 90 = 590
            ];

            const result = RefundCalculator.calculateReturnTotal(orderItems, returnItems);

            expect(result.summary.totalTaxableRefund).toBe(1000); // 500 + 500
            expect(result.summary.totalCgstRefund).toBe(45);
            expect(result.summary.totalSgstRefund).toBe(45);
            expect(result.summary.totalIgstRefund).toBe(90);
            expect(result.summary.totalRefund).toBe(1180); // 590 + 590
        });

        test('should ignore invalid item IDs', () => {
            const orderItems = [
                { id: 'item1', quantity: 1, taxable_amount: 100, cgst: 0, sgst: 0, igst: 0 }
            ];
            const returnItems = [
                { orderItemId: 'invalid-id', quantity: 1 }
            ];

            const result = RefundCalculator.calculateReturnTotal(orderItems, returnItems);
            expect(result.summary.totalRefund).toBe(0);
        });
    });
});
