import React from 'react';

interface VirtualNumpadProps {
  handleNumpadPress: (key: string) => void;
  deleteLastDigit: () => void;
}

export function VirtualNumpad({ handleNumpadPress, deleteLastDigit }: VirtualNumpadProps) {
  return (
    <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-[280px]">
      {['1','2','3','4','5','6','7','8','9','.','0'].map(key => (
        <button
          key={key}
          onClick={() => handleNumpadPress(key)}
          className="h-14 font-mono text-2xl font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-colors select-none"
        >
          {key}
        </button>
      ))}
      <button
        onClick={deleteLastDigit}
        className="h-14 font-medium text-lg bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors select-none"
      >
        Del
      </button>
    </div>
  );
}
