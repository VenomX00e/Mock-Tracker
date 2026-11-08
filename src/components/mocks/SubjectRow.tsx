import React, { memo } from 'react';

export const AVAILABLE_MOCK_MODELS = [
  { value: 'gemini-3.5-flash-lite', label: '3.5 Flash Lite' },
  { value: 'gemini-3.1-flash-lite', label: '3.1 Flash Lite' },
  { value: 'gemini-3.8-flash', label: '3.8 Flash' },
  { value: 'gemini-3.6-flash', label: '3.6 Flash' },
  { value: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
  { value: 'gemini-3-flash-preview', label: '3.0 Flash' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: '2.5 Flash Lite' },
];

export const formatModelName = (modelId?: string): string => {
  if (!modelId) return '';
  const known: Record<string, string> = {
    'gemini-3.5-flash-lite': '3.5 Flash Lite',
    'gemini-3.1-flash-lite': '3.1 Flash Lite',
    'gemini-3.8-flash': '3.8 Flash',
    'gemini-3.7-flash': '3.7 Flash',
    'gemini-3.6-flash': '3.6 Flash',
    'gemini-3.5-flash': '3.5 Flash',
    'gemini-3.1-pro-preview': '3.1 Pro',
    'gemini-3-flash-preview': '3.0 Flash',
    'gemini-2.5-flash': '2.5 Flash',
    'gemini-2.5-flash-lite': '2.5 Flash Lite',
    'gemma-4-26b-a4b-it': '4 26B A4B IT',
    'gemma-4-31b-it': '4 31B IT'
  };
  return (known[modelId] || modelId).replace(/^gemini[\s-]*/i, '');
};

export const SubjectRow = memo(({ sub, data, onChange }: { sub: any, data: any, onChange: (id: string, field: string, val: string) => void }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-500/50">
      <div className="w-full sm:w-[140px] shrink-0 font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <div className="w-2 h-2 shrink-0 rounded-full bg-indigo-500"></div>
        <span className="truncate">{sub.name} {sub.short ? <span className="text-slate-400 font-normal ml-1">({sub.short})</span> : ''}</span>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-3">
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Score"
            value={data?.score ?? ''}
            onChange={(e) => onChange(sub.id, 'score', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Percentile"
            value={data?.percentile ?? ''}
            onChange={(e) => onChange(sub.id, 'percentile', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Accuracy %"
            value={data?.accuracy ?? ''}
            onChange={(e) => onChange(sub.id, 'accuracy', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.sub.id === next.sub.id &&
         prev.data?.score === next.data?.score &&
         prev.data?.percentile === next.data?.percentile &&
         prev.data?.accuracy === next.data?.accuracy;
});
