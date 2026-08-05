import { useState, useCallback } from 'react';
import { useJarvisStore } from '../store/jarvisStore';
import { jarvisApi } from '../services/jarvisApi';
import { determineIntent } from '../services/jarvisIntentService';
import { getCurrentPageContext } from '../services/jarvisContextService';
import { jarvisEventBus } from '../utils/eventBus';
import { domUtils } from '../domUtils';
import { detectTargetRoute } from '../services/routeClassifier';
import { useUIStore } from '../../../store/uiStore';
import { useCacheStore } from '../../../store/analyticsStore';

export function useJarvis() {
  const store = useJarvisStore();
  const { activeTab: currentActiveTab, setActiveTab } = useUIStore();
  const [streamedResponse, setStreamedResponse] = useState('');

  const sendMessage = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || store.isThinking) return;
    
    // =========================================================================
    // STAGE 1: Immediate Navigation & User Feedback Notice Execution
    // =========================================================================
    const detectedRoute = detectTargetRoute(userMsg);
    let autoNavigatedFrom: string | undefined = undefined;

    if (detectedRoute) {
      const targetTab = (detectedRoute === 'tests' ? 'dashboard' : detectedRoute) as any;
      const currentTab = useUIStore.getState().activeTab;

      if (targetTab !== currentTab) {
        autoNavigatedFrom = currentTab;

        const sectionNames: Record<string, string> = {
          dashboard: 'Live Mocks & Test Series',
          tests: 'Live Mocks & Test Series',
          community: 'Community & Leaderboard',
          learning: 'Learning & Practice',
          tasks: 'Tasks & Action Items',
          profile: 'Profile & Settings',
        };
        const targetName = sectionNames[targetTab] || targetTab;

        // 1a. Set user feedback notice banner in Jarvis UI
        store.setNavigationNotice(`Navigating to ${targetName}...`);

        // 1b. Immediately fire the route transition via setActiveTab(targetTab)
        setActiveTab(targetTab);

        // =========================================================================
        // STAGE 2: Wait for target view & data stores to mount & hydrate
        // =========================================================================
        // Wait 80ms for old tab DOM elements to unmount
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Poll for new tab view settlement and store hydration
        const startTime = Date.now();
        const maxWaitMs = 2000;

        while (Date.now() - startTime < maxWaitMs) {
          const activeTabNow = useUIStore.getState().activeTab;
          const cache = useCacheStore.getState();

          if (activeTabNow === 'community') {
            const hasCommunityData = (cache.sortedLeaderboard && cache.sortedLeaderboard.length > 0) ||
                                     (cache.allUsers && cache.allUsers.length > 0);
            const domItems = document.querySelectorAll('tr[data-jarvis-item], [data-jarvis-item]');
            if (hasCommunityData || domItems.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              break;
            }
          } else {
            const domItems = document.querySelectorAll('[data-jarvis-item]');
            if (domItems.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }

    // Ensure direct fallback data hydration for Community tab if cache is still unpopulated
    const currentActiveTab = useUIStore.getState().activeTab;
    if (currentActiveTab === 'community') {
      const cache = useCacheStore.getState();
      if ((!cache.sortedLeaderboard || cache.sortedLeaderboard.length === 0) &&
          (!cache.allUsers || cache.allUsers.length === 0)) {
        try {
          const { db } = await import('../../../services/firebase');
          const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
          const snap = await getDocs(query(collection(db, 'users'), orderBy('avgPercentile', 'desc'), limit(50)));
          const users = snap.docs.map((d: any) => d.data());
          if (users.length > 0) {
            const sorted = [...users].sort((a: any, b: any) => (b.avgPercentile || 0) - (a.avgPercentile || 0));
            cache.updateCommunityCache({
              allUsers: users,
              activeAllUsers: users,
              sortedLeaderboard: sorted
            });
          }
        } catch (e) {
          console.warn('[Jarvis] Fallback community fetch error:', e);
        }
      }
    }

    store.addMessage({ role: 'user', content: userMsg });
    store.setThinking(true);
    setStreamedResponse('');
    
    try {
      // Get current page context snapshot (stores + vision schema)
      const pageContext = getCurrentPageContext();
      if (autoNavigatedFrom) {
        pageContext.location.navigatedFrom = autoNavigatedFrom;
      }

      // Dynamically scrape live DOM attributes for maximum vision context precision
      const liveDomData = domUtils.scrapeJarvisDomData();
      if (liveDomData.activeQuestion) {
        pageContext.visionContext.screenData.activeQuestion = liveDomData.activeQuestion;
      }
      const nonAnalyticTabs = ['home', 'community', 'profile', 'learning', 'tasks'];
      const activeTab = pageContext.location.activeTab;

      if (!nonAnalyticTabs.includes(activeTab) && Object.keys(liveDomData.stats).length > 0) {
        pageContext.visionContext.screenData.visibleSummary = {
          ...pageContext.visionContext.screenData.visibleSummary,
          ...liveDomData.stats,
        };
      } else if (nonAnalyticTabs.includes(activeTab)) {
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
        } = pageContext.visionContext.screenData.visibleSummary as any;
        pageContext.visionContext.screenData.visibleSummary = cleanSummary;
      }
      
      // DOM-First Context Precedence: If 3 or more data-jarvis-item elements found, discard fallback store summaries
      if (liveDomData.items.length >= 3) {
        pageContext.visionContext.screenData.visibleItems = liveDomData.items;
      } else if (liveDomData.items.length > 0) {
        pageContext.visionContext.screenData.visibleItems = Array.from(
          new Set([...liveDomData.items, ...pageContext.visionContext.screenData.visibleItems])
        );
      }

      // Context Inspection Tool / Debug Mode: Attach to window.__JARVIS_CONTEXT__ for inspection
      if (typeof window !== 'undefined') {
        (window as any).__JARVIS_CONTEXT__ = {
          timestamp: new Date().toISOString(),
          activeTab: pageContext.location.activeTab,
          domItemCount: liveDomData.items.length,
          extractedItems: liveDomData.items,
          extractedSections: liveDomData.sections,
          finalPayload: pageContext.visionContext
        };
        console.log('[Jarvis Context Inspector] Payload set to window.__JARVIS_CONTEXT__:', (window as any).__JARVIS_CONTEXT__);
      }
      
      // 1. Check if query is informational, data question, or screen-summary analysis (Regex Intent Bypass)
      const isInformationalOrSummary = /who|what|which|how|where|why|who's|top|rank|first|highest|leading|best|summary|summarize|explain|overview|describe|tell me|my score|my rank|last mock|latest mock|performance|progress|stats|detail|compare|who is|available|pending|completed/i.test(userMsg);

      // 2. Try to parse an intent with page context awareness only if not an informational query
      const intent = isInformationalOrSummary ? null : await determineIntent(userMsg, pageContext);
      
      if (intent) {
        // Dispatch execution to the event bus
        jarvisEventBus.dispatch({ 
          type: 'DISPATCH_INTENT', 
          intent: intent.action, 
          payload: intent.parameters 
        });
      } else {
        // 3. Fallback to conversational API
        const conversationContext = [...store.messages, { role: 'user', content: userMsg } as const];
        
        const fullResponse = await jarvisApi.sendMessageStream(conversationContext, (text) => {
          setStreamedResponse(text);
        }, pageContext);
        
        store.addMessage({ role: 'assistant', content: fullResponse });
      }
    } catch (error: any) {
      store.addMessage({ role: 'assistant', content: `Error: ${error.message}` });
    } finally {
      setStreamedResponse('');
      store.setThinking(false);
      store.setNavigationNotice(null);
    }
  }, [store]);

  return {
    ...store,
    streamedResponse,
    sendMessage,
  };
}
