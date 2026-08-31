import React, { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  openValues: string[];
  toggleItem: (value: string) => void;
  type?: 'single' | 'multiple';
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: any) => void;
  children: React.ReactNode;
  className?: string;
}

export function Accordion({
  type = 'single',
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
}: AccordionProps) {
  const [uncontrolledValues, setUncontrolledValues] = useState<string[]>(() => {
    if (Array.isArray(defaultValue)) return defaultValue;
    if (typeof defaultValue === 'string') return [defaultValue];
    return [];
  });

  const isControlled = controlledValue !== undefined;
  const currentValues = isControlled
    ? Array.isArray(controlledValue)
      ? controlledValue
      : controlledValue
      ? [controlledValue]
      : []
    : uncontrolledValues;

  const toggleItem = (val: string) => {
    let next: string[];
    if (type === 'single') {
      next = currentValues.includes(val) ? [] : [val];
    } else {
      next = currentValues.includes(val)
        ? currentValues.filter((v) => v !== val)
        : [...currentValues, val];
    }

    if (!isControlled) {
      setUncontrolledValues(next);
    }
    onValueChange?.(type === 'single' ? next[0] || '' : next);
  };

  return (
    <AccordionContext.Provider value={{ openValues: currentValues, toggleItem, type }}>
      <div className={`space-y-2.5 ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
}

const AccordionItemContext = createContext<{ value: string } | undefined>(undefined);

export function AccordionItem({
  value,
  children,
  className = '',
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 rounded-xl overflow-hidden shadow-xs transition-all ${className}`}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({
  children,
  actions,
  className = '',
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const accContext = useContext(AccordionContext);
  const itemContext = useContext(AccordionItemContext);

  if (!accContext || !itemContext) {
    throw new Error('AccordionTrigger must be used inside Accordion and AccordionItem');
  }

  const isOpen = accContext.openValues.includes(itemContext.value);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => accContext.toggleItem(itemContext.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          accContext.toggleItem(itemContext.value);
        }
      }}
      aria-expanded={isOpen}
      className={`w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer select-none gap-3 focus-visible:outline-none ${className}`}
    >
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {actions}
        <div
          onClick={(e) => {
            e.stopPropagation();
            accContext.toggleItem(itemContext.value);
          }}
          className={`p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 transition-transform duration-200 shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer ${
            isOpen ? 'rotate-180' : ''
          }`}
          title={isOpen ? 'Collapse rule' : 'Expand rule'}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export function AccordionContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const accContext = useContext(AccordionContext);
  const itemContext = useContext(AccordionItemContext);

  if (!accContext || !itemContext) {
    throw new Error('AccordionContent must be used inside Accordion and AccordionItem');
  }

  const isOpen = accContext.openValues.includes(itemContext.value);

  if (!isOpen) return null;

  return (
    <div
      className={`p-3.5 sm:p-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 animate-in fade-in slide-in-from-top-1 duration-150 ${className}`}
    >
      {children}
    </div>
  );
}
