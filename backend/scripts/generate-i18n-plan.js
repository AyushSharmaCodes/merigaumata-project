const fs = require('fs');
const path = require('path');

const scanResults = JSON.parse(fs.readFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/frontend_scan_results.json', 'utf8'));
const valToKeyMap = JSON.parse(fs.readFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/en_val_to_key.json', 'utf8'));
const missingKeys = fs.readFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/all_missing_in_en.txt', 'utf8').split('\n').filter(k => k.trim() && k.length > 2);

const finalPlan = {
  missingKeysToDefine: {}, // key -> Suggested Value
  hardcodedToConvert: [] // { file, line, text, suggestedKey, isExisting }
};

// 1. Process Missing Keys
// Try to find default values in scanResults
scanResults.forEach(fileRes => {
  fileRes.tCalls.forEach(tCall => {
    if (missingKeys.includes(tCall.key)) {
       // Deep search for the t(key, "default") pattern in the actual file line
       const content = fs.readFileSync(fileRes.filePath, 'utf8');
       const lines = content.split('\n');
       const line = lines[tCall.line - 1];
       const match = line.matchAll(/t\(['"]([^'"]+)['"]\s*,\s*["']([^"']+)["']\)/g);
       for (const m of match) {
         if (m[1] === tCall.key) {
           finalPlan.missingKeysToDefine[tCall.key] = m[2];
         }
       }
    }
  });
});

// For missing keys with no default, use the key itself as placeholder
missingKeys.forEach(k => {
  if (!finalPlan.missingKeysToDefine[k]) {
    finalPlan.missingKeysToDefine[k] = k.split('.').pop().replace(/([A-Z])/g, ' $1').trim();
  }
});

// 2. Process Hardcoded Strings
scanResults.forEach(fileRes => {
  const relPath = path.relative('/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src', fileRes.filePath);
  const moduleName = relPath.split('/')[0].toLowerCase();
  
  fileRes.hardcoded.forEach(h => {
    const val = h.text.trim().toLowerCase();
    const existingKeys = valToKeyMap[val];
    
    if (existingKeys && existingKeys.length > 0) {
      finalPlan.hardcodedToConvert.push({
        file: fileRes.filePath,
        line: h.line,
        text: h.text,
        suggestedKey: existingKeys[0], // Use the first matching key
        isExisting: true
      });
    } else {
      // Suggest a new key
      const keySafeText = h.text.replace(/[^a-zA-Z0-9]+/g, '.').split('.').slice(0, 3).join('.');
      const suggestedKey = `${moduleName}.common.${keySafeText.toLowerCase()}`;
      finalPlan.hardcodedToConvert.push({
            file: fileRes.filePath,
            line: h.line,
            text: h.text,
            suggestedKey: suggestedKey,
            isExisting: false
      });
    }
  });
});

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/i18n_final_audit_plan.json', JSON.stringify(finalPlan, null, 2));
console.log('Deep audit complete. Check i18n_final_audit_plan.json');
