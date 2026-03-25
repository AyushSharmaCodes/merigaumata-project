const fs = require('fs');
const path = require('path');

const filePath = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/src/i18n/locales/en.json';
const fileContent = fs.readFileSync(filePath, 'utf8');
const lines = fileContent.split('\n');

// Target logic:
// 1. Line 4336 (0-indexed 4335): "    }," -> "    }" (anonymous ending)
// 2. Insert "  }," after 4336.
// 3. Unindent lines 4337 (0-indexed 4336) to 6823 (0-indexed 6822).
// 4. Line 6823 (0-indexed 6822): "    "selectSize": "Select product size"" -> "  "selectSize": "Select product size"," (Add comma for next root key)
// 5. Delete line 6824 (0-indexed 6823): "  },"

// Verification
const line4336Index = 4335;
if (!lines[line4336Index].includes('},')) {
    console.error('Line 4336 verification failed:', lines[line4336Index]);
    process.exit(1);
}

const line6824Index = 6823;
if (!lines[line6824Index].includes('},')) {
    console.error('Line 6824 verification failed:', lines[line6824Index]);
    process.exit(1);
}

console.log('Verification passed. Applying fixes...');

// 1. Fix anonymous block end
lines[line4336Index] = lines[line4336Index].replace('},', '}');

// 2. Unindent range
const startUnindent = 4336; // Line 4337
const endUnindent = 6822;   // Line 6823
for (let i = startUnindent; i <= endUnindent; i++) {
    if (lines[i].startsWith('    ')) {
        lines[i] = lines[i].substring(2);
    } else if (lines[i].startsWith('  ')) { // In case some are only 2 spaces improperly?
        // Do nothing or warn? Assuming they are 4 spaces min.
        // If a line is empty, ignore.
    }
}

// 3. Add comma to selectSize (last item of unindented block)
const selectSizeIndex = 6822;
// Check if it already has comma (unlikely but safe)
if (!lines[selectSizeIndex].trim().endsWith(',')) {
    lines[selectSizeIndex] += ',';
}

// 4. Remove the old closing brace of the nested block
// Splice changes indices, so do this before insertion if indices matter, 
// OR do it carefully.
// The old closing brace is at 6823 (line 6824).
lines.splice(6823, 1);

// 5. Insert closing brace for donation
// We want to insert AFTER line 4336 (index 4335).
// Insertion index is 4336.
lines.splice(4336, 0, '  },');

// Write back
fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed en.json structure.');
