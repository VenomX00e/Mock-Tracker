import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import type { VocabularyItem } from '../../../types';
import { useQuizStore } from '../../../store/useQuizStore';
import { QuizEntryPoint } from './QuizEntryPoint';
import { QuizConfigModal } from './QuizConfigModal';
import { QuizPlayArena } from './QuizPlayArena';
import { QuizLoadingOverlay } from './QuizLoadingOverlay';

interface VocabQuizContainerProps {
  words: VocabularyItem[];
  title?: string;
}

export const VocabQuizContainer: React.FC<VocabQuizContainerProps> = ({
  words,
  title = 'AI Vocab Quiz',
}) => {
  const {
    activeQuiz,
    isGenerating,
    isModalOpen,
    generationError,
    activeConfig,
    openQuizConfig,
    closeQuiz,
    startGeneratingQuiz,
  } = useQuizStore();

  const handleOpenConfig = (selectedWords: VocabularyItem[]) => {
    openQuizConfig(selectedWords);
  };

  const isPlaying = Boolean(activeQuiz);

  return (
    <>
      {/* 1. Entry Point Button */}
      <QuizEntryPoint
        words={words}
        onOpenQuizModal={handleOpenConfig}
        title={title}
      />

      {/* 2. Configuration Modal */}
      <QuizConfigModal
        isOpen={isModalOpen}
        onClose={closeQuiz}
        sourceWords={words}
        onStartGeneration={startGeneratingQuiz}
        isGenerating={isGenerating}
      />

      {/* 3. Generating State / Loading Overlay with Dynamic Cycling Text */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={closeQuiz}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            <QuizLoadingOverlay
              format={activeConfig?.format}
              theme={activeConfig?.theme}
            />

            {generationError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 text-left space-y-2.5 animate-slideUp">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>The AI got confused, let's try again!</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {generationError}
                </p>
                <button
                  type="button"
                  onClick={() => activeConfig && startGeneratingQuiz(activeConfig)}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Play Arena & Results Summary (managed via useQuizStore) */}
      {isPlaying && <QuizPlayArena />}
    </>
  );
};
