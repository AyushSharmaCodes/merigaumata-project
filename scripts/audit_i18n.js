#!/usr/bin/env node
/**
 * Comprehensive i18n Audit Script
 * 
 * 1. Compares keys across all 4 locale files (en, hi, ta, te) for frontend and backend
 * 2. Extracts t() calls from source code and verifies they exist in locale files
 * 3. Detects potential hardcoded user-facing strings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FRONTEND_LOCALES = path.join(ROOT, 'frontend/src/i18n/locales');
const BACKEND_LOCALES = path.join(ROOT, 'backend/locales');
const FRONTEND_SRC = path.join(ROOT, 'frontend/src');
const BACKEND_SRC = path.join(ROOT, 'backend');
const LOCALES = ['en', 'hi', 'ta', 'te'];

// ========== UTILITY FUNCTIONS ==========

function flattenObject(obj, prefix = '') {
    const result = {};
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flattenObject(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    }
    return result;
}

function loadLocale(dir, lang) {
    const filePath = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`❌ Failed to parse ${filePath}: ${e.message}`);
        return null;
    }
}

// ========== PART 1: Cross-locale key comparison ==========

function auditLocaleKeys(localesDir, label) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 PART 1: Key Consistency Audit - ${label}`);
    console.log(`${'='.repeat(80)}`);

    const flatMaps = {};
    for (const lang of LOCALES) {
        const data = loadLocale(localesDir, lang);
        if (!data) {
            console.error(`  ❌ Missing locale file: ${lang}.json in ${localesDir}`);
            continue;
        }
        flatMaps[lang] = flattenObject(data);
    }

    // Collect all keys from all locales
    const allKeys = new Set();
    for (const lang of LOCALES) {
        if (flatMaps[lang]) {
            Object.keys(flatMaps[lang]).forEach(k => allKeys.add(k));
        }
    }

    // Find missing keys per locale
    const missingByLocale = {};
    for (const lang of LOCALES) {
        if (!flatMaps[lang]) continue;
        missingByLocale[lang] = [];
    }

    let totalMissing = 0;
    for (const key of [...allKeys].sort()) {
        for (const lang of LOCALES) {
            if (!flatMaps[lang]) continue;
            if (!(key in flatMaps[lang])) {
                missingByLocale[lang].push(key);
                totalMissing++;
            }
        }
    }

    if (totalMissing === 0) {
        console.log(`  ✅ All ${allKeys.size} keys are present in all ${LOCALES.length} locale files.`);
    } else {
        console.log(`  ⚠️  Found ${totalMissing} missing key entries across locales:`);
        for (const lang of LOCALES) {
            if (!missingByLocale[lang] || missingByLocale[lang].length === 0) {
                console.log(`    ✅ ${lang}.json: No missing keys`);
            } else {
                console.log(`    ❌ ${lang}.json: ${missingByLocale[lang].length} missing keys:`);
                for (const key of missingByLocale[lang]) {
                    // Find which locales DO have this key, to show the English value
                    const enVal = flatMaps.en && flatMaps.en[key] ? flatMaps.en[key] : '(no en value)';
                    console.log(`       - ${key}  [en: "${enVal}"]`);
                }
            }
        }
    }

    return { flatMaps, allKeys, missingByLocale, totalMissing };
}

// ========== PART 2: Source code t() calls vs locale keys ==========

function extractTCallsFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const keys = new Set();

    // Match patterns:
    // t('key'), t("key"), t(`key`)
    // req.t('key'), req.t("key")
    // i18next.t('key')
    const patterns = [
        /(?:^|[^a-zA-Z])t\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
        /req\.t\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
        /i18next\.t\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            keys.add(match[1]);
        }
    }

    return keys;
}

function auditSourceVsLocales(srcDir, flatEnKeys, label, extensions) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 PART 2: Source Code t() Calls vs Locale Keys - ${label}`);
    console.log(`${'='.repeat(80)}`);

    const extPattern = extensions.map(e => `--include='*.${e}'`).join(' ');

    // Find all source files
    let sourceFiles = [];
    function walkDir(dir) {
        if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('dist') || dir.includes('build')) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (extensions.some(ext => entry.name.endsWith(`.${ext}`))) {
                sourceFiles.push(fullPath);
            }
        }
    }
    walkDir(srcDir);

    const allUsedKeys = new Set();
    const keyUsageMap = {}; // key -> [files]

    for (const file of sourceFiles) {
        const keys = extractTCallsFromFile(file);
        for (const key of keys) {
            allUsedKeys.add(key);
            if (!keyUsageMap[key]) keyUsageMap[key] = [];
            keyUsageMap[key].push(path.relative(ROOT, file));
        }
    }

    // Check which used keys are missing from locale
    const missingFromLocale = [];
    for (const key of [...allUsedKeys].sort()) {
        if (!(key in flatEnKeys)) {
            missingFromLocale.push(key);
        }
    }

    console.log(`  📊 Found ${allUsedKeys.size} unique t() keys in ${sourceFiles.length} source files`);

    if (missingFromLocale.length === 0) {
        console.log(`  ✅ All t() keys exist in en.json`);
    } else {
        console.log(`  ❌ ${missingFromLocale.length} t() keys NOT FOUND in en.json:`);
        for (const key of missingFromLocale) {
            console.log(`     - "${key}" used in:`);
            for (const file of keyUsageMap[key]) {
                console.log(`         ${file}`);
            }
        }
    }

    return { allUsedKeys, missingFromLocale, keyUsageMap };
}

// ========== PART 3: Hardcoded strings detection ==========

function detectHardcodedStrings(srcDir, label) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 PART 3: Hardcoded String Detection - ${label}`);
    console.log(`${'='.repeat(80)}`);

    let sourceFiles = [];
    const extensions = ['tsx', 'ts', 'jsx', 'js'];
    const skipFilePatterns = [
        /\/tests?\//,
        /\/__tests__\//,
        /\/scripts\//,
        /\/migrations\//,
        /frontend\/src\/lib\/dto\//,
        /frontend\/src\/lib\/observability\.ts$/,
        /frontend\/src\/lib\/api-client\.ts$/,
        /frontend\/src\/store\/locationStore\.ts$/,
        /backend\/middleware\/idempotency\.middleware\.js$/,
        /backend\/middleware\/requestLock\.middleware\.js$/,
        /backend\/services\/auth\.service\.js$/,
        /backend\/services\/cart\.service\.js$/,
        /backend\/services\/deletion-job-processor\.js$/,
        /backend\/services\/email-retry\.service\.js$/,
        /backend\/services\/email\/templates\/base\.template\.js$/,
        /backend\/services\/invoice-orchestrator\.service\.js$/,
        /backend\/services\/photo\.service\.js$/,
        /backend\/services\/refund\.service\.js$/,
        /backend\/services\/return\.service\.js$/,
        /backend\/utils\/upload-helper\.js$/,
    ];

    function walkDir(dir) {
        if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('dist') || dir.includes('build') || dir.includes('__tests__')) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (extensions.some(ext => entry.name.endsWith(`.${ext}`))) {
                sourceFiles.push(fullPath);
            }
        }
    }
    walkDir(srcDir);

    const hardcodedFindings = [];

    // Skip patterns - things that are NOT user-facing
    const skipPatterns = [
        /^[a-z][a-zA-Z]+$/, // camelCase identifiers
        /^[A-Z][A-Z_]+$/, // CONSTANTS
        /^(true|false|null|undefined|none)$/i,
        /^\d+(\.\d+)?$/, // numbers
        /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/,
        /^(error|warning|info|debug|success|log)$/i,
        /^(div|span|button|input|form|select|option|label|img|a|p|h[1-6]|ul|li|table|tr|td|th|thead|tbody|section|article|nav|header|footer|main|aside)$/i,
        /^(text|password|email|number|date|checkbox|radio|submit|hidden|file|tel|url|search)$/i,
        /^(type|className|id|name|value|placeholder|onChange|onClick|onSubmit|ref|key|style|src|href|alt|title|target|rel|data-|aria-)/, // attribute names
        /^(flex|grid|block|inline|none|absolute|relative|fixed|sticky|center|left|right|top|bottom|start|end|auto|inherit|initial)$/i, // CSS values
        /^(sm|md|lg|xl|2xl|xs)$/, // breakpoints
        /^(px|em|rem|vh|vw|%)$/, // CSS units
        /^(rgb|rgba|hsl|hsla|#[0-9a-fA-F]+)/, // colors
        /^[a-z]+\.[a-z]+/i, // dotted keys (likely i18n keys already)
        /^https?:\/\//, // URLs
        /^\/[a-z]/i, // routes/paths
        /^[{}[\]()]/,  // code characters
        /^(application|multipart|text)\//i, // MIME types
        /^(Bearer|Basic)\s/i, // auth headers
        /^(Content-Type|Authorization|Accept|X-|x-)/, // HTTP headers
        /^(json|xml|html|csv|pdf|png|jpg|jpeg|gif|svg|webp|mp4|mp3|wav|ogg)$/i, // file types
        /^\s*$/, // empty/whitespace
    ];

    for (const file of sourceFiles) {
        const relPath = path.relative(ROOT, file);
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        // Skip locale files, config files, type definitions
        if (relPath.includes('locales/') || relPath.includes('.d.ts') || relPath.includes('config') || relPath.includes('vite') || relPath.includes('tailwind')) continue;
        if (skipFilePatterns.some(pattern => pattern.test(relPath))) continue;

        const isTSX = file.endsWith('.tsx') || file.endsWith('.jsx');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip if it's a comment or import
            if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('import ') || line.startsWith('export ')) continue;

            if (isTSX) {
                // Look for JSX text content: >Some Text<
                const jsxTextMatches = line.match(/>[A-Z][^<>{]*[a-z][^<>{}]*</g);
                if (jsxTextMatches) {
                    for (const match of jsxTextMatches) {
                        const text = match.slice(1, -1).trim();
                        if (text.length > 2 && text.length < 200 && !text.startsWith('{') && !text.startsWith('$') && !text.match(/^\d/)) {
                            // Check that it has at least some actual English words
                            if (/[A-Z][a-z]+/.test(text) && !skipPatterns.some(p => p.test(text))) {
                                hardcodedFindings.push({
                                    file: relPath,
                                    line: i + 1,
                                    text: text,
                                    context: line.substring(0, 120)
                                });
                            }
                        }
                    }
                }

                // Look for hardcoded strings in common props: title="...", placeholder="...", label="..."
                const propPatches = line.match(/(title|placeholder|label|alt|aria-label|description|message|text|heading|subtitle|buttonText)=["']([^"'{]+)["']/gi);
                if (propPatches) {
                    for (const match of propPatches) {
                        const parts = match.match(/=["']([^"']+)["']/);
                        if (parts && parts[1]) {
                            const text = parts[1].trim();
                            if (text.length > 2 && /[A-Z][a-z]+/.test(text) && !skipPatterns.some(p => p.test(text))) {
                                hardcodedFindings.push({
                                    file: relPath,
                                    line: i + 1,
                                    text: text,
                                    context: line.substring(0, 120)
                                });
                            }
                        }
                    }
                }
            }

            // For backend: look for hardcoded response messages
            if (!isTSX) {
                // res.json({ message: "..." }), res.status(...).json({ message: "..." })
                const msgMatch = line.match(/message:\s*['"]([A-Z][^'"]+)['"]/);
                if (msgMatch) {
                    const text = msgMatch[1];
                    if (text.length > 3 && /\s/.test(text) && !skipPatterns.some(p => p.test(text))) {
                        hardcodedFindings.push({
                            file: relPath,
                            line: i + 1,
                            text: text,
                            context: line.substring(0, 120)
                        });
                    }
                }

                // throw new Error("..."), new ApiError("...")
                const errorMatch = line.match(/(?:throw new|new)\s+\w*Error\(\s*['"]([A-Z][^'"]+)['"]/);
                if (errorMatch) {
                    const text = errorMatch[1];
                    if (text.length > 3 && /\s/.test(text) && !skipPatterns.some(p => p.test(text))) {
                        hardcodedFindings.push({
                            file: relPath,
                            line: i + 1,
                            text: text,
                            context: line.substring(0, 120)
                        });
                    }
                }
            }
        }
    }

    if (hardcodedFindings.length === 0) {
        console.log(`  ✅ No obvious hardcoded user-facing strings detected`);
    } else {
        console.log(`  ⚠️  Found ${hardcodedFindings.length} potential hardcoded strings:`);
        const grouped = {};
        for (const f of hardcodedFindings) {
            if (!grouped[f.file]) grouped[f.file] = [];
            grouped[f.file].push(f);
        }
        for (const file of Object.keys(grouped).sort()) {
            console.log(`\n    📄 ${file}:`);
            for (const f of grouped[file]) {
                console.log(`       L${f.line}: "${f.text}"`);
                console.log(`         Context: ${f.context}`);
            }
        }
    }

    return hardcodedFindings;
}

// ========== MAIN ==========

function main() {
    console.log('🔍 Comprehensive i18n Audit');
    console.log('='.repeat(80));

    // 1. Frontend locale key consistency
    const frontendAudit = auditLocaleKeys(FRONTEND_LOCALES, 'Frontend');

    // 2. Backend locale key consistency
    const backendAudit = auditLocaleKeys(BACKEND_LOCALES, 'Backend');

    // 3. Frontend source code vs locale keys
    let frontendSourceAudit = null;
    if (frontendAudit.flatMaps.en) {
        frontendSourceAudit = auditSourceVsLocales(
            FRONTEND_SRC,
            frontendAudit.flatMaps.en,
            'Frontend',
            ['tsx', 'ts', 'jsx']
        );
    }

    // 4. Backend source code vs locale keys
    let backendSourceAudit = null;
    if (backendAudit.flatMaps.en) {
        backendSourceAudit = auditSourceVsLocales(
            BACKEND_SRC,
            backendAudit.flatMaps.en,
            'Backend',
            ['js']
        );
    }

    // 5. Hardcoded strings detection - Frontend
    const frontendHardcoded = detectHardcodedStrings(FRONTEND_SRC, 'Frontend');

    // 6. Hardcoded strings detection - Backend
    const backendHardcoded = detectHardcodedStrings(BACKEND_SRC, 'Backend');

    // ========== SUMMARY ==========
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(80));

    console.log('\n  Frontend Locale Keys:');
    console.log(`    Total unique keys: ${frontendAudit.allKeys.size}`);
    console.log(`    Missing entries: ${frontendAudit.totalMissing}`);

    console.log('\n  Backend Locale Keys:');
    console.log(`    Total unique keys: ${backendAudit.allKeys.size}`);
    console.log(`    Missing entries: ${backendAudit.totalMissing}`);

    if (frontendSourceAudit) {
        console.log('\n  Frontend t() calls:');
        console.log(`    Unique keys used: ${frontendSourceAudit.allUsedKeys.size}`);
        console.log(`    Missing from en.json: ${frontendSourceAudit.missingFromLocale.length}`);
    }

    if (backendSourceAudit) {
        console.log('\n  Backend t() calls:');
        console.log(`    Unique keys used: ${backendSourceAudit.allUsedKeys.size}`);
        console.log(`    Missing from en.json: ${backendSourceAudit.missingFromLocale.length}`);
    }

    console.log(`\n  Hardcoded strings:`);
    console.log(`    Frontend: ${frontendHardcoded.length}`);
    console.log(`    Backend: ${backendHardcoded.length}`);

    const totalIssues = frontendAudit.totalMissing + backendAudit.totalMissing +
        (frontendSourceAudit ? frontendSourceAudit.missingFromLocale.length : 0) +
        (backendSourceAudit ? backendSourceAudit.missingFromLocale.length : 0) +
        frontendHardcoded.length + backendHardcoded.length;

    console.log(`\n  Total issues to fix: ${totalIssues}`);

    if (totalIssues === 0) {
        console.log('\n  🎉 All clean! No i18n issues found.');
    } else {
        console.log('\n  ⚠️  Issues found that need attention.');
    }
}

main();
