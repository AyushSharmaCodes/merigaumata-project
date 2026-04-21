/**
 * Invoice PDF Template for pdfmake
 * Translates the existing HTML/CSS design into a native pdfmake JSON structure
 */

const THEME = {
  primary: '#000000',
  secondary: '#000000',
  text: '#000000',
  lightGray: '#FFFFFF'
};

/**
 * Generates a single page definition for the PDF
 * @param {object} invoiceData The data for a single invoice page (product or delivery)
 */
const generatePageLayout = (invoiceData) => {
  const { 
    title, 
    invoiceNumber, 
    invoiceDate, 
    placeOfSupply, 
    orderNumber, 
    orderDate,
    logoDataUrl,
    seller,
    customer,
    currencySymbol,
    items,
    isInterState,
    summary,
    amountInWords
  } = invoiceData;

  const tableWidths = isInterState 
    ? ['*', 30, 60, 60, 60, 70] 
    : ['*', 30, 50, 55, 55, 55, 65]; 

  const tableRows = items.map((item, index) => {
    const row = [
      {
        stack: [
          { text: item.name, bold: true, fontSize: 10 },
          item.variant ? { text: `Variant: ${item.variant}`, fontSize: 8, color: '#444' } : '',
          { text: `HSN: ${item.hsn_code} ${item.isGstApplicable ? `| GST: ${item.gstRate}%` : ''}`, fontSize: 7, color: '#777' }
        ],
        margin: [0, 5, 0, 5]
      },
      { text: item.quantity.toString(), alignment: 'center', fontSize: 9, margin: [0, 5, 0, 5] },
      { text: item.rate, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5] },
      { text: item.taxableValue, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5] },
    ];

    if (isInterState) {
      row.push({ text: item.igstAmount, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5] });
    } else {
      row.push({ text: item.cgstAmount, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5] });
      row.push({ text: item.sgstAmount, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5] });
    }

    row.push({ text: item.totalAmount, alignment: 'right', fontSize: 9, margin: [0, 5, 0, 5], bold: true });
    
    return row.map(cell => ({ ...cell, fillColor: null }));
  });

  const tableHeaders = [
    { text: 'Description', style: 'tableHeader' },
    { text: 'Qty', style: 'tableHeader', alignment: 'center' },
    { text: `Rate ${currencySymbol}`, style: 'tableHeader', alignment: 'right' },
    { text: `Taxable ${currencySymbol}`, style: 'tableHeader', alignment: 'right' },
  ];

  if (isInterState) {
    tableHeaders.push({ text: `IGST ${currencySymbol}`, style: 'tableHeader', alignment: 'right' });
  } else {
    tableHeaders.push({ text: `CGST ${currencySymbol}`, style: 'tableHeader', alignment: 'right' });
    tableHeaders.push({ text: `SGST ${currencySymbol}`, style: 'tableHeader', alignment: 'right' });
  }
  tableHeaders.push({ text: `Total ${currencySymbol}`, style: 'tableHeader', alignment: 'right' });

  const totalQty = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const footerRow = [
    { text: 'Total', bold: true, fontSize: 10, margin: [0, 5, 0, 5] },
    { text: totalQty.toString(), alignment: 'center', bold: true, fontSize: 10, margin: [0, 5, 0, 5] },
    { text: '-', alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] },
    { text: summary.taxableAmount, alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] },
  ];

  if (isInterState) {
    footerRow.push({ text: summary.totalIgst, alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] });
  } else {
    footerRow.push({ text: summary.totalCgst, alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] });
    footerRow.push({ text: summary.totalSgst, alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] });
  }
  footerRow.push({ text: summary.grandTotal, alignment: 'right', bold: true, fontSize: 10, margin: [0, 5, 0, 5] });

  return [
    // Header Section
    {
      columns: [
        {
          width: '*',
          stack: [
            logoDataUrl ? { image: 'brand_logo', width: 40, margin: [0, 0, 0, 8] } : '',
            { text: `SOLD BY: ${seller.name}`, fontSize: 11, bold: true, color: THEME.primary },
            { 
              text: [
                { text: 'Ship-from Address: ', bold: true },
                `${seller.address.line1}, ${seller.address.line2 ? seller.address.line2 + ', ' : ''}${seller.address.city}, ${seller.address.state} - ${seller.address.zip}`
              ],
              fontSize: 6,
              color: '#555',
              margin: [0, 2, 0, 0]
            },
            { text: `GSTIN - ${seller.gstin}`, fontSize: 7, bold: true, margin: [0, 2, 0, 0], color: '#333' }
          ]
        },
        {
          width: 150,
          stack: [
            { text: title || 'TAX INVOICE', fontSize: 11, bold: true, alignment: 'right', color: THEME.primary },
            { 
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 150, y2: 5, lineWidth: 2, lineColor: THEME.primary }],
              margin: [0, 0, 0, 10]
            },
            {
              table: {
                widths: ['*', '*'],
                body: [
                  [{ text: 'Invoice #:', fontSize: 8, color: '#718096' }, { text: invoiceNumber, fontSize: 9, bold: true, alignment: 'right' }],
                  [{ text: 'Date:', fontSize: 8, color: '#718096' }, { text: invoiceDate, fontSize: 9, bold: true, alignment: 'right' }]
                ]
              },
              layout: 'noBorders'
            }
          ]
        }
      ],
      margin: [0, 0, 0, 30]
    },

    // Info Grid
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'BILL TO', style: 'sectionLabel' },
            { text: customer.billing_address?.full_name || customer.name, fontSize: 10, bold: true, margin: [0, 2, 0, 0] },
            { text: customer.billing_address?.line1 || customer.billing_address?.address_line1 || customer.billing_address?.addressLine1 || 'N/A', fontSize: 9 },
            customer.billing_address?.line2 || customer.billing_address?.address_line2 || customer.billing_address?.addressLine2
              ? { text: customer.billing_address?.line2 || customer.billing_address?.address_line2 || customer.billing_address?.addressLine2, fontSize: 9 }
              : '',
            { text: `${customer.billing_address?.city || ''} ${customer.billing_address?.pincode || customer.billing_address?.postal_code || customer.billing_address?.postalCode || customer.billing_address?.zip || ''}`, fontSize: 9 },
            { text: customer.billing_address?.state || '', fontSize: 9 },
            { text: `Phone: ${customer.phone || 'N/A'}`, fontSize: 9, margin: [0, 4, 0, 0] }
          ]
        },
        {
          width: '*',
          stack: [
            { text: 'SHIP TO', style: 'sectionLabel' },
            { text: customer.shipping_address?.full_name || customer.name, fontSize: 10, bold: true, margin: [0, 2, 0, 0] },
            { text: customer.shipping_address?.line1 || customer.shipping_address?.address_line1 || customer.shipping_address?.addressLine1 || 'N/A', fontSize: 9 },
            customer.shipping_address?.line2 || customer.shipping_address?.address_line2 || customer.shipping_address?.addressLine2
              ? { text: customer.shipping_address?.line2 || customer.shipping_address?.address_line2 || customer.shipping_address?.addressLine2, fontSize: 9 }
              : '',
            { text: `${customer.shipping_address?.city || ''} ${customer.shipping_address?.pincode || customer.shipping_address?.postal_code || customer.shipping_address?.postalCode || customer.shipping_address?.zip || ''}`, fontSize: 9 },
            { text: customer.shipping_address?.state || '', fontSize: 9 }
          ]
        },
        {
          width: 120,
          stack: [
            { text: 'ORDER INFO', style: 'sectionLabel' },
            { text: `ID: ${orderNumber}`, fontSize: 9, margin: [0, 2, 0, 0] },
            { text: `Date: ${orderDate}`, fontSize: 9 },
            { text: `Supply: ${placeOfSupply}`, fontSize: 9 }
          ]
        }
      ],
      margin: [0, 0, 0, 30]
    },

    // Items Table
    {
      table: {
        headerRows: 1,
        widths: tableWidths,
        body: [
          tableHeaders,
          ...tableRows,
          footerRow
        ]
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1) ? 2 : 0,
        vLineWidth: () => 0,
        hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1) ? THEME.primary : '#E2E8F0',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6
      }
    },

    // Summary Section
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'AMOUNT IN WORDS', style: 'sectionLabel', margin: [0, 20, 0, 2] },
            { text: amountInWords, fontSize: 9, italic: true, color: '#4A5568' }
          ]
        },
        {
          width: 200,
          stack: [
            {
              canvas: [{ type: 'line', x1: 0, y1: 15, x2: 200, y2: 15, lineWidth: 1, lineColor: '#E2E8F0' }]
            },
            {
              columns: [
                { text: 'GRAND TOTAL', fontSize: 12, bold: true, color: THEME.primary, margin: [0, 10, 0, 0] },
                { text: `${currencySymbol} ${summary.grandTotal}`, fontSize: 16, bold: true, alignment: 'right', color: THEME.primary, margin: [0, 10, 0, 0] }
              ]
            },
            {
              text: '(Inclusive of all taxes)',
              fontSize: 8,
              alignment: 'right',
              color: '#718096',
              margin: [0, 2, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 40]
    },

    // Bottom Section
    {
      columns: [
        {
          width: '*',
          text: ''
        },
        {
          width: 180,
          stack: [
            { text: 'Authorized Signatory', fontSize: 10, alignment: 'right', margin: [0, 0, 0, 5] },
            logoDataUrl ? { image: 'brand_logo', width: 30, opacity: 0.2, alignment: 'right', margin: [0, 0, 0, 5] } : { text: '\n\n', margin: [0, 20, 0, 0] },
            { text: `SOLD BY: ${seller.name}`, fontSize: 9, bold: true, alignment: 'right' }
          ]
        }
      ]
    }
  ];
};

