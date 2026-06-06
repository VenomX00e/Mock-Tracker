import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  dropdownClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  dropdownClassName = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-transparent dark:bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown
          className={`w-4 h-4 ml-2 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-[100] mt-1 w-full bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-slate-700/50 rounded-lg shadow-2xl py-1 transform overflow-hidden animate-in fade-in zoom-in-95 ${dropdownClassName}`}
        >
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  value === opt.value
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
