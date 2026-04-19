const fs = require('fs');
let content = fs.readFileSync('components/FancoilCheck.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 114; i <= 245; i++) {
  lines[i] = lines[i].replace(/isPopupMode \? 'rounded-none border-gray-300 border'/g, "isPopupMode ? 'rounded-none border-black border'");
  lines[i] = lines[i].replace(/isPopupMode \? 'py-2 text-\[10px\] border-gray-300 w-\[35px\]'/g, "isPopupMode ? 'py-2 text-[10px] border-black w-[35px]'");
  lines[i] = lines[i].replace(/isPopupMode \? 'py-2 text-\[10px\] border-gray-300'/g, "isPopupMode ? 'py-2 text-[10px] border-black'");
  lines[i] = lines[i].replace(/isPopupMode \? 'border-gray-300' : 'border-gray-300'/g, "isPopupMode ? 'border-black' : 'border-gray-300'");
}
fs.writeFileSync('components/FancoilCheck.tsx', lines.join('\n'));
