const fs = require('fs');
let code = fs.readFileSync('src/components/views/LiveMocksSection.tsx', 'utf8');

if (!code.includes('id="live-mocks"')) {
    code = code.replace(/<div className="relative mb-5 mt-0 pt-\[12px\] pb-\[0px\] pl-\[0px\] pr-\[12px\]" style=\{\{ paddingBottom: '0px', paddingLeft: '0px' \}\}>/, "<div id=\"live-mocks\" className=\"relative mb-5 mt-0 pt-[12px] pb-[0px] pl-[0px] pr-[12px] scroll-mt-24\" style={{ paddingBottom: '0px', paddingLeft: '0px' }}>");
    fs.writeFileSync('src/components/views/LiveMocksSection.tsx', code);
    console.log("Patched LiveMocksSection.tsx with id");
}
