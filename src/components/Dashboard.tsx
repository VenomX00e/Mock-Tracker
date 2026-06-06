import React, { useMemo, useState, useEffect } from 'react';
import { UserProfile, ExamCategory } from '../types';
import { useUserProfileCtx, useSystemDataCtx, useAppStateCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';
import { useMocks } from '../hooks/useMocks';
import { useLeaderboardRank } from '../hooks/useLeaderboardRank';
import { Target, Trash2 } from 'lucide-react';
import { parseLocalDate } from '../lib/utils';
import { getSub, getSubjectColor } from '../lib/subjectUtils';
import { useCacheStore } from '../store/analyticsStore';

import { DashboardCharts } from './dashboard/DashboardCharts';
import { DashboardFilters } from './dashboard/DashboardFilters';
import { DashboardStatCards } from './dashboard/DashboardStatCards';
import { DashboardInsights } from './dashboard/DashboardInsights';
import { RecentMocksTable } from './dashboard/RecentMocksTable';

export default function Dashboard() {
  const { profile } = useUserProfileCtx();
  const { mocks: rawMocks, deletedMocks: rawDeletedMocks = [], deleteMock, restoreDeletedMock, permanentlyDeleteMock, updateMock } = useMocks();
  const { categories } = useSystemDataCtx();
  const { setActiveTab, setIsAddModalOpen, showTasksModal: controlledShowTasksModal, setShowTasksModal: controlledSetShowTasksModal, darkMode, setMockToEdit } = useUIStore();

  const activeCategory = (categories || []).find((c: any) => c.id === profile?.categoryId) || categories?.[0];
  
  const mocks = React.useMemo(() => {
    return rawMocks.filter(m => (m.categoryId || 'banking') === activeCategory?.id);
  }, [rawMocks, activeCategory]);

  const deletedMocks = React.useMemo(() => {
    return rawDeletedMocks.filter(m => (m.categoryId || 'banking') === activeCategory?.id);
  }, [rawDeletedMocks, activeCategory]);

  const subjects = activeCategory?.subjects && activeCategory.subjects.length > 0 ? activeCategory.subjects : [
    { id: 'quant', name: 'Quant', short: 'Q' },
    { id: 'reasoning', name: 'Reasoning', short: 'R' },
    { id: 'english', name: 'English', short: 'E' },
    { id: 'ga', name: 'GA', short: 'GA' }
  ];

  const cache = useCacheStore();

  const selectedExam = cache.selectedExam;
  const setSelectedExam = (v: string) => cache.updateDashboardCache({ selectedExam: v });
  
  const selectedRole = cache.selectedRole;
  const setSelectedRole = (v: string) => cache.updateDashboardCache({ selectedRole: v });
  
  const selectedPhase = cache.selectedPhase;
  const setSelectedPhase = (v: string) => cache.updateDashboardCache({ selectedPhase: v });
  
  const selectedScope = cache.selectedScope;
  const setSelectedScope = (v: string) => cache.updateDashboardCache({ selectedScope: v });
  
  const selectedTrendPeriod = cache.selectedTrendPeriod;
  const setSelectedTrendPeriod = (v: string) => cache.updateDashboardCache({ selectedTrendPeriod: v });
  
  const activeTrendId = cache.activeTrendId;
  const setActiveTrendId = (v: string) => cache.updateDashboardCache({ activeTrendId: v });

  const [chartView, setChartView] = useState<'bar' | 'radar'>('bar');
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  
  // get unique exam types
  const examTypes = useMemo(() => {
    const types = new Set<string>(mocks.map(m => m.examType).filter((t): t is string => !!t));
    return ['All', ...Array.from<string>(types).sort()];
  }, [mocks]);

  const leaderboardRank = useLeaderboardRank(profile, activeCategory?.id);

  // reset subfilters when main exam changes
  React.useEffect(() => {
    setSelectedRole('All');
    setSelectedPhase('All');
    setSelectedScope('All');
  }, [selectedExam]);

  const allGlobalPhases = useMemo(() => {
    const phases = Array.from<string>(new Set<string>(mocks.map(m => m.examPhase).filter((t): t is string => !!t)));
    const catPhases = activeCategory?.phases || [];
    phases.sort((a, b) => {
      const idxA = catPhases.indexOf(a);
      const idxB = catPhases.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return mocks.findIndex(m => m.examPhase === a) - mocks.findIndex(m => m.examPhase === b);
    });
    return ['All', ...phases];
  }, [mocks, activeCategory]);

  const [goalPercentileStr, setGoalPercentileStr] = useState<string>(() => localStorage.getItem('goalPercentile') || '95');
  const statsCountRange = cache.statsCountRange;
  const setStatsCountRange = cache.setStatsCountRange;

  useEffect(() => {
    localStorage.setItem('goalPercentile', goalPercentileStr);
  }, [goalPercentileStr]);
  
  useEffect(() => {
    if (selectedTrendPeriod !== 'All' && selectedTrendPeriod !== 'All Time') {
       setStatsCountRange('all');
    }
  }, [selectedTrendPeriod]);

  const goalPercentile = Number(goalPercentileStr) || 0;

  // filter
  const currentHash = useMemo(() => {
    return `${mocks.length}_${mocks.reduce((acc, m) => acc + (m.score || 0), 0)}_${selectedExam}_${selectedRole}_${selectedPhase}_${selectedScope}_${selectedTrendPeriod}_${activeTrendId}_${statsCountRange}`;
  }, [mocks, selectedExam, selectedRole, selectedPhase, selectedScope, selectedTrendPeriod, activeTrendId, statsCountRange]);

  const displayedMocks = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.displayedMocks?.length > 0) return cache.displayedMocks;
    let filtered = mocks;
    if (selectedExam !== 'All') {
      filtered = mocks.filter(m => m.examType === selectedExam);
    }
    if (selectedRole !== 'All') {
      filtered = filtered.filter(m => m.examRole === selectedRole);
    }
    if (selectedPhase !== 'All') {
      filtered = filtered.filter(m => m.examPhase === selectedPhase);
    }
    if (selectedScope !== 'All') {
      filtered = filtered.filter(m => m.examScope === selectedScope);
    }
    
    if (selectedTrendPeriod !== 'All' && selectedTrendPeriod !== 'All Time') {
       let cutoffTime = 0;
       const is30D = selectedTrendPeriod === '30 Days' || selectedTrendPeriod === 'Last 30 Days';
       const is7D = selectedTrendPeriod === '7 Days' || selectedTrendPeriod === 'Last 7 Days';
       if (is30D) {
          const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 30); cutoffTime = d.getTime();
       } else if (is7D) {
          const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 7); cutoffTime = d.getTime();
       } else {
          const parsed = parseInt(selectedTrendPeriod);
          if (!isNaN(parsed) && parsed > 0) {
            const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - parsed); cutoffTime = d.getTime();
          }
       }
       if (cutoffTime > 0) {
         filtered = filtered.filter(m => parseLocalDate(m.date).getTime() >= cutoffTime);
       }
    }
    
    // sort by date asc for charts
    return [...filtered].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [mocks, selectedExam, selectedRole, selectedPhase, selectedScope, selectedTrendPeriod]);

  const activeTrendFilteredMocks = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.activeTrendFilteredMocks?.length > 0) return cache.activeTrendFilteredMocks;
    return displayedMocks.filter(m => {
      if (activeTrendId === 'overall') return true;
      if (activeTrendId === 'full') return (!m.examScope || m.examScope === 'Full');
      
      const val = getSub(m, activeTrendId, subjects);
      return val != null && ((val.percentile != null && val.percentile !== '') || (val.score != null && val.score !== ''));
    });
  }, [displayedMocks, activeTrendId]);

  const activeTrendFilteredChronologicalMocks = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.activeTrendFilteredChronologicalMocks?.length > 0) return cache.activeTrendFilteredChronologicalMocks;
    return [...activeTrendFilteredMocks].sort((a,b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [activeTrendFilteredMocks, currentHash, cache]);

  const averageTrendLineValue = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.averageTrendLineValue) return cache.averageTrendLineValue;
    let sum = 0;
    let count = 0;
    activeTrendFilteredChronologicalMocks.forEach(m => {
      let val = null;
      if (activeTrendId === 'overall' || activeTrendId === 'full') {
         val = m.percentile || m.score;
      } else {
         const v = getSub(m, activeTrendId, subjects);
         if (v) val = v.percentile || v.score;
      }
      if (val != null && val !== '') {
        sum += typeof val === 'string' ? parseFloat(val) : val;
        count++;
      }
    });
    return count > 0 ? Number((sum / count).toFixed(1)) : undefined;
  }, [activeTrendFilteredChronologicalMocks, activeTrendId, currentHash, cache]);

  const overallTrendAveragesData = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.overallTrendAveragesData) return cache.overallTrendAveragesData;
    if (activeTrendId !== 'overall') return { original: [], displayMap: {} };
    
    const avgs = [{ id: 'full', name: 'Full' }, ...subjects].map(s => {
      let sum = 0;
      let count = 0;
      activeTrendFilteredChronologicalMocks.forEach(m => {
        let val: any = null;
        if (s.id === 'full') {
          if (!m.examScope || m.examScope === 'Full') val = m.percentile || m.score;
        } else {
          const v = getSub(m, s.id, subjects);
          if (v) val = v.percentile || v.score;
        }
        const numVal = Number(val);
        if (val != null && val !== '' && !isNaN(numVal)) {
          sum += numVal;
          count++;
        }
      });
      const avg = count > 0 ? Number((sum / count).toFixed(1)) : undefined;
      return { id: s.id, avg };
    }).filter((x): x is { id: string, avg: number } => x.avg !== undefined) as { id: string, avg: number }[];

    const original = avgs.map(a => a.avg);

    const sorted = [...avgs].sort((a, b) => b.avg - a.avg).map(x => ({ ...x, displayAvg: x.avg }));
    const minGap = 5;
    for (let iter = 0; iter < 10; iter++) {
        for (let i = 1; i < sorted.length; i++) {
            const diff = sorted[i-1].displayAvg - sorted[i].displayAvg;
            if (diff < minGap) {
                const push = (minGap - diff) / 2;
                sorted[i-1].displayAvg += push;
                sorted[i].displayAvg -= push;
            }
        }
    }
    
    const displayMap: Record<string, { original: number, display: number }> = {};
    sorted.forEach(s => {
       displayMap[s.id] = { original: s.avg, display: s.displayAvg };
    });

    return { original, displayMap };
  }, [activeTrendId, activeTrendFilteredChronologicalMocks, subjects, currentHash, cache]);

  // Derive unique roles and scopes for the current selection
  const availableRoles = useMemo(() => {
    if (selectedExam === 'All') return [];
    const baseSelected = mocks.filter(m => m.examType === selectedExam);
    const roles = new Set<string>(baseSelected.map(m => m.examRole).filter((t): t is string => !!t));
    return roles.size > 0 ? ['All', ...Array.from<string>(roles).sort()] : [];
  }, [mocks, selectedExam]);

  const availablePhases = useMemo(() => {
    if (selectedExam === 'All') return [];
    let baseSelected = mocks.filter(m => m.examType === selectedExam);
    if (selectedRole !== 'All') {
      baseSelected = baseSelected.filter(m => m.examRole === selectedRole);
    }
    const phases = new Set<string>(baseSelected.map(m => m.examPhase).filter((t): t is string => !!t));
    return phases.size > 0 ? ['All', ...Array.from<string>(phases).sort()] : [];
  }, [mocks, selectedExam, selectedRole]);

  const availableScopes = useMemo(() => {
    if (selectedExam === 'All') return [];
    let baseSelected = mocks.filter(m => m.examType === selectedExam);
    if (selectedRole !== 'All') {
      baseSelected = baseSelected.filter(m => m.examRole === selectedRole);
    }
    if (selectedPhase !== 'All') {
      baseSelected = baseSelected.filter(m => m.examPhase === selectedPhase);
    }
    const scopes = new Set<string>(baseSelected.map(m => m.examScope).filter((t): t is string => !!t));
    return scopes.size > 0 ? ['All', ...Array.from<string>(scopes).sort()] : [];
  }, [mocks, selectedExam, selectedRole, selectedPhase]);

  // Overview stats calculation
  const chronologicalMocks = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.chronologicalMocks?.length > 0) return cache.chronologicalMocks;
    return [...displayedMocks].sort((a,b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [displayedMocks, currentHash, cache]);

  const stats = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.dashboardStats) return cache.dashboardStats;
    // Total tests shown in the view
    const totalTests = activeTrendFilteredMocks.length;

    // Filter properties based on active trend (Overall, Full, Quant, etc.)
    const getField = (m: any, fieldName: 'score' | 'percentile' | 'accuracy') => {
      if (activeTrendId === 'overall' || activeTrendId === 'full') {
        return m[fieldName];
      } else {
        return getSub(m, activeTrendId, subjects)?.[fieldName];
      }
    };

    // Depending on activeTrendId, pick the relevant mocks range (we need newest first)
    // activeTrendFilteredMocks is already filtered and is oldest-first
    const targetMocksLength = (statsCountRange === 'all' || (selectedTrendPeriod !== 'All' && selectedTrendPeriod !== 'All Time')) ? activeTrendFilteredMocks.length : statsCountRange;
    const lastN = activeTrendFilteredMocks.slice(-targetMocksLength);
    
    const scores = lastN.map(m => getField(m, 'score')).filter(v => v != null && !isNaN(parseFloat(v as string))) as number[];
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(1) : '-';

    const percentiles = lastN.map(m => getField(m, 'percentile')).filter(v => v != null && !isNaN(parseFloat(v as string)) && v > 0) as number[];
    const avgPercentile = percentiles.length > 0 ? (percentiles.reduce((a, b) => a + Number(b), 0) / percentiles.length).toFixed(1) : '-';

    const accuracies = lastN.map(m => getField(m, 'accuracy')).filter(v => v != null && !isNaN(parseFloat(v as string)) && v > 0) as number[];
    const avgAccuracy = accuracies.length > 0 ? (accuracies.reduce((a, b) => a + Number(b), 0) / accuracies.length).toFixed(1) : '-';

    // For Radar chart - calculate average sectional percentiles off the last N generic mocks
    const targetDescLength = (statsCountRange === 'all' || (selectedTrendPeriod !== 'All' && selectedTrendPeriod !== 'All Time')) ? displayedMocks.length : Math.max(statsCountRange as number, 5); 
    const recentDescending = displayedMocks.slice(-targetDescLength);

    const subjectAverages: Record<string, number> = {};
    subjects.forEach(s => {
      const sMocks = recentDescending.filter(m => {
        const perc = getSub(m, s.id, subjects)?.percentile;
        return perc != null && perc > 0;
      });
      subjectAverages[s.id] = sMocks.length ? sMocks.reduce((acc, m) => acc + getSub(m, s.id, subjects)!.percentile!, 0) / sMocks.length : 0;
    });

    // Recent trend
    const recentValue = activeTrendFilteredMocks.length > 0 ? getField(activeTrendFilteredMocks[0], 'score') : null;
    const recent = { score: recentValue != null ? recentValue : '-' };
    const prevValue = activeTrendFilteredMocks.length > 1 ? getField(activeTrendFilteredMocks[1], 'score') : null;
    let scoreDiff = '-';
    let isScoreUp = true;
    if (recentValue != null && prevValue != null) {
      const diff = (Number(recentValue) - Number(prevValue));
      scoreDiff = diff.toFixed(1);
      isScoreUp = diff >= 0;
    }

    return { 
      avgScore, avgPercentile, avgAccuracy, totalTests, scoreDiff, isScoreUp, recent,
      subjectAverages
    };
  }, [displayedMocks, statsCountRange, activeTrendFilteredMocks, activeTrendId, subjects, selectedTrendPeriod, currentHash, cache]);

  const chartDataReversed = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.chartDataReversed?.length > 0) return cache.chartDataReversed;
    return [...activeTrendFilteredChronologicalMocks].reverse().map(m => {
      const scores = subjects.map(s => getSub(m, s.id, subjects)?.score || 0);
      const maxSectionScore = Math.max(...scores, 0);
      return { ...m, maxSectionScore };
    });
  }, [activeTrendFilteredChronologicalMocks, subjects, currentHash, cache]);

  const flattenedData = useMemo(() => {
    if (cache.isDashboardCached && cache.dashboardHash === currentHash && cache.flattenedData?.length > 0) return cache.flattenedData;
    const data: any[] = [];
    let index = 0;
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
    chartDataReversed.forEach((mock) => {
      const bars: any[] = [];
      subjects.forEach((s, sIdx) => {
        const score = getSub(mock, s.id, subjects)?.score;
        if ((activeTrendId === 'overall' || activeTrendId === 'full' || activeTrendId === s.id) && score != null && score !== 0) {
          bars.push({ ...mock, cellSub: s.short || s.name, cellScore: score, fill: colors[sIdx % colors.length] });
        }
      });
      
      const n = bars.length;
      if (n === 0) return;
      
      const centerIdx = Math.floor((n - 1) / 2);
      
      bars.forEach((b, i) => {
        data.push({ 
           ...b, 
           flatIndex: index++, 
           isCenter: i === centerIdx,
           barCount: n
        });
      });
      
      data.push({ ...mock, isGap: true, flatIndex: index++ });
      data.push({ ...mock, isGap: true, flatIndex: index++ });
    });
    while (data.length > 0 && data[data.length - 1].isGap) {
      data.pop(); // remove trailing gap
    }
    return data;
  }, [chartDataReversed, activeTrendId, subjects, currentHash, cache]);

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const item = flattenedData[payload.value];
    if (!item || item.isGap || !item.isCenter) return null;
    
    const words = item.mockName.split(' '); 
    const name = words.length <= 3 ? item.mockName : words.slice(-3).join(' ');
    
    // Shift slightly to the right if even number of bars to be perfectly centered
    const dx = item.barCount % 2 === 0 ? 15 : 0; 

    return (
      <text x={x} y={y} dy={10} dx={dx} textAnchor="middle" fill="#ffffff" fontSize={11}>
        {name}
      </text>
    );
  };
  
  // Write newly computed values to store if they changed
  useEffect(() => {
    if (cache.dashboardHash !== currentHash) {
       cache.updateDashboardCache({
         dashboardHash: currentHash,
         displayedMocks,
         activeTrendFilteredMocks,
         activeTrendFilteredChronologicalMocks,
         averageTrendLineValue,
         overallTrendAveragesData,
         chronologicalMocks,
         dashboardStats: stats,
         chartDataReversed,
         flattenedData
       });
    }
  }, [currentHash, cache, displayedMocks, activeTrendFilteredMocks, activeTrendFilteredChronologicalMocks, averageTrendLineValue, overallTrendAveragesData, chronologicalMocks, stats, chartDataReversed, flattenedData]);

  if (mocks.length === 0 && deletedMocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
          <Target className="w-10 h-10" />
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No mocks added yet</h2>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-md px-4">Click the "Add Mock" button above to upload a scorecard image and start tracking your progress.</p>
      </div>
    );
  }

  if (mocks.length === 0 && deletedMocks.length > 0 && !showRecycleBin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center relative">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
          <Target className="w-10 h-10" />
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No mocks added yet</h2>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-md px-4">Click the "Add Mock" button above to upload a scorecard image and start tracking your progress.</p>
        
        <button 
           onClick={() => setShowRecycleBin(true)}
           className="mt-8 flex items-center gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-4 py-2 rounded-xl transition-colors font-medium border border-rose-100 dark:border-rose-900/50"
        >
           <Trash2 className="w-4 h-4" /> Open Recycle Bin ({deletedMocks.length})
        </button>
      </div>
    );
  }

  const totalTasksCount = mocks.reduce((acc, mock) => acc + (mock.tasks?.length || 0), 0);
  const pendingTasksCount = mocks.reduce((acc, mock) => acc + (mock.tasks?.filter(t => !t.completed).length || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-0">
      {/* Tabs */}
      <DashboardFilters
        examTypes={examTypes}
        selectedExam={selectedExam}
        setSelectedExam={setSelectedExam}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        availablePhases={availablePhases}
        selectedPhase={selectedPhase}
        setSelectedPhase={setSelectedPhase}
        availableScopes={availableScopes}
        selectedScope={selectedScope}
        setSelectedScope={setSelectedScope}
        hasMocks={mocks.length > 0}
      />

      {stats && (
        <>
          
  
  
    {/* Quick Stats Cards */}
          <DashboardStatCards
            profile={profile}
            stats={stats}
            goalPercentile={goalPercentile}
            goalPercentileStr={goalPercentileStr}
            setGoalPercentileStr={setGoalPercentileStr}
            leaderboardRank={leaderboardRank}
          />

          <DashboardCharts
            activeTrendId={activeTrendId}
            setActiveTrendId={setActiveTrendId}
            selectedTrendPeriod={selectedTrendPeriod}
            setSelectedTrendPeriod={setSelectedTrendPeriod}
            subjects={subjects}
            chartView={chartView}
            setChartView={setChartView}
            activeTrendFilteredChronologicalMocks={activeTrendFilteredChronologicalMocks}
            overallTrendAveragesData={overallTrendAveragesData}
            averageTrendLineValue={averageTrendLineValue}
            flattenedData={flattenedData}
            displayedMocks={displayedMocks}
            stats={stats}
            getSub={getSub}
            getSubjectColor={getSubjectColor}
            parseLocalDate={parseLocalDate}
          />

          {/* Smart Insights */}
          <div className="mt-8 mb-4 flex items-center gap-2">
            <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-100">Smart Insights</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Beta</span>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
             <DashboardInsights
               chronologicalMocks={chronologicalMocks}
               recentMocks={[...chronologicalMocks].reverse().slice(0, 5)}
               subjects={subjects}
               pendingTasksCount={pendingTasksCount}
               setActiveTab={setActiveTab}
             />
          </div>

        </>
      )}

      <RecentMocksTable
          showRecycleBin={showRecycleBin}
          setShowRecycleBin={setShowRecycleBin}
          activeTrendFilteredMocks={activeTrendFilteredMocks}
          deletedMocks={deletedMocks}
          subjects={subjects}
          getSub={getSub}
          setActiveTab={setActiveTab}
          totalTasksCount={totalTasksCount}
          pendingTasksCount={pendingTasksCount}
          onDeleteMock={deleteMock}
          onEditMock={(mock) => {
            setMockToEdit(mock);
            setActiveTab('add-mock');
          }}
          onRestoreMock={restoreDeletedMock}
          onPermanentlyDeleteMock={permanentlyDeleteMock}
          onUpdateReflection={async (id, data) => {
             const currentMock = [...activeTrendFilteredMocks, ...deletedMocks].find(m => m.id === id);
             if (currentMock) {
                 await updateMock({ ...currentMock, ...data });
             }
          }}
        />
    </div>
  );
}


