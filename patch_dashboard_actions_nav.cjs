const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

const navCode = `
export const viewCountdownsAction: JarvisAction = {
  id: 'view_countdowns',
  description: 'Navigates to the Dashboard and scrolls to the Countdowns section.',
  requiredParams: [],
  feedbackMessage: 'Showing your countdowns.',
  execute: async (params, context) => {
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'countdowns'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#countdowns');
    }
    return true;
  }
};

export const viewChallengesAction: JarvisAction = {
  id: 'view_active_challenges',
  description: 'Navigates to the Dashboard and scrolls to the Active Challenges section.',
  requiredParams: [],
  feedbackMessage: 'Showing your active challenges.',
  execute: async (params, context) => {
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'challenges'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#challenges');
    }
    return true;
  }
};
`;

if (!code.includes('view_countdowns')) {
    code = code.replace(/export const dashboardActions: JarvisAction\[\] = \[.*?\];/, 
      navCode + "\nexport const dashboardActions: JarvisAction[] = [addLiveMockAction, filterPerformanceTrendAction, viewHistoryLogAction, viewCountdownsAction, viewChallengesAction];");
    fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
    console.log("Patched dashboardActions.ts with nav actions");
} else {
    console.log("Already patched dashboardActions with nav actions");
}
