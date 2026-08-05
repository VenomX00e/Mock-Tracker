import { useMemo } from 'react';
import { useUIStore } from '../../../store/uiStore';
import { getCurrentPageContext } from '../services/jarvisContextService';
import { domUtils } from '../domUtils';
import { VisionContextPayload } from '../types/contextTypes';

export interface ScrapedVisionContext {
  contextPayload: VisionContextPayload;
  domData: ReturnType<typeof domUtils.scrapeJarvisDomData>;
  refreshContext: () => VisionContextPayload;
}

/**
  * Custom React hook to aggregate screen context, Zustand stores, and client-side DOM inspection.
  */
export function useJarvisContext(extraProfile?: any): ScrapedVisionContext {
  const activeTab = useUIStore((s) => s.activeTab);
  const learningTab = useUIStore((s) => s.learningTab);

  const rawContext = getCurrentPageContext(extraProfile);

  // Scrape DOM elements with data-jarvis-* tags
  const domData = domUtils.scrapeJarvisDomData();

  // Enhance visionContext with scraped DOM data if present
  const contextPayload: VisionContextPayload = useMemo(() => {
    const basePayload = rawContext.visionContext;
    const mergedStats = {
      ...(basePayload.screenData.visibleSummary || {}),
      ...(domData.stats || {}),
    };

    const mergedItems = Array.from(new Set([
      ...basePayload.screenData.visibleItems,
      ...domData.items,
    ]));

    return {
      navigation: {
        currentTab: activeTab,
        activeSubject: learningTab || basePayload.navigation.activeSubject,
        activeMockId: basePayload.navigation.activeMockId,
      },
      screenData: {
        title: basePayload.screenData.title,
        visibleSummary: mergedStats,
        activeQuestion: domData.activeQuestion || basePayload.screenData.activeQuestion,
        visibleItems: mergedItems,
      },
      userState: basePayload.userState,
    };
  }, [activeTab, learningTab, extraProfile, domData.sections.length, Object.keys(domData.stats).length]);

  return {
    contextPayload,
    domData,
    refreshContext: () => getCurrentPageContext(extraProfile).visionContext,
  };
}
