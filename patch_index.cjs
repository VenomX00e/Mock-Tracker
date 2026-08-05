const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/index.ts', 'utf8');

const newImports = `
import { dashboardActions } from './dashboard/dashboardActions';
import { aiTutorActions } from './learning/aiTutorActions';
import { vocabularyActions } from './learning/vocabularyActions';
import { speedMathActions } from './learning/speedMathActions';
import { practiceLibraryActions } from './learning/practiceLibraryActions';
import { tasksActions } from './tasks/tasksActions';
import { mocksActions } from './mocks/mocksActions';
import { communityActions } from './community/communityActions';
import { systemActions } from './system/systemActions';

export const allActions: JarvisAction[] = [
  ...dashboardActions,
  ...aiTutorActions,
  ...vocabularyActions,
  ...speedMathActions,
  ...practiceLibraryActions,
  ...tasksActions,
  ...mocksActions,
  ...communityActions,
  ...systemActions,
];
`;

if (!code.includes('export const allActions')) {
    // Add imports and allActions array right before actionRegistry
    code = code.replace("export const actionRegistry: Record<string, JarvisAction> = {", newImports + "\nexport const actionRegistry: Record<string, JarvisAction> = {");
    
    // Add dynamically putting them in registry
    code = code.replace("  [openSettings.id]: openSettings,\n};", "  [openSettings.id]: openSettings,\n};\n\nallActions.forEach(action => {\n  actionRegistry[action.id] = action;\n});");
    
    fs.writeFileSync('src/features/jarvis/actions/index.ts', code);
    console.log("Patched index.ts successfully.");
} else {
    console.log("Already patched.");
}
