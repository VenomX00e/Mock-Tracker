import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'amber' | 'emerald';
  className?: string;
  onClick?: () => void;
}

export function Badge({
  children,
  variant = 'default',
  className = '',
  onClick,
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60',
    outline: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
        variantStyles[variant]
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </span>
  );
}
