const fs = require('fs');

function getFlatMap(obj, prefix = '', map = {}) {
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key} ` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      getFlatMap(obj[key], fullKey, map);
    } else {
      const val = String(obj[key]).trim().toLowerCase();
      if (!map[val]) map[val] = [];
      map[val].push(fullKey.trim());
    }
  }
  return map;
}

const enJson = JSON.parse(fs.readFileSync('/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src/i18n/locales/en.json', 'utf8'));
const valToKeyMap = getFlatMap(enJson);

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/en_val_to_key.json', JSON.stringify(valToKeyMap, null, 2));
console.log(`Mapped ${Object.keys(valToKeyMap).length} unique values.`);
