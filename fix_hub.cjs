const fs = require('fs');

let hub = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');

if (!hub.includes('import { getSub }')) {
  hub = hub.replace(
    /import \{ getErrorMessage \} from '\.\.\/lib\/errorUtils';/,
    "import { getErrorMessage } from '../lib/errorUtils';\nimport { getSub } from '../lib/subjectUtils';"
  );
  fs.writeFileSync('src/components/CommunityHub.tsx', hub);
}
