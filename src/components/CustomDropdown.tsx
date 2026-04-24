import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export function CustomDropdown({ value, options, onChange, placeholder, allowCustom, required }: { value: string, options: string[], onChange: (val: string) => void, placeholder: string, allowCustom?: boolean, required?: boolean }) {
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm font-medium ${!value ? 'text-slate-400' : 'text-slate-700'} flex justify-between items-center`}
      >
        <span>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-2 overflow-y-auto animate-in fade-in slide-in-from-top-2 flex flex-col max-h-64">
          <div className="space-y-1">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all ${value === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'}`}
              >
                {opt}
              </button>
            ))}
            {allowCustom && (
              <>
                <div className="h-px bg-slate-100 my-2 mx-2" />
                <button
                  type="button"
                  onClick={() => { onChange("Other"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all text-slate-500 font-medium hover:bg-slate-50"
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
