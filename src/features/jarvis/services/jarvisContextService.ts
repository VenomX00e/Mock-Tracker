import { useUIStore } from '../../../store/uiStore';
import { useVersionStore } from '../../../store/versionStore';
import { useSpeedMathStore } from '../../../store/speedMathStore';
import { useVocabularyStore } from '../../../store/vocabularyStore';
import { useCacheStore } from '../../../store/analyticsStore';
import { domUtils } from '../domUtils';
import { 
  JarvisPageContext, 
  ScreenLocation, 
  ScreenDataSnapshot, 
  VisionContextPayload 
} from '../types/contextTypes';

export interface RouteContextResult {
  title: string;
  visibleSummary: Record<string, string>;
  visibleItems: string[];
}

export function buildCommunityContext(extraProfile?: any, domContext?: any): RouteContextResult {
  const cache = useCacheStore.getState();
  let sortedLeaderboard = cache.sortedLeaderboard || [];

  if ((!sortedLeaderboard || sortedLeaderboard.length === 0) && (cache.allUsers?.length > 0 || cache.activeAllUsers?.length > 0)) {
    const rawList = cache.allUsers?.length > 0 ? cache.allUsers : cache.activeAllUsers;
    sortedLeaderboard = [...rawList].sort((a: any, b: any) => (b.avgPercentile || 0) - (a.avgPercentile || 0));
  }

  // Scrape DOM items as fallback if cache stores are pending or empty
  const liveDom = domContext || (typeof window !== 'undefined' ? domUtils.scrapeJarvisDomData() : { items: [] });
  const domLeaderboardItems = (liveDom.items || []).filter((i: string) => i.includes('Leaderboard Rank') || i.toLowerCase().includes('rank #'));

  const leaderboardItems = sortedLeaderboard.length > 0
    ? sortedLeaderboard.slice(0, 10).map((user: any, idx: number) => {
        const quantVal = user.avgQuantPercentile ?? user.dynamicAverages?.quant ?? 0;
        return `Leaderboard Rank #${idx + 1}: ${user.displayName || 'User'} - Full Percentile: ${user.avgPercentile || 0}%, Quant: ${quantVal}%, Streak: ${user.streak || 0} days`;
      })
    : domLeaderboardItems;

  const totalCount = Math.max(sortedLeaderboard.length, domLeaderboardItems.length);

  const summary: Record<string, string> = {
    activeTab: "Community Hub & Leaderboard",
    totalAspirantsOnLeaderboard: `${totalCount}`,
  };

  if (sortedLeaderboard[0]) {
    const topUser = sortedLeaderboard[0];
    summary.rank1Aspirant = `${topUser.displayName || 'User'} - ${topUser.avgPercentile || 0}%ile`;
  } else if (domLeaderboardItems[0]) {
    summary.rank1Aspirant = domLeaderboardItems[0];
  }

  return {
    title: "Community Hub & Aspirant Leaderboard",
    visibleSummary: summary,
    visibleItems: [
      "Community Section: Aspirant Leaderboard",
      ...(leaderboardItems.length > 0 ? leaderboardItems : ["Community Section: Activity Log Feed"]),
    ],
  };
}

export function buildProfileContext(extraProfile?: any): RouteContextResult {
  const userName = extraProfile?.name || extraProfile?.displayName || 'User';
  const targetExam = extraProfile?.targetExam || extraProfile?.targetExamName || 'Competitive Exam';
  const sector = extraProfile?.categoryName || extraProfile?.categoryId || 'General';
  const bio = extraProfile?.bio || 'Not set';
  return {
    title: "User Profile Settings",
    visibleSummary: {
      displayName: userName,
      targetExam: targetExam,
      sector: sector,
      bio: bio,
    },
    visibleItems: [
      `Profile Field: Display Name (${userName})`,
      `Profile Field: Target Exam (${targetExam})`,
      `Profile Field: Sector (${sector})`,
      `Profile Field: Bio (${bio})`,
    ],
  };
}

