const fs = require('fs');
const path = require('path');

const reportRaw = JSON.parse(fs.readFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cross_validation_results.json', 'utf8'));

function isNotUiKey(key) {
  // Ignore routes, technical terms, single chars
  if (key.length <= 2) return true;
  if (key.startsWith('./') || key.startsWith('/') || key.startsWith('@/')) return true;
  if (['axios', 'canvas', '2d', 'jobId', 'auth', 'status', 'token', 'meta'].includes(key)) return true;
  if (key.includes('?')) return true;
  if (key.includes(':')) return true;
  if (key.includes(' ') && !key.includes('.')) return true; // Likely a hardcoded string already in t() but not a key structure?
  return false;
}

const cleanedReport = reportRaw.filter(r => !isNotUiKey(r.key));

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cross_validation_cleaned.json', JSON.stringify(cleanedReport, null, 2));

let md = '# Cleaned I18n Cross-Validation Report\n\n';
md += '| File | Key | Status |\n';
md += '| --- | --- | --- |\n';

const missingOnly = cleanedReport.filter(r => r.status === 'MISSING_IN_EN_JSON');
missingOnly.forEach(r => {
  md += `| ${r.file} | \`${r.key}\` | ${r.status} |\n`;
});

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cross_validation_cleaned.md', md);
console.log(`Cleaned report generated. Found ${missingOnly.length} real missing keys.`);
