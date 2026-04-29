const fs = require('fs');

let files = [
  'src/components/AddLiveMockDialog.tsx',
  'src/components/AdminDialog.tsx',
  'src/components/CommunityHub.tsx',
  'src/components/AddMockDialog.tsx',
  'src/App.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Remove the dynamic Math.random() names and IDs which cause re-rendering bugs
    content = content.replace(/name=\{"input-" \+ Math\.random\(\)\.toString\(36\)\.substring\(7\)\}/g, '');
    content = content.replace(/id=\{"input-" \+ Math\.random\(\)\.toString\(36\)\.substring\(7\)\}/g, '');
    
    // Change to a single known un-guessable string "xyz-dummy-input"
    // The previous replace might have replaced autoComplete="off" to autoComplete="new-password". 
    // Usually autoComplete="new-password" with no name works fine.
    
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Modified ' + file);
  }
});