export function buildTasksContext(extraProfile?: any): RouteContextResult {
  const tasks = extraProfile?.tasks || [];
  const pending = tasks.filter((t: any) => !t.completed).length;
  const completed = tasks.filter((t: any) => t.completed).length;
  return {
    title: "Tasks & Study Planner",
    visibleSummary: {
      pendingTasks: `${pending}`,
      completedTasks: `${completed}`,
      totalTasks: `${tasks.length}`,
    },
    visibleItems: tasks.slice(0, 5).map((t: any) => `Task: ${t.title || t.text} [Status: ${t.completed ? 'Completed' : 'Pending'}]`),
  };
}

export function buildLearningContext(learningSubTab?: string): RouteContextResult {
  const sub = learningSubTab || 'ai';
  const subTitle = sub === 'ai' ? 'AI Tutor' : sub === 'vocab' ? 'Vocabulary' : sub === 'math' ? 'Speed Math' : sub === 'practice' ? 'Practice Library' : sub;
  return {
    title: `Learning Hub - ${subTitle}`,
    visibleSummary: {
      activeSubTab: subTitle,
    },
    visibleItems: [
      `Learning Hub Sub-tab: ${subTitle}`,
    ],
  };
}

export function buildDashboardContext(extraProfile?: any, extraSystemData?: any): RouteContextResult {
  const mocks = extraProfile?.mocks || [];
  const latestMock = mocks.length > 0 ? mocks[0] : null;
  const liveMocks = extraSystemData?.liveMocks || [];
  
  return {
    title: "Performance Analytics & Mock Results Table",
    visibleSummary: latestMock ? {
      latestMockScore: `${latestMock.score} / ${latestMock.totalScore || 300}`,
      percentile: latestMock.percentile !== undefined ? `${latestMock.percentile}%ile` : undefined,
      totalMocks: `${mocks.length}`,
    } : {
      totalMocks: `${mocks.length}`,
    },
    visibleItems: [
      ...(liveMocks.slice(0, 3).map((m: any) => `Live Mock: ${m.title || m.name}`)),
      ...(mocks.slice(0, 3).map((m: any) => `Mock Log: ${m.title || m.examName || 'Full Test'} - ${m.score ?? '-'} Marks`)),
    ],
  };
}

export function buildHomeContext(extraProfile?: any): RouteContextResult {
  const userName = extraProfile?.name || extraProfile?.displayName || 'User';
  const targetExam = extraProfile?.targetExam || extraProfile?.targetExamName || 'Competitive Exam';
  const mocks = extraProfile?.mocks || [];
  return {
    title: `Home Dashboard (Greeting: Welcome, ${userName})`,
    visibleSummary: {
      targetExam: `${targetExam}`,
    },
    visibleItems: [
      `Greeting Banner: Good Afternoon, ${userName}!`,
      `Daily Motivation Quote Card`,
      `Activity Map Component: Heatmap of monthly test attempts (${mocks.length} total mocks recorded)`,
    ],
  };
}

export function buildScreenContext(activeTab: string, uiState: any, domContext?: any, extraProfile?: any, extraSystemData?: any): RouteContextResult {
  switch (activeTab) {
    case 'community':
      return buildCommunityContext(extraProfile, domContext);
    case 'profile':
      return buildProfileContext(extraProfile);
    case 'tasks':
      return buildTasksContext(extraProfile);
    case 'learning':
      return buildLearningContext(uiState?.learningTab);
    case 'dashboard':
      return buildDashboardContext(extraProfile, extraSystemData);
    case 'home':
    default:
      return buildHomeContext(extraProfile);
  }
}

/**
 * Extracts structured VisionContextPayload applying DOM-First precedence and non-analytic summary suppression.
 */
