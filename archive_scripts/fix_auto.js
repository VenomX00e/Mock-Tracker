import fs from 'fs';

const files = [
  'src/components/AddLiveMockDialog.tsx',
  'src/components/AdminDialog.tsx',
  'src/components/CommunityHub.tsx',
  'src/components/AddMockDialog.tsx',
  'src/App.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf-8');
    c = c.replace(/autoComplete="new-password"/g, 'autoComplete="off"');
    fs.writeFileSync(f, c, 'utf-8');
  }
});
