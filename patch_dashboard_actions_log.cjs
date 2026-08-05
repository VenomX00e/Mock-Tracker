const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

const filterLogCode = `
export const viewHistoryLogAction: JarvisAction = {
  id: 'view_history_log',
  description: 'Scrolls to the History Log and filters the table to show mocks taken on a specific day.',
  requiredParams: ['date'],
  feedbackMessage: (params) => {
    return \`Showing history log for \${params.date}.\`;
  },
  execute: async (params, context) => {
    let dateStr = params.date;
    
    // Process "today" or "yesterday"
    if (dateStr) {
      const d = dateStr.toLowerCase();
      const today = new Date();
      if (d === 'today') {
        dateStr = today.toISOString().split('T')[0];
      } else if (d === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateStr = yesterday.toISOString().split('T')[0];
      }
    }

    const { useCacheStore } = await import('../../../../store/analyticsStore');
    
    if (dateStr) {
        useCacheStore.getState().updateDashboardCache({
            selectedHistoryDate: dateStr
        });
    }

    // Navigate to Dashboard's History Log section
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'history-log'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#history-log');
    }

    return true;
  }
};
`;

if (!code.includes('view_history_log')) {
    code = code.replace(/export const dashboardActions: JarvisAction\[\] = \[.*?\];/, 
      filterLogCode + "\nexport const dashboardActions: JarvisAction[] = [addLiveMockAction, filterPerformanceTrendAction, viewHistoryLogAction];");
    fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
    console.log("Patched dashboardActions.ts with view_history_log");
} else {
    console.log("Already patched dashboardActions");
}
