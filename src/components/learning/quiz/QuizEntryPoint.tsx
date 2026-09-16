import React, { useState } from 'react';
import { Sparkles, Bot, Layers } from 'lucide-react';
import { VocabularyItem } from '../../../types';

interface QuizEntryPointProps {
  words: VocabularyItem[];
  onOpenQuizModal: (words: VocabularyItem[]) => void;
  title?: string;
}

export const QuizEntryPoint: React.FC<QuizEntryPointProps> = ({
  words,
  onOpenQuizModal,
  title = 'AI Vocab Quiz',
}) => {
  const eligibleCount = words.length;
  const isEligible = eligibleCount >= 5;

  return (
    <div
      id="quiz-entry-point-container"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none print:hidden"
    >
      <button
        id="quiz-entry-point-btn"
        onClick={() => {
          if (isEligible) {
            onOpenQuizModal(words);
          }
        }}
        disabled={!isEligible}
        title={
          isEligible
            ? `Generate an AI Quiz from these ${eligibleCount} words`
            : `Add at least 5 words to generate an AI Quiz (currently ${eligibleCount}/5)`
        }
        className={`group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300 font-medium text-sm ${
          isEligible
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white cursor-pointer active:scale-95 hover:shadow-indigo-500/25'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80 border border-slate-300/50 dark:border-slate-700/50'
        }`}
      >
        <span className="relative flex items-center justify-center">
          <Bot className={`w-5 h-5 transition-transform ${isEligible ? 'group-hover:scale-110' : ''}`} />
          {isEligible && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
            </span>
          )}
        </span>

        <span className="font-semibold tracking-wide">
          {title}
        </span>

        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            isEligible
              ? 'bg-white/20 text-white backdrop-blur-sm'
              : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          {eligibleCount} {eligibleCount === 1 ? 'word' : 'words'}
        </span>
      </button>
    </div>
  );
};
