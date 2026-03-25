#!/usr/bin/env node

const http = require('http');
const https = require('https');
const crypto = require('crypto');
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

function summarizeLatencies(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);

    return {
        min: Number((sorted[0] || 0).toFixed(2)),
        avg: Number((sorted.length ? total / sorted.length : 0).toFixed(2)),
        p50: Number(percentile(sorted, 0.5).toFixed(2)),
        p95: Number(percentile(sorted, 0.95).toFixed(2)),
        p99: Number(percentile(sorted, 0.99).toFixed(2)),
        max: Number((sorted[sorted.length - 1] || 0).toFixed(2))
    };
}

function pickWeighted(scenarios, randomValue) {
    let cursor = 0;

    for (const scenario of scenarios) {
        cursor += scenario.weight;
        if (randomValue <= cursor) {
            return scenario;
        }
    }

    return scenarios[scenarios.length - 1];
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseUrl = args.baseUrl || process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:5001';
    const concurrency = toNumber(args.concurrency, 30);
    const requests = toNumber(args.requests, 300);
    const timeoutMs = toNumber(args.timeout, 10000);
    const guestPoolSize = toNumber(args.guestPool, 120);

    const targetBase = new URL(baseUrl);
    const transport = targetBase.protocol === 'https:' ? https : http;

    const scenarios = [
        {
            name: 'products',
            weight: 0.65,
            buildRequest: () => ({
                method: 'GET',
                path: '/api/products',
                headers: {
                    'user-agent': 'antigravity-mixed-load-test/1.0'
                }
            })
        },
        {
            name: 'checkout_summary',
            weight: 0.25,
            buildRequest: (index) => ({
                method: 'GET',
                path: '/api/checkout/summary',
                headers: {
                    'user-agent': 'antigravity-mixed-load-test/1.0',
                    'x-guest-id': `mixed-guest-${index % guestPoolSize}`
                }
            })
        },
        {
            name: 'auth_check_email',
            weight: 0.10,
            buildRequest: (index) => {
                const email = `mixed-load-${index}-${crypto.randomUUID().slice(0, 8)}@example.com`;
                const body = JSON.stringify({ email });

                return {
                    method: 'POST',
                    path: '/api/auth/check-email',
                    body,
                    headers: {
                        'user-agent': 'antigravity-mixed-load-test/1.0',
                        'content-type': 'application/json',
                        'content-length': Buffer.byteLength(body)
                    }
                };
            }
        }
    ];

    const metrics = {
        overall: {
            success: 0,
            failures: 0,
            latencies: [],
            statusCounts: new Map(),
            errorCounts: new Map()
        },
        scenarios: Object.fromEntries(scenarios.map((scenario) => [
            scenario.name,
            {
                requests: 0,
                success: 0,
                failures: 0,
                latencies: [],
                statusCounts: new Map(),
                errorCounts: new Map()
            }
        ]))
    };

    let started = 0;
    let completed = 0;
    let inFlight = 0;
    const wallStart = performance.now();

    function recordStatus(bucket, statusCode) {
        bucket.statusCounts.set(statusCode, (bucket.statusCounts.get(statusCode) || 0) + 1);
    }

    function recordError(bucket, errorKey) {
        bucket.errorCounts.set(errorKey, (bucket.errorCounts.get(errorKey) || 0) + 1);
    }

    function finalize() {
        const wallMs = performance.now() - wallStart;
        const scenarioSummaries = {};

        for (const [name, metric] of Object.entries(metrics.scenarios)) {
            scenarioSummaries[name] = {
                requests: metric.requests,
                success: metric.success,
                failures: metric.failures,
                latencyMs: summarizeLatencies(metric.latencies),
                statusCounts: Object.fromEntries([...metric.statusCounts.entries()].sort((a, b) => a[0] - b[0])),
                errorCounts: Object.fromEntries([...metric.errorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])))
            };
        }

        const summary = {
            target: targetBase.toString(),
            requests,
            concurrency,
            durationMs: Number(wallMs.toFixed(2)),
            throughputRps: Number((requests / (wallMs / 1000)).toFixed(2)),
            success: metrics.overall.success,
            failures: metrics.overall.failures,
            latencyMs: summarizeLatencies(metrics.overall.latencies),
            statusCounts: Object.fromEntries([...metrics.overall.statusCounts.entries()].sort((a, b) => a[0] - b[0])),
            errorCounts: Object.fromEntries([...metrics.overall.errorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
            scenarios: scenarioSummaries
        };

        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }

    function scheduleMore() {
        while (inFlight < concurrency && started < requests) {
            issueRequest(started);
        }

        if (completed === requests) {
            finalize();
        }
    }

    function issueRequest(index) {
        const scenario = pickWeighted(scenarios, Math.random());
        const scenarioMetric = metrics.scenarios[scenario.name];
        const requestConfig = scenario.buildRequest(index);
        const requestStart = performance.now();

        started += 1;
        inFlight += 1;
        scenarioMetric.requests += 1;

        const req = transport.request(new URL(requestConfig.path, targetBase), {
            method: requestConfig.method,
            headers: requestConfig.headers,
            timeout: timeoutMs
        }, (res) => {
            res.on('data', () => { });
            res.on('end', () => {
                const duration = performance.now() - requestStart;
                const isSuccess = (res.statusCode || 500) < 400;

                metrics.overall.latencies.push(duration);
                scenarioMetric.latencies.push(duration);
                recordStatus(metrics.overall, res.statusCode || 0);
                recordStatus(scenarioMetric, res.statusCode || 0);

                if (isSuccess) {
                    metrics.overall.success += 1;
                    scenarioMetric.success += 1;
                } else {
                    metrics.overall.failures += 1;
                    scenarioMetric.failures += 1;
                }

                completed += 1;
                inFlight -= 1;
                scheduleMore();
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`timeout>${timeoutMs}ms`));
        });

        req.on('error', (error) => {
            const duration = performance.now() - requestStart;
            const errorKey = error.message || error.code || 'unknown_error';

            metrics.overall.latencies.push(duration);
            scenarioMetric.latencies.push(duration);
            metrics.overall.failures += 1;
            scenarioMetric.failures += 1;
            recordError(metrics.overall, errorKey);
            recordError(scenarioMetric, errorKey);

            completed += 1;
            inFlight -= 1;
            scheduleMore();
        });

        if (requestConfig.body) {
            req.write(requestConfig.body);
        }

        req.end();
    }

    scheduleMore();
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
});
