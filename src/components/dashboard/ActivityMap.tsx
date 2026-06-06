import React, { useMemo, useState, useEffect } from 'react';
import { useMocks } from '../../hooks/useMocks';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ActivityMap() {
  const { mocks } = useMocks();
  const [viewMode, setViewMode] = useState<'yearly' | 'monthly' | 'weekly'>('monthly');
  const [periodOffset, setPeriodOffset] = useState(0);

    const [activeIdx, setActiveIdx] = useState<number | null>(null);

    // Generate map data based on mocks
    const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Defer the heavy map rendering so the route transition doesn't stutter.
    const timer = setTimeout(() => setIsReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const { days, totalMocks, periodLabel } = useMemo(() => {
    if (!isReady) return { days: [], totalMocks: 0, periodLabel: '' };

    // Group mocks by date
    const mocksByDate: Record<string, number> = {};
    mocks.forEach(mock => {
      const dateOnly = mock.date.split('T')[0]; // "YYYY-MM-DD"
      if (!mocksByDate[dateOnly]) {
        mocksByDate[dateOnly] = 0;
      }
      mocksByDate[dateOnly]++;
    });

    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    
    let totalMocksInPeriod = 0;
    let startDate: Date;
    let daysToRender: number;
    let label = '';

    if (viewMode === 'yearly') {
      const targetYear = currentYear + periodOffset;
      startDate = new Date(targetYear, 0, 1);
      const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      daysToRender = isLeapYear ? 366 : 365;
      label = targetYear.toString();
    } else if (viewMode === 'monthly') {
      const targetDate = new Date(currentYear, today.getMonth() + periodOffset, 1);
      startDate = new Date(targetDate);
      daysToRender = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      label = targetDate.toLocaleString('default', { month: 'long' });
      if (targetDate.getFullYear() !== currentYear) {
        label += ` ${targetDate.getFullYear()}`;
      }
    } else {
      // weekly
      const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - currentDayOfWeek + (periodOffset * 7));
      startDate = new Date(targetDate);
      daysToRender = 7;
      
      const date = targetDate.getDate();
      const weekOfMonth = Math.ceil(date / 7) || 1;
      const suffix = ["th", "st", "nd", "rd"];
      const ordinal = (weekOfMonth > 0 && weekOfMonth < 4) ? weekOfMonth + suffix[weekOfMonth] : weekOfMonth + "th";
      label = `${ordinal} week`;
    }

    let currentDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < daysToRender) {
      // format date as YYYY-MM-DD local
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const count = mocksByDate[dateStr] || 0;
      totalMocksInPeriod += count;
      
      // Define intensity logically based on count
      let intensity = 0;
      if (count > 0) {
        if (count === 1) intensity = 1;
        else intensity = 2;
      }

      data.push({ idx: daysAdded, intensity, date: dateStr, count, isFuture: currentDate > today });
      currentDate.setDate(currentDate.getDate() + 1);
      daysAdded++;
    }
    return { days: data, totalMocks: totalMocksInPeriod, periodLabel: label };
  }, [mocks, viewMode, periodOffset, isReady]);

  const getIntensityClass = (level: number, isFuture: boolean) => {
    if (isFuture) return 'bg-slate-50 dark:bg-slate-800/20'; // completely dim for future
    switch (level) {
      case 0: return 'bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/80';
      case 1: return 'bg-emerald-300 dark:bg-emerald-700/60 hover:bg-emerald-400 dark:hover:bg-emerald-600/70 border border-emerald-400 dark:border-emerald-500/50';
      case 2: return 'bg-emerald-500 dark:bg-[#4ade80] hover:bg-emerald-600 dark:hover:bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)] dark:shadow-[0_0_12px_rgba(74,222,128,0.6)] z-10 ring-1 ring-emerald-300 dark:ring-emerald-200/50 relative';
      default: return 'bg-slate-100 dark:bg-slate-800';
    }
  };

  const handleModeChange = (mode: 'yearly' | 'monthly' | 'weekly') => {
    setViewMode(mode);
    setPeriodOffset(0);
  };

  return (
    <div className="w-full">
      {/* Legend and Headers handled by parent container */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 relative z-10 -mt-16 pt-16">
         <div>
           <div className="flex items-center gap-2 mb-2">
             <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
             <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Activity Map</h3>
           </div>
           <div className="flex items-center flex-wrap gap-2">
              <span className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white inline-block min-w-[1.5em] text-left tabular-nums">{totalMocks}</span>
              <span className="text-xl sm:text-3xl font-bold tracking-tight text-slate-500 dark:text-slate-400">mocks</span>
              
              <div className="flex items-center gap-1.5 ml-2 mt-1 sm:mt-0">
                <button onClick={() => setPeriodOffset(p => p - 1)} className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-md">
                  <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
                <span className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-mono font-medium min-w-[80px] text-center">{periodLabel}</span>
                <button onClick={() => setPeriodOffset(p => p + 1)} disabled={periodOffset >= 0} className={`p-1 transition-colors rounded-md ${periodOffset >= 0 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
           </div>
         </div>
         
         <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
           <button onClick={() => handleModeChange('weekly')} className={`px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-colors uppercase tracking-wider ${viewMode === 'weekly' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Weekly</button>
           <button onClick={() => handleModeChange('monthly')} className={`px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-colors uppercase tracking-wider ${viewMode === 'monthly' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Monthly</button>
           <button onClick={() => handleModeChange('yearly')} className={`px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-colors uppercase tracking-wider ${viewMode === 'yearly' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Yearly</button>
         </div>
       </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-wider">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-slate-100 dark:bg-slate-800/50"></div> 0 Mocks</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-emerald-300 dark:bg-emerald-700/60 border border-emerald-400 dark:border-emerald-500/50"></div> 1 Mock</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-emerald-500 dark:bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div> 2+ Mocks</div>
      </div>

      <div className="flex flex-wrap gap-[5px] sm:gap-1.5 w-full pb-2 relative">
        {days.map((cell) => (
          <div key={`cell-${cell.idx}`} className="relative flex items-center justify-center">
            <button
              onClick={() => setActiveIdx(activeIdx === cell.idx ? null : cell.idx)}
              onBlur={() => setTimeout(() => { setActiveIdx((current) => current === cell.idx ? null : current); }, 150)}
              className={`w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] rounded-[3px] sm:rounded-sm transition-all duration-300 block ${getIntensityClass(cell.intensity, cell.isFuture)}`}
              title={`${new Date(cell.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${cell.count} mocks`}
            />
            {activeIdx === cell.idx && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-max bg-slate-900 dark:bg-slate-800 text-white p-2.5 rounded-lg text-xs shadow-xl border border-slate-700 pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200 theme-tooltip">
                <div className="font-semibold text-white theme-tooltip-text">{new Date(cell.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-slate-300 mt-0.5 theme-tooltip-text-muted">{cell.count} {cell.count === 1 ? 'mock' : 'mocks'} taken</div>
                {/* triangle pointer */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900 dark:border-t-slate-800 theme-tooltip-pointer"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
