const fs = require('fs');
const path = require('path');

const planRaw = JSON.parse(fs.readFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_final_audit_plan.json', 'utf8'));

function isTechnical(text) {
  // Ignore logic, identifiers, numbers-only, very short strings
  if (text.length <= 2) return true;
  if (/^[0-9%\s%]+$/.test(text)) return true; // Just numbers or %
  if (text.includes('&&') || text.includes('||') || text.includes('==')) return true;
  if (text.includes('Math.') || text.includes('.length') || text.includes('.map(')) return true;
  if (text.startsWith('framer-') || text.startsWith('lucide-')) return true;
  if (text.includes('${')) return true; // Template literals (handled differently)
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return true; // Single variable names
  return false;
}

const cleanedPlan = {
  missingKeysToDefine: planRaw.missingKeysToDefine,
  hardcodedToConvert: planRaw.hardcodedToConvert.filter(h => !isTechnical(h.text))
};

// Improve suggested keys for new hardcoded strings
cleanedPlan.hardcodedToConvert.forEach(h => {
  if (!h.isExisting) {
     const relPath = path.relative('/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src', h.file);
     const parts = relPath.replace('.tsx', '').replace('.ts', '').split('/');
     const base = parts.join('.').toLowerCase();
     const suffix = h.text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').split('.').slice(0, 3).join('.');
     h.suggestedKey = `${base}.${suffix}`;
  }
});

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_cleaned_plan.json', JSON.stringify(cleanedPlan, null, 2));
console.log('Cleaned Plan Ready.');
