const fs = require('fs');
const path = require('path');

function getFlatKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys = keys.concat(getFlatKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const localesDir = '/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src/i18n/locales';
const languages = ['en', 'hi', 'ta', 'te'];

languages.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = getFlatKeys(content);
    console.log(`--- ${lang} ---`);
    console.log(`Total Keys: ${keys.length}`);
    // Save keys to a temporary file for analysis
    fs.writeFileSync(`/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/keys_${lang}.txt`, keys.join('\n'));
  }
});
