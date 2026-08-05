const fs = require('fs');
let code = fs.readFileSync('src/hooks/useJarvisListener.ts', 'utf8');

const navigateBlock = `
        case 'NAVIGATE':
          if (action.payload) {
            let [fullPath, hash] = action.payload.split('#');
            fullPath = fullPath.replace(/^\\//, '').toLowerCase();
            
            // Fuzzy mapping for robust navigation
            if (fullPath.includes('math')) fullPath = 'learning/math';
            else if (fullPath.includes('vocab')) fullPath = 'learning/vocab';
            else if (fullPath.includes('practice')) fullPath = 'learning/practice';
            else if (fullPath.includes('ai tutor') || fullPath === 'learning') fullPath = 'learning/ai';
            else if (fullPath.includes('home')) fullPath = 'dashboard';
            else if (fullPath.includes('setting')) fullPath = 'profile';

            const parts = fullPath.split('/');
            const mainTab = parts[0];
            const subTab = parts[1];
            const section = parts[2];
            
            // Set the main view in ViewManager
            setActiveTab(mainTab as any);
            
            if (mainTab === 'learning') {
              if (fullPath.includes('math')) setLearningTab('math');
              else if (fullPath.includes('vocab')) setLearningTab('vocab');
              else if (fullPath.includes('practice')) setLearningTab('practice');
              else setLearningTab('ai');
            }
            
            if (section || hash) {
               setTimeout(() => {
                 if (hash) {
                   const element = document.getElementById(hash);
                   if (element) {
                     element.scrollIntoView({ behavior: 'smooth' });
                   }
                 }
                 if (section) {
                   jarvisEventBus.dispatch({ type: 'SUB_NAVIGATE', payload: { mainTab, subTab, section } });
                 }
               }, 300); 
            }
          }
          break;
`;

code = code.replace(/case 'NAVIGATE':[\s\S]*?break;/, navigateBlock.trim());
fs.writeFileSync('src/hooks/useJarvisListener.ts', code);
console.log("Patched listener for sub-navigation");
