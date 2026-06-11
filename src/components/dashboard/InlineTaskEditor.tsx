import React, { useState } from 'react';

export function InlineTaskEditor({ initialText, onSave, onCancel }: { initialText: string, onSave: (text: string) => void, onCancel: () => void }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="flex flex-col gap-3 w-full" onClick={(e) => e.stopPropagation()}>
      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" autoFocus type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSave(text); else if (e.key === 'Escape') onCancel(); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      <div className="flex gap-2">
         <button onClick={(e) => { e.stopPropagation(); onSave(text); }} className="text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Save</button>
         <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="text-xs font-medium px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

