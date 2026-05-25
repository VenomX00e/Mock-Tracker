import React from 'react';
import { motion } from 'motion/react';

interface DashboardFiltersProps {
  examTypes: string[];
  selectedExam: string;
  setSelectedExam: (val: string) => void;
  availableRoles: string[];
  selectedRole: string;
  setSelectedRole: (val: string) => void;
  availablePhases: string[];
  selectedPhase: string;
  setSelectedPhase: (val: string) => void;
  availableScopes: string[];
  selectedScope: string;
  setSelectedScope: (val: string) => void;
  hasMocks: boolean;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  examTypes,
  selectedExam,
  setSelectedExam,
  availableRoles,
  selectedRole,
  setSelectedRole,
  availablePhases,
  selectedPhase,
  setSelectedPhase,
  availableScopes,
  selectedScope,
  setSelectedScope,
  hasMocks
}) => {
  if (!hasMocks) return null;

  return (
    <>
      <div className="flex overflow-x-auto mb-[6px] pb-[12px] gap-2 custom-scrollbar">
        <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl items-center flex-nowrap w-max border border-slate-200/50 dark:border-slate-700/50 shadow-sm relative">
          {examTypes.map(type => (
             <button
              key={type}
              onClick={() => setSelectedExam(type)}
              className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 z-10 bg-transparent border-none outline-none ${
                selectedExam === type 
                  ? 'text-slate-800 dark:text-slate-100' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {selectedExam === type && (
                <motion.div
                  layoutId="activeExamTab"
                  initial={false}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600/50 -z-10"
                />
              )}
              {selectedExam !== type && (
                <motion.div
                  initial={false}
                  whileHover={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className="absolute inset-0 rounded-xl border border-current -z-10"
                />
              )}
              <span className="relative z-10">{type}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedExam !== 'All' && (availableRoles.length > 1 || availablePhases.length > 1 || availableScopes.length > 1) && (
        <div className="flex flex-col gap-4 mb-6 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 ">
          {availableRoles.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest sm:w-16">Role:</span>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedRole === role 
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availablePhases.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest sm:w-16">Phase:</span>
              <div className="flex flex-wrap gap-2">
                {availablePhases.map(phase => (
                  <button
                    key={phase}
                    onClick={() => setSelectedPhase(phase)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedPhase === phase 
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {phase}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableScopes.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest sm:w-16">Scope:</span>
              <div className="flex flex-wrap gap-2">
                {availableScopes.map(scope => (
                  <button
                    key={scope}
                    onClick={() => setSelectedScope(scope)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedScope === scope 
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
