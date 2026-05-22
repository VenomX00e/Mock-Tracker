import React, { useState } from 'react';
import { Target, Plus, X, ArrowRight } from 'lucide-react';
import { useSystemDataCtx, useAppStateCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useMocks } from '../../hooks/useMocks';

export function LiveMocksSection() {
  const { liveMocks, selectedCategory } = useSystemDataCtx();
  const { mocks } = useMocks();
  const { activeTab, setIsAddLiveMockOpen, setIsAddModalOpen } = useUIStore();
  const { setMockToEdit } = useAppStateCtx();

  const [dismissedLiveMocks, setDismissedLiveMocks] = useState<string[]>(
    JSON.parse(localStorage.getItem('dismissedLiveMocks') || '[]')
  );

  const dismissLiveMock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedLiveMocks, id];
    setDismissedLiveMocks(updated);
    localStorage.setItem('dismissedLiveMocks', JSON.stringify(updated));
  };

  const restoreLiveMocks = () => {
    setDismissedLiveMocks([]);
    localStorage.removeItem('dismissedLiveMocks');
  };

  if (activeTab !== 'dashboard') {
    return null;
  }

  const visibleLiveMocks = liveMocks.filter(lm => 
    (lm.categoryId === selectedCategory || (!lm.categoryId && selectedCategory === 'banking')) && 
    !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && 
    !dismissedLiveMocks.includes(lm.id)
  );

  if (visibleLiveMocks.length > 0) {
    return (
      <div className="mb-5 mt-0 pt-[12px] pb-[0px] pl-[0px] pr-[12px]" style={{ paddingBottom: '0px', paddingLeft: '0px' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Live Mocks</h3>
            <button onClick={() => setIsAddLiveMockOpen(true)} className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors" title="Host Live Mock">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {dismissedLiveMocks.length > 0 && (
            <button onClick={restoreLiveMocks} className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Show hidden Live Mocks</button>
          )}
        </div>
        <div className="mb-8 flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
          {visibleLiveMocks.map(liveMock => (
            <div key={liveMock.id} className="min-w-[220px] md:min-w-[260px] flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/30 shadow-sm relative overflow-hidden snap-start">
              
              <button onClick={(e) => dismissLiveMock(liveMock.id, e)} className="absolute top-2 right-2 p-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-full text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors z-20" title="Hide Live Mock">
                <X className="w-3 h-3" />
              </button>

              <div className="absolute top-0 right-0 p-3 opacity-5 dark:opacity-10">
                <Target className="w-16 h-16 text-indigo-900 dark:text-indigo-400" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-600 dark:bg-indigo-500 text-white animate-pulse">Live</span>
                  <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">{liveMock.examType} {liveMock.examRole && liveMock.examRole}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{liveMock.mockName}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs mb-4">{liveMock.platform || 'Any Platform'} • {liveMock.examPhase} • {liveMock.examScope}</p>
              </div>
              <button
                onClick={() => {
                  setMockToEdit({
                    id: '', mockName: liveMock.mockName, date: liveMock.date || new Date().toISOString(), platform: liveMock.platform,
                    score: '', percentile: '', percentage: '', accuracy: '',
                    examType: liveMock.examType || '', examRole: liveMock.examRole || '', examPhase: liveMock.examPhase || '', examScope: liveMock.examScope || '',
                    quant: {score:'', percentile:'', accuracy:''}, reasoning:{score:'', percentile:'', accuracy:''}, english:{score:'', percentile:'', accuracy:''}, ga:{score:'', percentile:'', accuracy:''}
                  } as any);
                  useUIStore.getState().setActiveTab('add-mock');
                  window.scrollTo(0, 0);
                }}
                className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700 hover:shadow-md mt-2"
              >
                Share My Score
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-5 mt-0 pt-[12px] pb-[0px] pl-[0px] pr-[12px]" style={{ paddingBottom: '0px', paddingLeft: '0px' }}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Live Mocks</h3>
          <button onClick={() => setIsAddLiveMockOpen(true)} className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors" title="Host Live Mock">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {dismissedLiveMocks.length > 0 && (
          <button onClick={restoreLiveMocks} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Show hidden Live Mocks</button>
        )}
      </div>
    </div>
  );
}