export function getVisionContext(
  activeTab: string, 
  activeModal: string | null, 
  extraProfile?: any, 
  extraSystemData?: any, 
  domContext?: any
): VisionContextPayload {
  const uiState = useUIStore.getState();
  const routeCtx = buildScreenContext(activeTab, uiState, domContext, extraProfile, extraSystemData);
  const targetExam = extraProfile?.targetExam || extraProfile?.targetExamName || 'Competitive Exam';
  const screenTitle = activeModal 
    ? `${targetExam} - Modal (${activeModal})` 
    : routeCtx.title;

  const liveDom = domContext || (typeof window !== 'undefined' ? domUtils.scrapeJarvisDomData() : { items: [], sections: [], stats: {} });
  const domItems: string[] = liveDom.items || [];
  const domSections: string[] = liveDom.sections || [];

  // Suppress all default visibleSummary metrics when on non-analytic tabs (home, community, profile, learning, tasks)
  const nonAnalyticTabs = ['home', 'community', 'profile', 'learning', 'tasks'];
  let visibleSummary = { ...routeCtx.visibleSummary, ...(liveDom.stats || {}) };
  if (nonAnalyticTabs.includes(activeTab)) {
    // Only retain operational identifiers, remove default test performance metrics
    const { 
      latestMockScore, 
      overallAccuracy, 
      accuracy, 
      studyStreak, 
      streak, 
      avgScore, 
      percentile, 
      avgPercentile, 
      avgAccuracy, 
      totalMocks, 
      totalMocksAttempted, 
      ...cleanSummary 
    } = visibleSummary as any;
    visibleSummary = cleanSummary;
  }

  // DOM Precedence Logic: If domItems.length > 0, build visibleItems solely from domItems and domSections.
  let visibleItems: string[] = [];
  if (domItems.length > 0) {
    const formattedSections = domSections.map((s: string) => `Section: ${s}`);
    visibleItems = Array.from(new Set([...formattedSections, ...domItems]));
  } else {
    visibleItems = routeCtx.visibleItems || [];
  }

  const mocks = extraProfile?.mocks || [];
  const weakSubjectsSet = new Set<string>();
  const strongSubjectsSet = new Set<string>();
  mocks.forEach((m: any) => {
    if (m.weakAreas && Array.isArray(m.weakAreas)) {
      m.weakAreas.forEach((w: string) => weakSubjectsSet.add(w));
    }
    if (m.subjectBreakdown) {
      Object.entries(m.subjectBreakdown).forEach(([subj, sData]: [string, any]) => {
        if (sData && typeof sData === 'object') {
          const scorePercent = sData.maxScore ? (sData.score / sData.maxScore) * 100 : (sData.accuracy || 0);
          if (scorePercent < 50) weakSubjectsSet.add(subj);
          if (scorePercent >= 75) strongSubjectsSet.add(subj);
        }
      });
    }
  });

  const visionContext: VisionContextPayload = {
    navigation: {
      currentTab: activeTab,
      activeSubject: activeTab === 'learning' ? (uiState.learningTab || null) : null,
      activeMockId: activeModal === 'add-mock-modal' && mocks.length > 0 ? mocks[0].id : null,
    },
    screenData: {
      title: screenTitle,
      visibleSummary,
      activeQuestion: liveDom.activeQuestion || null,
      visibleItems,
    },
    userState: {
      targetExam,
      totalMocksAttempted: mocks.length,
      weakSubjects: Array.from(weakSubjectsSet),
      strongSubjects: Array.from(strongSubjectsSet),
    },
  };

  // Expose the parsed payload globally on the window object in development/runtime for live debugging in browser DevTools
  if (typeof window !== 'undefined') {
    (window as any).__JARVIS_CONTEXT__ = {
      timestamp: new Date().toISOString(),
      activeTab,
      domItemCount: domItems.length,
      extractedItems: domItems,
      extractedSections: domSections,
      finalPayload: visionContext
    };
  }

  return visionContext;
}

/**
 * Utility function to gather real-time application context snapshot from state stores and optional React context values.
 */
