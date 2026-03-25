const fs = require('fs');
const filePath = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/src/i18n/locales/en.json';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Remove string content to avoid confusion with braces in strings
    const cleanLine = line.replace(/"[^"]*"/g, '""');

    // Count braces
    for (let char of cleanLine) {
        if (char === '{') {
            const match = line.match(/"([^"]+)":\s*\{/);
            const key = match ? match[1] : 'unknown';
            stack.push({ line: i + 1, key });
        } else if (char === '}') {
            stack.pop();
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed blocks:');
    stack.forEach(s => console.log(`Line ${s.line}: ${s.key}`));
} else {
    console.log('All blocks closed (brace count match).');
    // Check if extra text at end?
}
