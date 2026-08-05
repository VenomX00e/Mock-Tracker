// Route Keyword & Intent Classifier for Jarvis Assistant
export function detectTargetRoute(userPrompt: string): string | null {
  const prompt = userPrompt.toLowerCase();
  
  if (/live mock|test series|mock test|sectional|full mock/i.test(prompt)) return 'dashboard'; // 'dashboard' handles Live Mocks & Test Series
  if (/leaderboard|community|rank|top scorer/i.test(prompt)) return 'community';
  if (/learning|practice|flashcard|study material/i.test(prompt)) return 'learning';
  if (/task|todo|action item|pending/i.test(prompt)) return 'tasks';
  if (/profile|settings|target exam|bio/i.test(prompt)) return 'profile';

  return null; // Stays on current route if general/unmatched
}

