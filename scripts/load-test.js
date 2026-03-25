#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

function parseArgs(argv) {
    const result = {};

    for (const rawArg of argv) {
        if (!rawArg.startsWith('--')) continue;

        const trimmed = rawArg.slice(2);
        const eqIndex = trimmed.indexOf('=');

        if (eqIndex === -1) {
            result[trimmed] = true;
            continue;
        }

        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        result[key] = value;
    }

    return result;
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(sortedValues, ratio) {
    if (sortedValues.length === 0) return 0;
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
    return sortedValues[index];
}

function parseHeaders(rawHeaders) {
    if (!rawHeaders) return {};

    try {
        const parsed = JSON.parse(rawHeaders);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        throw new Error(`Invalid headers JSON: ${error.message}`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseUrl = args.baseUrl || process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:5001';
    const path = args.path || '/api/health';
    const method = String(args.method || 'GET').toUpperCase();
    const concurrency = toNumber(args.concurrency, 20);
    const requests = toNumber(args.requests, 200);
    const timeoutMs = toNumber(args.timeout, 10000);
    const body = args.body || '';
    const extraHeaders = parseHeaders(args.headers);
    const headers = {
        'user-agent': 'antigravity-load-test/1.0',
        ...(args.contentType ? { 'content-type': args.contentType } : {}),
        ...(args.auth ? { authorization: args.auth } : {}),
        ...(args.idempotencyKey ? { 'x-idempotency-key': args.idempotencyKey } : {}),
        ...(args.correlationId ? { 'x-correlation-id': args.correlationId } : {}),
        ...extraHeaders
    };

    if (body) {
        headers['content-length'] = Buffer.byteLength(body);
    }

    const target = new URL(path, baseUrl);
    const transport = target.protocol === 'https:' ? https : http;
    const latencies = [];
    let completed = 0;
    let started = 0;
    let inFlight = 0;
    let success = 0;
    let failures = 0;
    const statusCounts = new Map();
    const errorCounts = new Map();
    const wallStart = performance.now();

    function recordStatus(statusCode) {
        statusCounts.set(statusCode, (statusCounts.get(statusCode) || 0) + 1);
    }

    function recordError(errorKey) {
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
    }

    function issueRequest() {
        if (started >= requests) return;

        started += 1;
        inFlight += 1;
        const requestStart = performance.now();

        const req = transport.request(target, {
            method,
            headers,
            timeout: timeoutMs
        }, (res) => {
            res.on('data', () => { });
            res.on('end', () => {
                const duration = performance.now() - requestStart;
                latencies.push(duration);
                completed += 1;
                inFlight -= 1;

                recordStatus(res.statusCode || 0);
                if ((res.statusCode || 500) < 400) {
                    success += 1;
                } else {
                    failures += 1;
                }

                scheduleMore();
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`timeout>${timeoutMs}ms`));
        });

        req.on('error', (error) => {
            const duration = performance.now() - requestStart;
            latencies.push(duration);
            completed += 1;
            inFlight -= 1;
            failures += 1;
            recordError(error.message || error.code || 'unknown_error');
            scheduleMore();
        });

        if (body) {
            req.write(body);
        }

        req.end();
    }

    function scheduleMore() {
        while (inFlight < concurrency && started < requests) {
            issueRequest();
        }

        if (completed === requests) {
            const wallMs = performance.now() - wallStart;
            const sorted = [...latencies].sort((a, b) => a - b);
            const totalLatency = sorted.reduce((sum, value) => sum + value, 0);

            const summary = {
                target: target.toString(),
                method,
                requests,
                concurrency,
                durationMs: Number(wallMs.toFixed(2)),
                throughputRps: Number((requests / (wallMs / 1000)).toFixed(2)),
                success,
                failures,
                latencyMs: {
                    min: Number((sorted[0] || 0).toFixed(2)),
                    avg: Number((sorted.length ? totalLatency / sorted.length : 0).toFixed(2)),
                    p50: Number(percentile(sorted, 0.5).toFixed(2)),
                    p95: Number(percentile(sorted, 0.95).toFixed(2)),
                    p99: Number(percentile(sorted, 0.99).toFixed(2)),
                    max: Number((sorted[sorted.length - 1] || 0).toFixed(2))
                },
                statusCounts: Object.fromEntries([...statusCounts.entries()].sort((a, b) => a[0] - b[0])),
                errorCounts: Object.fromEntries([...errorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])))
            };

            process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        }
    }

    scheduleMore();
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
});
