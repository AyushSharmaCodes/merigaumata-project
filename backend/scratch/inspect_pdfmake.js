const pdfmake = require('pdfmake');
console.log('Type of require("pdfmake"):', typeof pdfmake);
console.log('Keys of require("pdfmake"):', Object.keys(pdfmake));
try {
    const printer = new pdfmake({});
    console.log('Successfully instantiated with new pdfmake({})');
} catch (e) {
    console.log('Failed to instantiate with new pdfmake({}):', e.message);
}
