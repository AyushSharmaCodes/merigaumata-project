const { getInvoiceDefinition } = require('./services/templates/invoice-pdf.template');

const mockData = {
    title: 'TAX INVOICE',
    invoiceNumber: 'INV-123',
    invoiceDate: '11/04/2026',
    placeOfSupply: 'Maharashtra',
    orderNumber: 'ORD-123',
    orderDate: '10/04/2026',
    logoDataUrl: true, // Boolean as passed by my new refactor
    seller: {
        name: 'OJHA TRADING COMPANY',
        address: { line1: 'Test', city: 'Mumbai', state: 'Maharashtra', zip: '400000' },
        gstin: '09XXXXX',
        website: 'merigaumata.in'
    },
    customer: {
        name: 'John Doe',
        billing_address: { line1: 'Test' },
        shipping_address: { line1: 'Test' },
        phone: '1234567890'
    },
    currency: 'INR',
    currencySymbol: 'Rs',
    items: [],
    isInterState: false,
    summary: { grandTotal: '0.00' },
    amountInWords: 'Zero'
};

try {
    const doc = getInvoiceDefinition({ productInvoice: mockData });
    console.log('Template logic check successful');
    if (doc.content[0].columns[0].stack[0].image === 'brand_logo') {
        console.log('Logo correctly mapped to "brand_logo" key');
    } else {
        console.error('Logo mapping failed!', doc.content[0].columns[0].stack[0]);
    }
} catch (e) {
    console.error('Template logic check failed:', e);
}
