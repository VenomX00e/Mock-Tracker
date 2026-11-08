import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, BookOpen, Brain, PenTool, Lightbulb } from 'lucide-react';

interface QuizLoadingOverlayProps {
  format?: string;
  theme?: string;
}

export const QuizLoadingOverlay: React.FC<QuizLoadingOverlayProps> = ({
  format = 'cloze',
  theme = '',
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  const loadingSteps = [
    {
      text: 'Analyzing your vocabulary list...',
      icon: BookOpen,
      subtext: 'Scanning meanings, nuances, and exam-yield frequencies',
      progress: 25,
    },
    {
      text: theme
        ? `Drafting a thematic passage around "${theme}"...`
        : format === 'cloze'
        ? 'Drafting a cohesive contextual passage...'
        : format === 'spot_error'
        ? 'Constructing challenging grammatical segments...'
        : 'Synthesizing editorial questions...',
      icon: PenTool,
      subtext: 'Weaving target words into rich exam scenarios',
      progress: 55,
    },
    {
      text: 'Preparing competitive options & distractors...',
      icon: Brain,
      subtext: 'Balancing answer plausibility and difficulty',
      progress: 80,
    },
    {
      text: 'Finalizing explanations & interactive quiz...',
      icon: Lightbulb,
      subtext: 'Verifying answers and contextual feedback',
      progress: 94,
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 2200);
    return () => clearInterval(timer);
  }, [loadingSteps.length]);

  const currentStep = loadingSteps[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="space-y-6 text-center">
      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
        <div className="absolute inset-0 rounded-3xl bg-indigo-500/20 dark:bg-indigo-500/30 animate-ping opacity-75" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <StepIcon className="w-8 h-8 transition-all duration-300" />
          <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-amber-300 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2 min-h-[70px]">
        <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-300 text-xs font-semibold tabular-nums">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>
            Step {stepIndex + 1} of {loadingSteps.length}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 transition-all duration-300">
          {currentStep.text}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {currentStep.subtext}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
          style={{ width: `${currentStep.progress}%` }}
        />
      </div>
    </div>
  );
};
