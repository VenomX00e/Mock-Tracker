import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export function CustomDropdown({ value, options, onChange, placeholder, allowCustom, required, allowClear, className = '', buttonClassName = 'w-full text-left px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl', optionClassName = 'px-3 py-2.5 text-sm', hideArrow, editable }: { value: string, options: string[], onChange: (val: string) => void, placeholder: string, allowCustom?: boolean, required?: boolean, allowClear?: boolean, className?: string, buttonClassName?: string, optionClassName?: string, hideArrow?: boolean, editable?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div
        onClick={() => !editable && setIsOpen(!isOpen)}
        className={cn(`focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all font-medium flex justify-between items-center cursor-pointer`, !value ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200', buttonClassName)}
      >
        {editable ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            size={Math.max((value || '').toString().length, 1)}
            className={`bg-transparent border-none p-0 m-0 focus:ring-0 min-w-0 placeholder-slate-400 text-inherit ${buttonClassName?.includes('text-center') ? 'text-center' : ''}`}
          />
        ) : (
          <span>{value || placeholder}</span>
        )}
        <div className="flex flex-row items-center gap-1 shrink-0" onClick={() => editable && setIsOpen(!isOpen)}>
          {allowClear && value && (
             <span 
               onClick={(e) => { e.stopPropagation(); onChange(''); }}
               className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
               title="Clear selection"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </span>
          )}
          {!hideArrow && (
            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 min-w-full w-max max-w-[200px] mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-none p-1.5 overflow-y-auto animate-in fade-in slide-in-from-top-2 flex flex-col max-h-64">
          <div className="space-y-0.5">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setIsOpen(false); }}
                className={`w-full text-left ${optionClassName} rounded-xl transition-all ${value === opt ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {opt}
              </button>
            ))}
            {allowCustom && (
              <>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-2 mx-2" />
                <button
                  type="button"
                  onClick={() => { onChange("Other"); setIsOpen(false); }}
                  className={`w-full text-left ${optionClassName} rounded-xl transition-all text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50`}
                >
                  Other...
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Hidden input to handle required natively if needed */}
      {required && !value && <input type="text" className="absolute opacity-0 w-0 h-0 pointer-events-none" required value={value} onChange={() => {}} />}
    </div>
  );
}