const getInvoiceDefinition = (data) => {
  const content = [];

  // Add Page 1: Products
  const productPage = generatePageLayout(data.productInvoice || data);
  content.push(...productPage);

  // Add Page 2: Delivery (if applicable)
  if (data.deliveryInvoice) {
    // Add page break before the second page
    content[content.length - 1].pageBreak = 'after';
    const deliveryPage = generatePageLayout(data.deliveryInvoice);
    content.push(...deliveryPage);
  }

  const seller = data.productInvoice?.seller || data.seller;

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 100], // Increased bottom margin for fixed footer
    content,
    footer: (currentPage, pageCount) => {
      return {
        stack: [
          {
            canvas: [{ type: 'line', x1: 40, y1: 0, x2: 555, y2: 0, lineWidth: 0.5, lineColor: '#E2E8F0' }]
          },
          { 
            text: 'Returns Policy: At Meri Gau Mata we try to deliver perfectly each and every time. But in the off-chance that you need to return the item, please do so with the original Brand box/price tag, original packing and invoice without which it will be really difficult for us to act on your request. Please help us in helping you. Terms and conditions apply.\nThe goods sold as are intended for end user consumption and not for re-sale.',
            fontSize: 7,
            color: '#718096',
            alignment: 'center',
            margin: [40, 10, 40, 5]
          },
          {
            text: `Regd office: ${seller?.name || 'OJHA TRADING COMPANY'}, Sethi Niwas, 4th Road, Opp Syndicate Bank, Khar(w), Mumbai, Mumbai - 400052\n${seller?.website || 'merigaumata.in'} | support@merigaumata.com | GAUMATA PROJECT`,
            style: 'footer'
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            fontSize: 7,
            alignment: 'right',
            margin: [0, 5, 40, 0],
            color: '#CBD5E0'
          }
        ],
        margin: [0, 10, 0, 0]
      };
    },
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: '#000000',
        margin: [0, 4, 0, 4]
      },
      sectionLabel: {
        fontSize: 8,
        color: THEME.primary,
        bold: true,
        letterSpacing: 1,
        margin: [0, 0, 0, 4]
      },
      footer: {
        fontSize: 8,
        color: '#A0AEC0',
        alignment: 'center'
      }
    },
    defaultStyle: {
      font: 'Helvetica',
      color: THEME.text
    }
  };
};

module.exports = { getInvoiceDefinition, generatePageLayout };
