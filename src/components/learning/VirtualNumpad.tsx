import React from 'react';

interface VirtualNumpadProps {
  handleNumpadPress: (key: string) => void;
  deleteLastDigit: () => void;
}

export function VirtualNumpad({ handleNumpadPress, deleteLastDigit }: VirtualNumpadProps) {
  const handlePress = (e: React.PointerEvent<HTMLButtonElement>, key: string) => {
    // Prevent the browser from also firing a delayed 'onClick' mouse event (Ghost Click)
    e.preventDefault(); 
    if (navigator.vibrate) navigator.vibrate(10);
    handleNumpadPress(key);
  };

  const handleDelete = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(10);
    deleteLastDigit();
  };

  return (
    <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-[280px]">
      {['1','2','3','4','5','6','7','8','9','.','0'].map(key => (
        <button
          key={key}
          onPointerDown={(e) => handlePress(e, key)}
          className="h-14 font-mono text-2xl font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl transition-colors select-none touch-none"
        >
          {key}
        </button>
      ))}
      <button
        onPointerDown={handleDelete}
        className="h-14 font-medium text-lg bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 active:bg-red-300 dark:active:bg-red-500/30 text-red-600 dark:text-red-400 rounded-xl transition-colors select-none touch-none"
      >
        Del
      </button>
    </div>
  );
}
