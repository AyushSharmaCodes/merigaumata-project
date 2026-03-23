require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuration
let BASE_URL = 'http://localhost:5001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to generate token
const TEST_TOKEN = "";

// Endpoints to test
// Format: { method, url, expectedStatus: { admin, manager, customer } }
const ENDPOINTS = [
    // 1. Products (Core) - Mounted at /api/products
    {
        method: 'POST',
        url: '/products',
        data: { title: 'Test Product' },
        desc: 'Create Product (Admin/Manager)'
    },
    // 2. Managers (Admin Only) - Mounted at /api/managers
    {
        method: 'GET',
        url: '/managers',
        desc: 'List Managers (Admin Only)'
    },
    // 3. Bank Details (Admin Only) - Mounted at /api/bank-details
    {
        method: 'POST',
        url: '/bank-details',
        desc: 'Update Bank Details (Admin Only)'
    },
    // 4. Social Media (Manager Allowed) - Mounted at /api/social-media
    {
        method: 'POST',
        url: '/social-media',
        desc: 'Update Social Media (Admin/Manager)'
    },
    // 5. Blog Comments (Manager Allowed) - Mounted at /api/blog-comments
    {
        method: 'GET',
        url: '/blog-comments/flagged/all',
        desc: 'Get Flagged Comments (Admin/Manager)'
    },
    // 6. Settings (Admin Only) - Mounted at /api/about
    {
        method: 'POST',
        url: '/about/cards',
        desc: 'Update About Cards (Admin Only)'
    },
    // 7. Profile - Check Role - Mounted at /api/profile
    {
        method: 'GET',
        url: '/profile',
        desc: 'Verify Token & Role'
    }
];

async function findActivePort() {
    for (let port = 5000; port <= 5010; port++) {
        try {
            const url = `http://localhost:${port}/api/health`;
            await axios.get(url, { timeout: 2000 }); // Short timeout
            console.log(`✅ Found active server on port ${port}`);
            return `http://localhost:${port}/api`;
        } catch (e) {
            // Ignore connection refused
        }
    }
    throw new Error('Could not find active server on ports 5000-5010');
}

async function runTest(token, endpoint) {
    const url = endpoint.url;
    try {
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        let response;
        if (endpoint.method === 'GET') {
            response = await axios.get(`${BASE_URL}${url}`, config);
        } else if (endpoint.method === 'POST') {
            response = await axios.post(`${BASE_URL}${url}`, endpoint.data || {}, config);
        }

        return { status: response.status, data: response.data };
    } catch (error) {
        if (error.response) {
            return { status: error.response.status, data: error.response.data };
        }
        return { status: 500, error: error.message };
    }
}

async function verifyRBAC() {

    try {
        BASE_URL = await findActivePort();
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }

    let role = 'Unknown';

    for (const endpoint of ENDPOINTS) {
        console.log(`Testing [${endpoint.method}] ${endpoint.url} - ${endpoint.desc}...`);

        const result = await runTest(TEST_TOKEN, endpoint);
        const status = result.status;

        // Interpret status
        let access = 'DENIED';
        if (status >= 200 && status < 300) access = 'GRANTED';
        if (status === 400) access = 'GRANTED (Validation Error)';
        if (status === 403) access = 'DENIED (Forbidden)';
        if (status === 401) access = 'DENIED (Unauthorized)';

        console.log(`👉 Result: ${status} - ${access}`);

        // Try to capture role from /profile
        if (endpoint.url === '/profile' && status === 200) {
            role = result.data.role || 'customer';
            console.log(`\n🎉 IDENTIFIED ROLE: ${role.toUpperCase()}\n`);
        }

        console.log('---');
    }

    console.log(`\nVerification Complete.`);
}

verifyRBAC();
