import React from 'react';
import { BarChart3, Calculator, Activity, Trophy } from 'lucide-react';
import { SubjectRow } from './SubjectRow';

interface MockPerformanceSectionProps {
  formData: any;
  subjects: any[];
  selectedSection: string;
  setSelectedSection: (id: string) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSectionChange: (section: string, field: string, value: string) => void;
}

export function MockPerformanceSection({
  formData,
  subjects,
  selectedSection,
  setSelectedSection,
  handleChange,
  handleSectionChange,
}: MockPerformanceSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Metrics & Performance</h3>
      </div>
      
      {formData.examScope === 'Sectional' ? (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-7 shadow-sm">
           <div className="mb-6 flex flex-wrap gap-2">
             {subjects.map((s) => {
               const isSelected = selectedSection === s.id;
               return (
                 <button 
                   key={s.id} 
                   type="button" 
                   onClick={() => setSelectedSection(s.id)} 
                   className={`px-5 py-2 rounded-xl font-medium text-sm transition-all shadow-sm
                   ${isSelected ? 'bg-indigo-500 text-white shadow-indigo-200 dark:shadow-none translate-y-[-2px]' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700'}`}
                 >
                   {s.name}
                 </button>
               );
             })}
           </div>
           
           <div className="bg-slate-50 dark:bg-slate-900/50 p-5 sm:p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700 inset-shadow-sm">
             <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800/50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                {subjects.find(s => s.id === selectedSection)?.name} Summary
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Score</label>
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                    type="search" inputMode="decimal" step="0.01"
                    value={formData[selectedSection]?.score ?? ''}
                    onChange={e => handleSectionChange(selectedSection, 'score', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                  />
                </div>
                <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Percentile</label>
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                    type="search" inputMode="decimal" step="0.01"
                    value={formData[selectedSection]?.percentile ?? ''}
                    onChange={e => handleSectionChange(selectedSection, 'percentile', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                  />
                </div>
                <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Accuracy %</label>
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                    type="search" inputMode="decimal" step="0.01"
                    value={(formData as any)[selectedSection]?.accuracy ?? ''}
                    onChange={e => handleSectionChange(selectedSection, 'accuracy', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                  />
                </div>
             </div>
           </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Overall Performance */}
          <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-500">
              <Activity className="w-32 h-32" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 inline-flex items-center gap-2 relative z-10">
              <BarChart3 className="w-4 h-4 text-slate-500" /> Overall Performance
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 relative z-10">
              <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Score</label>
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                  type="search" inputMode="decimal" step="0.01"
                  name="score"
                  value={formData.score ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  required
                  autoCorrect="off" spellCheck={false}     />
              </div>
              <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Percentile</label>
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                  type="search" inputMode="decimal" step="0.01"
                  name="percentile"
                  value={formData.percentile ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  autoCorrect="off" spellCheck={false}     />
              </div>
              <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Accuracy %</label>
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                  type="search" inputMode="decimal" step="0.01"
                  name="accuracy"
                  value={formData.accuracy ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  autoCorrect="off" spellCheck={false}     />
              </div>
            </div>
          </div>

          {/* Sectional Breakdown */}
          {subjects.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50 inline-flex items-center gap-2">
                 <Calculator className="w-4 h-4 text-slate-400" /> Sectional Breakdown 
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {subjects.map(sub => (
                  <SubjectRow 
                    key={sub.id} 
                    sub={sub} 
                    data={formData[sub.id]} 
                    onChange={handleSectionChange} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
