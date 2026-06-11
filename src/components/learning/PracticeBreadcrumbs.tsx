import React from 'react';
import { ChevronRight } from 'lucide-react';
import { PracticeFolder } from '../../types';

interface PracticeBreadcrumbsProps {
  folderPath: PracticeFolder[];
  onTraverseUp: (index: number) => void;
  rootName?: string;
  className?: string;
}

export function PracticeBreadcrumbs({
  folderPath,
  onTraverseUp,
  rootName = "Root",
  className = "bg-slate-50 dark:bg-slate-800/50"
}: PracticeBreadcrumbsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <button 
        onClick={() => onTraverseUp(-1)} 
        className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
      >
        {rootName}
      </button>
      {folderPath.map((f, i) => (
        <React.Fragment key={f.id}>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          <button 
            onClick={() => onTraverseUp(i)} 
            className={`hover:text-indigo-600 dark:hover:text-indigo-400 font-medium truncate max-w-[200px] ${i === folderPath.length - 1 ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
            title={f.name}
          >
            {f.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