export function getCurrentPageContext(extraProfile?: any, extraSystemData?: any, domContext?: any): JarvisPageContext {
  const uiState = useUIStore.getState();
  const versionState = useVersionStore.getState();
  const speedMathState = useSpeedMathStore.getState();
  const vocabState = useVocabularyStore.getState();

  // Determine active modal
  let activeModal: string | null = null;
  if (versionState.isUpdateModalOpen) {
    activeModal = 'changelog';
  } else if (uiState.isAddModalOpen) {
    activeModal = 'add-mock-modal';
  } else if (uiState.isProfileModalOpen) {
    activeModal = 'profile-modal';
  } else if (uiState.isAdminModalOpen) {
    activeModal = 'admin-modal';
  } else if (uiState.showTasksModal) {
    activeModal = 'tasks-modal';
  }

  // Location details
  const activeTab = uiState.activeTab || 'home';
  const learningSubTab = activeTab === 'learning' ? uiState.learningTab : undefined;
  
  const location: ScreenLocation = {
    activeTab,
    learningSubTab,
    activeModal,
    activeSection: activeTab === 'dashboard' ? '#recent-mocks' : undefined,
  };

  // User details
  const userName = extraProfile?.name || extraProfile?.displayName || 'User';
  const targetExam = extraProfile?.targetExam || extraProfile?.targetExamName || 'Competitive Exam';
  const examCategory = extraProfile?.categoryName || extraProfile?.categoryId || 'General';

  // Tasks summary
  const tasks = extraProfile?.tasks || [];
  const pendingTasks = tasks.filter((t: any) => !t.completed);
  const completedTasks = tasks.filter((t: any) => t.completed);
  const pendingTasksCount = pendingTasks.length;
  const completedTasksCount = completedTasks.length;
  const totalTasksCount = tasks.length;
  const topPendingTaskTitle = pendingTasks[0]?.title || pendingTasks[0]?.text;

  // Live mocks / system data
  const liveMocks = extraSystemData?.liveMocks || [];
  const countdowns = extraSystemData?.countdowns || [];

  // Mock scores / history
  const mocks = extraProfile?.mocks || [];
  const totalMockScores = mocks.reduce((acc: number, m: any) => acc + (Number(m.score) || 0), 0);
  const recentMockAverageScore = mocks.length > 0 ? Math.round(totalMockScores / mocks.length) : undefined;

  // Speed Math
  const speedMathHistory = speedMathState.history || [];
  const speedMathLevel = speedMathHistory.length > 0 ? speedMathHistory.length : 1;

  // Vocab
  const firstCanvas = vocabState.canvases?.[0];
  const currentVocabWord = firstCanvas?.vocabularies?.[0]?.word;

  const data: ScreenDataSnapshot = {
    targetExam,
    examCategory,
    userName,

    dashboardData: {
      liveMocksCount: liveMocks.length,
      upcomingCountdownsCount: countdowns.length,
      recentMockAverageScore,
      historyLogCount: mocks.length,
      availableSections: ['#countdowns', '#live-mocks', '#performance-trend', '#history-log'],
    },

    learningData: {
      currentSubTab: uiState.learningTab,
      currentVocabWord,
      speedMathLevel,
      activePracticeSubject: learningSubTab,
    },

    tasksData: {
      totalTasksCount,
      pendingTasksCount,
      completedTasksCount,
      topPendingTaskTitle,
    },

    addMockData: {
      isOpen: uiState.isAddModalOpen || activeTab === 'add-mock',
      activeExamCategory: examCategory,
    },

    communityData: {
      userRank: extraProfile?.rank || 1,
      userXp: extraProfile?.xp || 0,
      activeSubTab: activeTab === 'community' ? 'Leaderboard' : undefined,
    },

    profileData: {
      userName,
      targetExam,
      studyStreak: extraProfile?.streak || 0,
      theme: uiState.theme,
    },

    changeLogData: {
      isOpen: versionState.isUpdateModalOpen,
      currentVersion: versionState.currentLocalVersion,
    },

    themeData: {
      activeTheme: uiState.theme,
      isDarkMode: uiState.darkMode,
    },
  };

  const visionContext = getVisionContext(activeTab, activeModal, extraProfile, extraSystemData, domContext);

  return {
    location,
    data,
    visionContext,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Constructs the formatted <CURRENT_USER_SCREEN_CONTEXT> block for Gemini system prompt.
 */
export function buildJarvisScreenContextBlock(context: JarvisPageContext): string {
  const { location, data, visionContext } = context;
  const nav = visionContext?.navigation || { currentTab: location.activeTab, activeSubject: null, activeMockId: null };
  const screen = visionContext?.screenData || { title: location.activeTab, visibleSummary: {}, activeQuestion: null, visibleItems: [] };
  const user = visionContext?.userState || { targetExam: data.targetExam || 'Competitive Exam', totalMocksAttempted: 0, weakSubjects: [], strongSubjects: [] };

  // Formulate Active Page / Route
  let activeRouteStr = location.activeTab.charAt(0).toUpperCase() + location.activeTab.slice(1);
  if (nav.activeMockId) {
    activeRouteStr += ` -> ${nav.activeMockId}`;
  } else if (nav.activeSubject) {
    activeRouteStr += ` -> ${nav.activeSubject}`;
  } else if (location.learningSubTab) {
    activeRouteStr += ` -> ${location.learningSubTab.charAt(0).toUpperCase() + location.learningSubTab.slice(1)}`;
  }

  // Auto-Navigation flags
  const navigatedFrom = location.navigatedFrom;

  // Formulate Visible Metrics on Screen
  const metricsEntries = Object.entries(screen.visibleSummary || {}).filter(([_, v]) => v !== undefined && v !== null);
  const metricsStr = metricsEntries.length > 0
    ? metricsEntries.map(([k, v]) => `  • ${k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1')}: ${v}`).join('\n')
    : '  • General Screen View (No specific test score metric active)';

  // Formulate Currently Focused Question
  let focusedQuestionStr = 'None';
  if (screen.activeQuestion) {
    const q = screen.activeQuestion;
    focusedQuestionStr = `${q.id || 'Question'} (${q.topic || q.subject || 'General'}${q.status ? ` - ${q.status}` : ''})`;
  }

  // Formulate User Profile
  const weakStr = user.weakSubjects && user.weakSubjects.length > 0 ? user.weakSubjects.join(', ') : 'None identified yet';
  const profileStr = `Target ${user.targetExam || data.targetExam || 'Competitive Exam'}${weakStr !== 'None identified yet' ? ` | Weak Area: ${weakStr}` : ''}`;

  return `<CURRENT_USER_SCREEN_CONTEXT>
- Active Page / Route: ${activeRouteStr}
${navigatedFrom ? `- Auto-Navigated: Yes\n- Navigated From: ${navigatedFrom}` : ''}
- Screen Header: "${screen.title}"
- Visible Metrics on Screen:
${metricsStr}
- Currently Focused Question: ${focusedQuestionStr}
- User Profile: ${profileStr}
${screen.visibleItems && screen.visibleItems.length > 0 ? `- Visible Items Snapshot:\n${screen.visibleItems.map((item: string) => `  • ${item}`).join('\n')}` : ''}
</CURRENT_USER_SCREEN_CONTEXT>`;
}

/**
 * Builds the complete Phase 3 Gemini System Prompt with injected context block and instructions.
 */
export function buildJarvisFullSystemPrompt(context?: JarvisPageContext): string {
  const activeContext = context || getCurrentPageContext();
  const screenContextBlock = buildJarvisScreenContextBlock(activeContext);

  return `SYSTEM INSTRUCTION:
You are Jarvis, an intelligent AI study partner for competitive exam preparation.
You have real-time visibility into the user's screen and study progress.

${screenContextBlock}

CRITICAL CONSTRAINTS FOR PAGE SUMMARIES:
- You must base your page summary STRICTLY AND ONLY on what is listed inside <CURRENT_USER_SCREEN_CONTEXT>.
- If auto-navigation has taken place (indicated by "Auto-Navigated: Yes" and "Navigated From" in <CURRENT_USER_SCREEN_CONTEXT>), acknowledge the page navigation naturally at the beginning of your response (e.g., "I've navigated you to the Live Mocks section...").
- NEVER mention or hallucinate mock test scores, percentiles, accuracy percentages, study streak days, or mock test performance history logs when the user is on 'home', 'community', 'profile', 'learning', or 'tasks' pages, unless those exact metrics appear explicitly in 'Visible Metrics on Screen' or 'Visible Items Snapshot' for this prompt.
- On the HOME page (route: home): summarize ONLY the Welcome Greeting, Daily Motivation Quote, and Activity Heatmap Map. Do NOT mention mock test performance, percentile, accuracy, or study streak.
- On the PROFILE page (route: profile): summarize ONLY profile settings (Display Name, Target Exam, Sector, Bio). Do NOT mention mock test performance, percentile, accuracy, study streak, or mock history log.
- Do NOT output placeholder or hallucinated performance metrics. Describe ONLY what is strictly visible in <CURRENT_USER_SCREEN_CONTEXT>.

INSTRUCTIONS & RESPONSE TRACES:
1. Use the screen context above to answer user questions directly without asking them what they are looking at.
2. If the user asks a question about a section or page that required auto-navigation, acknowledge switching to that view and answer based on the newly updated screen context.
3. If the user asks "How did I do on my last mock?", strictly analyze ONLY the data present in the screen context.
   - For full mocks: Report overall score, percentile, and subject breakdowns for sections with scores.
   - For sectional mocks (e.g. Reasoning Sectional Test): Report ONLY on the single active subject score present. NEVER hallucinate scores or topics for N/A or '-' sections (such as Quant, English, or GA) when they are not part of the test.
4. If the user asks "Can you summarize what I am looking at right now?" or "What am I looking at?", summarize the active screen components directly from the screen context items and metrics.
5. Keep responses strictly truthful to the visible screen context, helpful, concise, friendly, and structured.
6. If requested, perform app actions using the appAction tool.`;
}

/**
 * Formats JarvisPageContext into a compact, human-readable summary string and JSON Vision Schema for Gemini prompt inclusion.
 */
export function formatContextForPrompt(context: JarvisPageContext): string {
  const { location, data, visionContext } = context;

  // Pretty location title
  let locationStr = location.activeTab.charAt(0).toUpperCase() + location.activeTab.slice(1);
  if (location.activeTab === 'learning' && location.learningSubTab) {
    const sub = location.learningSubTab === 'ai' ? 'AI Tutor' :
                location.learningSubTab === 'vocab' ? 'Vocabulary' :
                location.learningSubTab === 'math' ? 'Speed Math' :
                location.learningSubTab === 'practice' ? 'Practice Library' : location.learningSubTab;
    locationStr += ` -> ${sub} (/learning/${location.learningSubTab})`;
  } else {
    locationStr += ` (/${location.activeTab})`;
  }

  if (location.activeModal) {
    locationStr += ` [Modal Open: ${location.activeModal}]`;
  }

  const screenBlock = buildJarvisScreenContextBlock(context);

  const jsonPayloadString = JSON.stringify(visionContext || {
    navigation: { currentTab: location.activeTab, activeSubject: null, activeMockId: null },
    screenData: { title: locationStr, visibleSummary: {}, activeQuestion: null, visibleItems: [] },
    userState: { targetExam: data.targetExam || 'Competitive Exam', totalMocksAttempted: 0, weakSubjects: [], strongSubjects: [] }
  }, null, 2);

  const lines: string[] = [
    screenBlock,
    ``,
    `[ADDITIONAL PAGE & MODULE SNAPSHOTS]`,
    `Location: ${locationStr}`,
    `Active Category: ${data.examCategory} (${data.targetExam})`,
    `User: ${data.userName}`,
    `Theme: ${data.themeData?.activeTheme} (${data.themeData?.isDarkMode ? 'Dark Mode' : 'Light Mode'})`,
    `Active Module Snapshots:`,
    `1. Dashboard: ${data.dashboardData?.liveMocksCount ?? 0} Live Mocks, ${data.dashboardData?.upcomingCountdownsCount ?? 0} Countdowns, ${data.dashboardData?.historyLogCount ?? 0} Saved Mock Logs`,
    `2. Learning Hub: Sub-tab = ${data.learningData?.currentSubTab || 'AI Tutor'}${data.learningData?.currentVocabWord ? `, Vocab Focus = "${data.learningData.currentVocabWord}"` : ''}`,
    `3. Tasks & Planning: ${data.tasksData?.pendingTasksCount ?? 0} Pending / ${data.tasksData?.totalTasksCount ?? 0} Total Tasks${data.tasksData?.topPendingTaskTitle ? ` (Next: "${data.tasksData.topPendingTaskTitle}")` : ''}`,
    `4. Add Mock: Status = ${data.addMockData?.isOpen ? 'Modal Open' : 'Closed'}`,
    `5. Community Hub: Rank = #${data.communityData?.userRank ?? 1}, XP = ${data.communityData?.userXp ?? 0}`,
    `6. Profile: Streak = ${data.profileData?.studyStreak ?? 0} days`,
    `7. Change Log: Status = ${data.changeLogData?.isOpen ? 'Visible' : 'Hidden'} (Version: ${data.changeLogData?.currentVersion || 'v5.0'})`,
    `8. App Theme: ${data.themeData?.activeTheme} (${data.themeData?.isDarkMode ? 'Dark' : 'Light'})`,
    ``,
    `[DYNAMIC VISION CONTEXT SCHEMA (JSON)]`,
    jsonPayloadString
  ];

  return lines.join('\n');
}

