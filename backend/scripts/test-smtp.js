require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');
const util = require('util');

const resolve4 = util.promisify(dns.resolve4);
const resolve6 = util.promisify(dns.resolve6);

// Environment setup
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const FORCE_IPV4 = process.env.SMTP_FORCE_IPV4 === 'true';

async function testResolution() {
    console.log('\n--- DNS Resolution Check ---');
    console.log(`Checking DNS for: ${SMTP_HOST}`);

    try {
        const ipv4Addresses = await resolve4(SMTP_HOST);
        console.log(`✅ IPv4 addresses found:`, ipv4Addresses);
    } catch (e) {
        console.log(`❌ No IPv4 addresses found or DNS error:`, e.message);
    }

    try {
        const ipv6Addresses = await resolve6(SMTP_HOST);
        console.log(`✅ IPv6 addresses found:`, ipv6Addresses);
    } catch (e) {
        if (e.code === 'ENODATA') {
            console.log(`ℹ️ No IPv6 addresses configured for this host (this is fine).`);
        } else {
            console.log(`❌ IPv6 DNS error:`, e.message);
        }
    }
}

async function testConnection() {
    console.log('\n--- SMTP Connection Check ---');
    if (!SMTP_USER || !SMTP_PASSWORD) {
        console.log('⚠️ Warning: SMTP_USER or SMTP_PASSWORD is not set. Transport verification will likely fail auth but connection might succeed.');
    }

    const transportOptions = {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASSWORD
        },
        connectionTimeout: 10000, // 10s for the test
        logger: true, // Enable nodemailer logging (shows raw network commands)
        debug: true
    };

    if (FORCE_IPV4) {
        console.log('ℹ️ Forcing IPv4 resolution (family: 4)...');
        transportOptions.family = 4;
    }

    console.log('Initializing Transporter with options:', JSON.stringify({
        ...transportOptions,
        auth: { user: SMTP_USER, pass: '***REDACTED***' },
        logger: 'true',
        debug: 'true'
    }, null, 2));

    const transporter = nodemailer.createTransport(transportOptions);

    try {
        console.log('\nVerifying SMTP socket and credentials...');
        await transporter.verify();
        console.log('✅ SMTP connection and authentication successful!');
        process.exit(0);
    } catch (error) {
        console.log('\n❌ SMTP Verification Failed!');
        console.error('Error Details:');
        console.error(`- Message: ${error.message}`);
        console.error(`- Code: ${error.code}`);
        console.error(`- Command: ${error.command || 'N/A'}`);
        
        if (error.code === 'ETIMEDOUT') {
            console.log('\n💡 Possible Timeout Causes:');
            console.log('1. Vercel/Cloud Provider blocking the port (try port 587 or 2525)');
            console.log('2. Node >= 17 IPv6 routing issue (Set SMTP_FORCE_IPV4=true)');
            console.log('3. Incorrect hostname');
        } else if (error.code === 'ESOCKET') {
            console.log('\n💡 Connection immediately closed or refused. Check TLS/SSL settings (SMTP_SECURE).');
        } else if (error.code === 'EAUTH') {
            console.log('\n💡 Connection succeeded, but Authentication failed. Check SMTP credentials.');
        } else if (error.message.includes('self-signed certificate')) {
            console.log('\n💡 TLS Certificate issue. Set SMTP_IGNORE_TLS_ERRORS=true if you trust the server.');
        }

        process.exit(1);
    }
}

async function runDiagnostics() {
    try {
        await testResolution();
        await testConnection();
    } catch (error) {
        console.error('Diagnostic tool unexpectedly crashed:', error);
        process.exit(1);
    }
}

runDiagnostics();
