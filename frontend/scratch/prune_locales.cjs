const fs = require('fs');
const path = require('path');

const localesDir = 'src/i18n/locales';
const files = ['en.json', 'hi.json', 'ta.json', 'te.json'];

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    const prune = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (
          key.toLowerCase().includes('newsletter') || 
          key === 'can_manage_newsletter' || 
          key === 'canManageNewsletter'
        ) {
          console.log(`Deleting key: ${key} from ${file}`);
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          prune(obj[key]);
        }
      });
    };

    prune(json);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    console.log(`Successfully pruned ${file}`);
  } catch (err) {
    console.error(`Error processing ${file}:`, err);
  }
});
