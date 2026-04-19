const fs = require('fs');
let content = fs.readFileSync('components/FancoilCheck.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 114; i <= 245; i++) {
  lines[i] = lines[i].replace(/border-black/g, 'border-gray-300');
}
fs.writeFileSync('components/FancoilCheck.tsx', lines.join('\n'));
