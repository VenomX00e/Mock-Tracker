import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ defaultValue = '', value: controlledValue, onValueChange, children, className = '' }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newVal: string) => {
    if (!isControlled) {
      setUncontrolledValue(newVal);
    }
    onValueChange?.(newVal);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={`w-full flex flex-col ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center justify-start rounded-xl bg-slate-100 dark:bg-slate-800/70 p-1 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = '',
  disabled = false,
  icon,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => context.onValueChange(value)}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
        isActive
          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
          : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40 text-slate-600 dark:text-slate-400'
      } ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = '',
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-4 focus-visible:outline-none animate-in fade-in-50 duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
