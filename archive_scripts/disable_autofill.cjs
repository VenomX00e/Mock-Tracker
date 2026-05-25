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
    
    // Add autoComplete="new-password", set an unpredictable name
    content = content.replace(/<input\s+autoComplete="off"/g, '<input autoComplete="new-password" name={"input-" + Math.random().toString(36).substring(7)} id={"input-" + Math.random().toString(36).substring(7)}');

    // Also change <form> to <div> in AddMockDialog
    if (file.includes('AddMockDialog.tsx')) {
        content = content.replace(/<form id="mock-form" autoComplete="off" onSubmit=\{handleSubmit\}/g, '<div id="mock-form"');
        content = content.replace(
        /type="submit"\s*form="mock-form"/g,
        'type="button" onClick={handleSubmit}'
        );
        content = content.replace(/<\/form>/g, '</div>');
    }

    fs.writeFileSync(file, content, 'utf-8');
    console.log('Modified ' + file);
  }
});
