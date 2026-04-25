const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'dist', 'build'];
const includeExts = ['.tsx', '.ts'];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const hardcoded = [];
  const tCalls = [];

  lines.forEach((line, index) => {
    // Find t() calls
    const tMatch = line.matchAll(/t\(['"]([^'"]+)['"]/g);
    for (const match of tMatch) {
      tCalls.push({ key: match[1], line: index + 1 });
    }

    // Find hardcoded strings in JSX patterns:
    // 1. >Text</
    // 2. placeholder="Text"
    // 3. label="Text"
    // 4. title="Text"
    
    // Pattern 1: Text between tags (basic)
    const textBetweenTags = line.match(/>([^<>{}"']+)</);
    if (textBetweenTags && textBetweenTags[1].trim() && textBetweenTags[1].length > 2) {
      hardcoded.push({ text: textBetweenTags[1].trim(), line: index + 1, type: 'jsx_text' });
    }

    // Pattern 2: Attributes
    const attrs = ['placeholder', 'label', 'title', 'description', 'alt'];
    attrs.forEach(attr => {
      const attrMatch = line.match(new RegExp(`${attr}=["']([^"']+)["']`));
      if (attrMatch && attrMatch[1].trim() && !attrMatch[1].startsWith('t(') && attrMatch[1].length > 2) {
        // Skip common false positives (like IDs or paths)
        if (!attrMatch[1].includes('/') && !attrMatch[1].includes('_')) {
           hardcoded.push({ text: attrMatch[1].trim(), line: index + 1, type: `attr_${attr}` });
        }
      }
    });
  });

  return { filePath, hardcoded, tCalls };
}

function walk(dir, results = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walk(fullPath, results);
      }
    } else if (includeExts.includes(path.extname(file))) {
      results.push(scanFile(fullPath));
    }
  });
  return results;
}

const frontendDir = '/Users/ayushsharma/Developer/Projects/merigaumata-project/frontend/src';
const allResults = walk(frontendDir);

fs.writeFileSync('/Users/ayushsharma/.gemini/antigravity/brain/ad18b584-542d-480a-a5ec-3ffbd4ae1741/scratch/frontend_scan_results.json', JSON.stringify(allResults, null, 2));
console.log(`Scanned ${allResults.length} files.`);
