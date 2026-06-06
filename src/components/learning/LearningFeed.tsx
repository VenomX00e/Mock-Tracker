import React from 'react';
import { useLearningData } from './useLearningData';

export function LearningFeed() {
  const { subjects, loading } = useLearningData();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center p-12 bg-[#2A2B32]/30 rounded-xl border border-white/5">
        <p className="text-gray-400">No learning modules available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {subjects.map((subject) => (
        <div 
          key={subject.id} 
          className="p-5 rounded-xl bg-[#2A2B32]/50 border border-white/5 hover:bg-[#2A2B32] transition-colors cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-medium text-white group-hover:text-indigo-400 transition-colors">
              {subject.title}
            </h3>
            {subject.progress > 0 && subject.progress < 100 && (
              <span className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded-md">
                In Progress
              </span>
            )}
            {subject.progress === 100 && (
              <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-md">
                Completed
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-400 mb-5 line-clamp-2">{subject.description}</p>
          
          <div className="space-y-3">
            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${subject.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${subject.progress}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {subject.modulesCount} modules
              </span>
              <span>{subject.progress}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
