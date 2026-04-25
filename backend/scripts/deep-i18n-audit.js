const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const missingKeysFile = '/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/all_missing_in_en.txt';
const projectRoot = '/Users/ayushsharma/Developer/Projects/merigaumata-project';

const missingKeys = fs.readFileSync(missingKeysFile, 'utf8').split('\n').filter(Boolean);

const results = [];

missingKeys.forEach(key => {
  if (key.length < 3) return; // Skip minor/junk keys like "-", "T", "a"
  
  try {
    // Search for the key in the code
    const escapedKey = key.replace(/"/g, '\\"');
    const output = execSync(`grep -rF "${escapedKey}" ${projectRoot}/frontend/src ${projectRoot}/backend -h -C 1 | head -n 5`, { encoding: 'utf8' });
    results.push({ key, context: output });
  } catch (e) {
    // Possibly no match (regex fail or similar)
    results.push({ key, context: 'NOT_FOUND' });
  }
});

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/missing_keys_deep_audit.txt', JSON.stringify(results, null, 2));
