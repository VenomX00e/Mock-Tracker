import { useMemo } from 'react';
import { useUIStore } from '../../../store/uiStore';
import { useVersionStore } from '../../../store/versionStore';
import { useSpeedMathStore } from '../../../store/speedMathStore';
import { useVocabularyStore } from '../../../store/vocabularyStore';
import { getCurrentPageContext, formatContextForPrompt } from '../services/jarvisContextService';
import { JarvisPageContext } from '../types/contextTypes';

export function useJarvisPageContext(extraProfile?: any, extraSystemData?: any): {
  pageContext: JarvisPageContext;
  formattedContextPrompt: string;
} {
  // Subscribe to Zustand reactive stores
  const activeTab = useUIStore((s) => s.activeTab);
  const learningTab = useUIStore((s) => s.learningTab);
  const theme = useUIStore((s) => s.theme);
  const darkMode = useUIStore((s) => s.darkMode);
  const isAddModalOpen = useUIStore((s) => s.isAddModalOpen);
  const isProfileModalOpen = useUIStore((s) => s.isProfileModalOpen);
  const isAdminModalOpen = useUIStore((s) => s.isAdminModalOpen);
  const showTasksModal = useUIStore((s) => s.showTasksModal);
  
  const isUpdateModalOpen = useVersionStore((s) => s.isUpdateModalOpen);
  const mathHistoryLength = useSpeedMathStore((s) => s.history.length);
  const canvasesLength = useVocabularyStore((s) => s.canvases.length);

  const pageContext = useMemo(() => {
    return getCurrentPageContext(extraProfile, extraSystemData);
  }, [
    activeTab,
    learningTab,
    theme,
    darkMode,
    isAddModalOpen,
    isProfileModalOpen,
    isAdminModalOpen,
    showTasksModal,
    isUpdateModalOpen,
    mathHistoryLength,
    canvasesLength,
    extraProfile,
    extraSystemData,
  ]);

  const formattedContextPrompt = useMemo(() => {
    return formatContextForPrompt(pageContext);
  }, [pageContext]);

  return {
    pageContext,
    formattedContextPrompt,
  };
}
