const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'backend'];
const includeExts = ['.tsx', '.ts'];
const frontendDir = '/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src';
const enJsonPath = '/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src/i18n/locales/en.json';

// Load existing en.json keys
function getFlatKeys(obj, prefix = '') {
  let keys = new Set();
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      const nested = getFlatKeys(obj[key], fullKey);
      nested.forEach(k => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
const definedKeys = getFlatKeys(enJson);

// Load Backend Constants keys
const backendConstantsDir = '/Users/ayushsharma/Developer/Projects/merigaumata-project/backend/constants/messages';
const backendConstantKeys = new Set();
const messageFiles = fs.readdirSync(backendConstantsDir);
messageFiles.forEach(file => {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(backendConstantsDir, file), 'utf8');
    const matches = content.matchAll(/ = '([^']+)';/g);
    for (const m of matches) {
      backendConstantKeys.add(m[1]);
    }
  }
});

const allPossibleKeys = new Set([...definedKeys, ...backendConstantKeys]);

const report = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.join(frontendDir, '..', '..'), filePath);
  
  // 1. Find t('key') and i18n.t('key')
  const tMatches = content.matchAll(/(?:i18n\.)?t\(['"]([^'"]+)['"]/g);
  for (const m of tMatches) {
    const key = m[1];
    if (!definedKeys.has(key)) {
      report.push({ file: relPath, key, status: 'MISSING_IN_EN_JSON', type: 'dynamic' });
    } else {
      report.push({ file: relPath, key, status: 'VALID', type: 'dynamic' });
    }
  }

  // 2. Find usage of backend constants if they are imported
  // This is harder, so we'll look for strings that match backend constant keys
  backendConstantKeys.forEach(key => {
    if (content.includes(`'${key}'`) || content.includes(`"${key}"`)) {
       if (!definedKeys.has(key)) {
          report.push({ file: relPath, key, status: 'MISSING_IN_EN_JSON', type: 'constant' });
       } else {
          report.push({ file: relPath, key, status: 'VALID', type: 'constant' });
       }
    }
  });
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!excludeDirs.includes(file)) walk(fullPath);
    } else if (includeExts.includes(path.extname(file))) {
      scanFile(fullPath);
    }
  });
}

walk(frontendDir);

// Generate Markdown table
let md = '# I18n Cross-Validation Report\n\n';
md += '| File | Key | Status | Type |\n';
md += '| --- | --- | --- | --- |\n';

const missingOnly = report.filter(r => r.status === 'MISSING_IN_EN_JSON');
missingOnly.forEach(r => {
  md += `| ${r.file} | \`${r.key}\` | ${r.status} | ${r.type} |\n`;
});

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cross_validation_report.md', md);
fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cross_validation_results.json', JSON.stringify(report, null, 2));

console.log(`Cross-validation complete. Found ${missingOnly.length} missing keys across ${new Set(missingOnly.map(r => r.file)).size} files.`);
