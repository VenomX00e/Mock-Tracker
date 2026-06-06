import React from 'react';

interface LearningModuleProps {
  title: string;
  content: string;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export function LearningModule({ title, content, onComplete, isCompleted }: LearningModuleProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 rounded-2xl bg-[#1E1F25] border border-white/5 shadow-xl">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">{title}</h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full"></div>
      </div>
      
      <div className="prose prose-invert prose-indigo max-w-none mb-10">
        <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-6 border-t border-white/10">
        <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
          ← Back to Course
        </button>
        
        <button 
          onClick={onComplete}
          disabled={isCompleted}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isCompleted 
              ? 'bg-green-500/20 text-green-400 cursor-default' 
              : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {isCompleted ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Completed
            </>
          ) : (
            'Mark as Complete'
          )}
        </button>
      </div>
    </div>
  );
}
