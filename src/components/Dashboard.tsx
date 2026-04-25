import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MockScore, UserProfile } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine, LabelList
} from 'recharts';
import { Trophy, TrendingUp, Target, CalendarDays, Calculator, Brain, BookA, ChevronRight, Trash2, Edit2, RotateCcw, Flame } from 'lucide-react';
import { getHeatmapColor, getPlatformShort } from '../lib/utils';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface DashboardProps {
  mocks: MockScore[];
  profile?: UserProfile;
  onDeleteMock?: (id: string) => void;
  onEditMock?: (mock: MockScore) => void;
  lastDeletedMock?: MockScore | null;
  onRestoreMock?: () => void;
}

export default function Dashboard({ mocks, profile, onDeleteMock, onEditMock, lastDeletedMock, onRestoreMock }: DashboardProps) {
  const [selectedExam, setSelectedExam] = useState<string>('Overview');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [activeTrendId, setActiveTrendId] = useState<string>('overall');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else if (sortDirection === 'asc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortConfig = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? '⬇' : '⬆';
  };

  // get unique exam types
  const examTypes = useMemo(() => {
    const types = new Set(mocks.map(m => m.examType).filter(Boolean));
    return ['Overview', ...Array.from(types).sort()];
  }, [mocks]);

  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchRank = async () => {
      if (!profile) return;
      try {
        const q = query(collection(db, 'users'), orderBy('avgPercentile', 'desc'));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data() as UserProfile).filter(u => !u.isBanned && !u.isMuted && u.totalTests > 0);
        const rank = users.findIndex(u => u.userId === profile.userId) + 1;
        if (rank > 0) {
          setLeaderboardRank(rank);
        }
      } catch (e) {
        console.error("Error fetching rank", e);
      }
    };
    fetchRank();
  }, [profile]);

  // reset subfilters when main exam changes
  React.useEffect(() => {
    setSelectedRole('All');
    setSelectedPhase('All');
    setSelectedScope('All');
  }, [selectedExam]);

  // filter
  const displayedMocks = useMemo(() => {
    let filtered = mocks;
    if (selectedExam !== 'Overview') {
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
    // sort by date asc for charts
    return [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mocks, selectedExam, selectedRole, selectedPhase, selectedScope]);

  // Derive unique roles and scopes for the current selection
  const availableRoles = useMemo(() => {
    if (selectedExam === 'Overview') return [];
    const baseSelected = mocks.filter(m => m.examType === selectedExam);
    const roles = new Set(baseSelected.map(m => m.examRole).filter(Boolean));
    return roles.size > 0 ? ['All', ...Array.from(roles).sort()] : [];
  }, [mocks, selectedExam]);

  const availablePhases = useMemo(() => {
    if (selectedExam === 'Overview') return [];
    let baseSelected = mocks.filter(m => m.examType === selectedExam);
    if (selectedRole !== 'All') {
      baseSelected = baseSelected.filter(m => m.examRole === selectedRole);
    }
    const phases = new Set(baseSelected.map(m => m.examPhase).filter(Boolean));
    return phases.size > 0 ? ['All', ...Array.from(phases).sort()] : [];
  }, [mocks, selectedExam, selectedRole]);

  const availableScopes = useMemo(() => {
    if (selectedExam === 'Overview') return [];
    let baseSelected = mocks.filter(m => m.examType === selectedExam);
    if (selectedRole !== 'All') {
      baseSelected = baseSelected.filter(m => m.examRole === selectedRole);
    }
    if (selectedPhase !== 'All') {
      baseSelected = baseSelected.filter(m => m.examPhase === selectedPhase);
    }
    const scopes = new Set(baseSelected.map(m => m.examScope).filter(Boolean));
    return scopes.size > 0 ? ['All', ...Array.from(scopes).sort()] : [];
  }, [mocks, selectedExam, selectedRole, selectedPhase]);

  // Overview stats calculation
  const chronologicalMocks = useMemo(() => {
    return [...displayedMocks].reverse();
  }, [displayedMocks]);

  const stats = useMemo(() => {
    if (displayedMocks.length === 0) return null;
    
    const avgScore = (displayedMocks.reduce((acc, m) => acc + m.score, 0) / displayedMocks.length).toFixed(1);
    const avgPercentile = (displayedMocks.reduce((acc, m) => acc + m.percentile, 0) / displayedMocks.length).toFixed(1);
    const accuracyMocks = displayedMocks.filter(m => m.accuracy !== undefined && !isNaN(m.accuracy));
    const avgAccuracy = accuracyMocks.length > 0 ? (accuracyMocks.reduce((acc, m) => acc + m.accuracy!, 0) / accuracyMocks.length).toFixed(1) : '-';
    
    const totalTests = displayedMocks.length;
    
    // Recent trend (last vs second last)
    const recent = displayedMocks[displayedMocks.length - 1];
    const prev = displayedMocks.length > 1 ? displayedMocks[displayedMocks.length - 2] : null;
    const scoreDiff = prev ? (recent.score - prev.score).toFixed(1) : 0;
    const isScoreUp = prev ? recent.score >= prev.score : true;

    return { avgScore, avgPercentile, avgAccuracy, totalTests, scoreDiff, isScoreUp, recent };
  }, [displayedMocks]);

  const chartData = useMemo(() => {
    const hasQuant = displayedMocks.some(m => m.quant?.score != null && m.quant.score !== 0);
    const hasReasoning = displayedMocks.some(m => m.reasoning?.score != null && m.reasoning.score !== 0);
    const hasEnglish = displayedMocks.some(m => m.english?.score != null && m.english.score !== 0);
    const hasGA = displayedMocks.some(m => m.ga?.score != null && m.ga.score !== 0);
    return { hasQuant, hasReasoning, hasEnglish, hasGA };
  }, [displayedMocks]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MockScore;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl text-sm min-w-[220px]">
          <p className="font-semibold text-slate-100 mb-1.5">{data.mockName || 'Mock Test'}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md text-slate-300 font-medium">{data.examType}</span>
            {data.examRole && <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded-md text-indigo-300 font-medium">{data.examRole}</span>}
            {data.examPhase && <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-md text-amber-300 font-medium">{data.examPhase}</span>}
            {data.examScope && <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded-md text-emerald-300 font-medium">{data.examScope}</span>}
          </div>
          <div className="space-y-1.5 border-t border-slate-800 pt-3 mt-3">
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-400 font-medium">Percentile</span>
              <span className="font-mono font-bold text-emerald-400">{data.percentile || '-'}%</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-400 font-medium">Overall Score</span>
              <span className="font-mono font-bold text-blue-400">{data.score || '-'}</span>
            </div>
            {(data.quant?.score || data.reasoning?.score || data.english?.score || data.ga?.score) ? (
              <>
                <div className="border-t border-slate-800 my-1.5" />
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">Sectional Scores</div>
                {data.quant?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Quant</span><span className="font-mono text-slate-100 font-medium text-xs">{data.quant.score}</span></div> : null}
                {data.reasoning?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Reasoning</span><span className="font-mono text-slate-100 font-medium text-xs">{data.reasoning.score}</span></div> : null}
                {data.english?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">English</span><span className="font-mono text-slate-100 font-medium text-xs">{data.english.score}</span></div> : null}
                {data.ga?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">GA</span><span className="font-mono text-slate-100 font-medium text-xs">{data.ga.score}</span></div> : null}
              </>
            ) : null}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomBarLabel = (props: any, section: 'quant' | 'reasoning' | 'english' | 'ga') => {
    const { x, y, width, value, index } = props;
    const mock = chronologicalMocks[index];
    if (!mock) return null;
    const percentile = mock[section]?.percentile;
    
    const hasValue = value !== null && value !== undefined && value !== '';
    const hasPercentile = percentile !== null && percentile !== undefined && percentile !== '';
    
    if (!hasValue && !hasPercentile) return null;
    
    // Position y needs to make sure text doesn't flow off the svg container top. 
    // Usually y is close to 0 if the bar is very tall.
    const scoreY = Math.max(y - 4, 16);
    const percY = hasValue ? scoreY - 12 : scoreY;

    return (
      <g>
        {hasPercentile && <text x={x + width / 2} y={percY} className="fill-slate-500 dark:fill-slate-400" fontSize="10" textAnchor="middle">{percentile}%</text>}
        {hasValue && <text x={x + width / 2} y={scoreY} className="fill-slate-700 dark:fill-slate-200" fontSize="11" fontWeight="bold" textAnchor="middle">{value}</text>}
      </g>
    );
  };

  if (mocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
          <Target className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No mocks added yet</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">Click the "Add Mock" button above to upload a scorecard image and start tracking your progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Tabs */}
      <div className="flex overflow-x-auto pb-4 gap-2 custom-scrollbar">
        <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl items-center flex-nowrap w-max border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md shadow-sm relative">
          {examTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedExam(type)}
              className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 z-10 ${
                selectedExam === type 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {selectedExam === type && (
                <motion.div
                  layoutId="activeExamTab"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-600 -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{type}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedExam !== 'Overview' && (availableRoles.length > 1 || availablePhases.length > 1 || availableScopes.length > 1) && (
        <div className="flex flex-col gap-4 mb-6 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm">
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
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50' 
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

      {stats && (
        <>
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* 1. Streak */}
            <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm border-l-4 transition-colors ${profile?.streakActive !== false ? 'border-l-orange-500 border-slate-100 dark:border-slate-700' : 'border-l-slate-300 dark:border-l-slate-600 border-slate-100 dark:border-slate-700'}`}>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Flame className={`w-5 h-5 ${profile?.streakActive !== false ? 'text-orange-500 animate-pulse drop-shadow-sm' : 'text-slate-300 dark:text-slate-600'}`} />
                <span className={`font-medium text-xs sm:text-sm truncate ${profile?.streakActive === false && 'text-slate-400 dark:text-slate-500'}`}>Streak</span>
              </div>
              <div className={`text-3xl font-light ${profile?.streakActive !== false ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'}`}>{profile?.streak || 0}</div>
            </div>

            {/* 2. Avg Percentile */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Trophy className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Avg Percentile</span>
              </div>
              <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{stats.avgPercentile}<span className="text-sm sm:text-lg text-slate-400 dark:text-slate-500 ml-1">%</span></div>
            </div>

            {/* 3. Avg Accuracy */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Target className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Avg Accuracy</span>
              </div>
              <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{stats.avgAccuracy}{stats.avgAccuracy !== '-' && <span className="text-sm sm:text-lg text-slate-400 dark:text-slate-500 ml-1">%</span>}</div>
            </div>

            {/* 4. Recent Trend */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Recent Trend</span>
              </div>
              <div className="flex pb-1 items-end gap-2">
                <span className="text-3xl font-light leading-none text-slate-900 dark:text-slate-100">{stats.recent.score}</span>
                {Number(stats.scoreDiff) !== 0 && (
                  <span className={`text-xs font-medium leading-none ${stats.isScoreUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.isScoreUp ? '+' : ''}{stats.scoreDiff}
                  </span>
                )}
              </div>
            </div>

            {/* 5. Total Tests */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-amber-500">
               <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <CalendarDays className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Total Tests</span>
              </div>
              <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{stats.totalTests}</div>
            </div>

            {/* 6. Leaderboard Position */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-purple-500">
               <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Trophy className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Rank</span>
              </div>
              <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{leaderboardRank ? `#${leaderboardRank}` : '-'}</div>
            </div>
            
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Percentile Trend */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[300px] lg:col-span-2 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center mb-2 sm:mb-0">
                  <Trophy className="w-5 h-5 mr-2 text-slate-400 dark:text-slate-500" /> Percentile Trend
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {['overall', 'quant', 'reasoning', 'english', 'ga'].map(key => (
                    <button 
                      key={key} 
                      onClick={() => setActiveTrendId(key)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${activeTrendId === key ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chronologicalMocks.filter(m => m.examScope === 'Full' || !m.examScope)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} tickFormatter={(val) => { const d = new Date(val); return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`; }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
                    <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                    <Line connectNulls={true} type="monotone" dataKey={activeTrendId === 'overall' ? 'percentile' : `${activeTrendId}.percentile`} name={activeTrendId === 'overall' ? 'Percentile' : `${activeTrendId} %ile`} stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Chart: Sectional Scores */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[300px] lg:col-span-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center justify-center">
                <Target className="w-5 h-5 mr-2 text-slate-400 dark:text-slate-500" /> 
                Sectional Score Breakdown
              </h3>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chronologicalMocks} margin={{ top: 30, right: 20, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                    <XAxis dataKey="mockName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} tickFormatter={(val) => val.length > 20 ? val.substring(0,20)+'...' : val} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ zIndex: 1000 }} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }} 
                      payload={[
                        ...(chartData.hasQuant ? [{ value: 'Quant', type: 'square', id: 'quant', color: '#3b82f6' }] as any[] : []),
                        ...(chartData.hasReasoning ? [{ value: 'Reasoning', type: 'square', id: 'reasoning', color: '#8b5cf6' }] as any[] : []),
                        ...(chartData.hasEnglish ? [{ value: 'English', type: 'square', id: 'english', color: '#f59e0b' }] as any[] : []),
                        ...(chartData.hasGA ? [{ value: 'GA', type: 'square', id: 'ga', color: '#10b981' }] as any[] : []),
                      ]}
                    />
                    {chartData.hasQuant && <Bar dataKey="quant.score" name="Quant" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="quant.score" content={(props: any) => renderCustomBarLabel(props, 'quant')} />
                    </Bar>}
                    {chartData.hasReasoning && <Bar dataKey="reasoning.score" name="Reasoning" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="reasoning.score" content={(props: any) => renderCustomBarLabel(props, 'reasoning')} />
                    </Bar>}
                    {chartData.hasEnglish && <Bar dataKey="english.score" name="English" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="english.score" content={(props: any) => renderCustomBarLabel(props, 'english')} />
                    </Bar>}
                    {chartData.hasGA && <Bar dataKey="ga.score" name="GA" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="ga.score" content={(props: any) => renderCustomBarLabel(props, 'ga')} />
                    </Bar>}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Grid: Technical Style */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mt-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">History Log</h3>
              {lastDeletedMock && onRestoreMock && (
                <button
                  onClick={onRestoreMock}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors animate-in fade-in slide-in-from-right-4"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore '{lastDeletedMock.mockName}'
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('date')}>Time {getSortConfig('date')}</th>
                    <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('examType')}>Exam {getSortConfig('examType')}</th>
                    <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('mockName')}>Mock Name {getSortConfig('mockName')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('score')}>Score {getSortConfig('score')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('percentile')}>Percentile {getSortConfig('percentile')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('quant.score')}>Quant {getSortConfig('quant.score')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('reasoning.score')}>Reasoning {getSortConfig('reasoning.score')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('english.score')}>English {getSortConfig('english.score')}</th>
                    <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('ga.score')}>GA {getSortConfig('ga.score')}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {(() => {
                    let data = [...displayedMocks].reverse();
                    if (sortField && sortDirection) {
                      data.sort((a, b) => {
                        const getNestedVal = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
                        let valA = getNestedVal(a, sortField);
                        let valB = getNestedVal(b, sortField);
                        
                        // Handle potential undefined/null values
                        if (valA == null) valA = '';
                        if (valB == null) valB = '';
                        
                        // Numeric comparison if both are numbers or numeric strings
                        const numA = Number(valA);
                        const numB = Number(valB);
                        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                          return sortDirection === 'desc' ? numB - numA : numA - numB;
                        }
                        
                        // String comparison
                        valA = String(valA).toLowerCase();
                        valB = String(valB).toLowerCase();
                        if (valA < valB) return sortDirection === 'desc' ? 1 : -1;
                        if (valA > valB) return sortDirection === 'desc' ? -1 : 1;
                        return 0;
                      });
                    }
                    return data.map((mock, index, arr) => {
                      const mockDate = new Date(mock.date);
                      const formattedDate = mockDate.toLocaleDateString('en-GB');
                      const formattedTime = mockDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      const isTimeValid = !isNaN(mockDate.getTime()) && mock.date.includes('T');
                      
                      const currentDateString = mockDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                      const prevDateString = index > 0 ? new Date(arr[index - 1].date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : null;
                      
                      const showDivider = !sortField && (index === 0 || currentDateString !== prevDateString);

                    return (
                      <React.Fragment key={mock.id}>
                        {showDivider && (
                          <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                            <td colSpan={10} className="px-5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 border-y border-slate-100 dark:border-slate-800 text-left">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                {currentDateString}
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr 
                          onClick={(e) => setActiveRowId(activeRowId === mock.id ? null : mock.id)}
                          className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group relative cursor-pointer ${activeRowId === mock.id ? 'bg-slate-50/80 dark:bg-slate-700/50' : ''}`}
                        >
                          <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap text-center">
                            <div className="flex flex-col items-center">
                              {isTimeValid ? <span>{formattedTime}</span> : <span>-</span>}
                            </div>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300 text-center">
                             <div className="flex flex-col items-center gap-1">
                               <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold">
                                 {mock.examType}
                               </span>
                               {mock.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">{mock.examRole}</span>}
                             </div>
                          </td>
                          <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                            <div className="flex flex-col">
                               <span>{mock.mockName}</span>
                               <div className="flex gap-1.5 mt-1">
                                 {mock.platform && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">{getPlatformShort(mock.platform)}</span>}
                                 {mock.examPhase && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">{mock.examPhase}</span>}
                                 {mock.examScope && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium">{mock.examScope}</span>}
                               </div>
                             </div>
                          </td>
                          <td className="p-4 font-mono font-medium text-blue-600 dark:text-blue-400 text-center align-middle">
                            {mock.score != null && mock.score !== 0 ? mock.score : '-'}
                          </td>
                          <td className="p-4 text-center align-middle">
                            <div className="flex flex-col items-center gap-1">
                              {mock.percentile != null && mock.percentile !== 0 ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(mock.percentile)}`}>
                                  {mock.percentile}%P
                                </span>
                              ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                              {mock.accuracy != null && mock.accuracy !== 0 && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium ${getHeatmapColor(mock.accuracy)}`}>
                                  {mock.accuracy}%A
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center align-middle">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-600 dark:text-slate-300">{mock.quant?.score != null && mock.quant.score !== 0 ? mock.quant.score : '-'}</span>
                              <div className="flex flex-col gap-0.5 mt-1 items-center">
                                {mock.quant?.percentile != null && mock.quant.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(mock.quant.percentile)}`}>{mock.quant.percentile}%P</span>}
                                {mock.quant?.accuracy != null && mock.quant.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(mock.quant.accuracy)}`}>{mock.quant.accuracy}%A</span>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center align-middle">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-600 dark:text-slate-300">{mock.reasoning?.score != null && mock.reasoning.score !== 0 ? mock.reasoning.score : '-'}</span>
                              <div className="flex flex-col gap-0.5 mt-1 items-center">
                                {mock.reasoning?.percentile != null && mock.reasoning.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(mock.reasoning.percentile)}`}>{mock.reasoning.percentile}%P</span>}
                                {mock.reasoning?.accuracy != null && mock.reasoning.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(mock.reasoning.accuracy)}`}>{mock.reasoning.accuracy}%A</span>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center align-middle">
                             <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-600 dark:text-slate-300">{mock.english?.score != null && mock.english.score !== 0 ? mock.english.score : '-'}</span>
                              <div className="flex flex-col gap-0.5 mt-1 items-center">
                                {mock.english?.percentile != null && mock.english.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(mock.english.percentile)}`}>{mock.english.percentile}%P</span>}
                                {mock.english?.accuracy != null && mock.english.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(mock.english.accuracy)}`}>{mock.english.accuracy}%A</span>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center align-middle">
                             <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-600 dark:text-slate-300">{mock.ga?.score != null && mock.ga.score !== 0 ? mock.ga.score : '-'}</span>
                              <div className="flex flex-col gap-0.5 mt-1 items-center">
                                {mock.ga?.percentile != null && mock.ga.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(mock.ga.percentile)}`}>{mock.ga.percentile}%P</span>}
                                {mock.ga?.accuracy != null && mock.ga.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(mock.ga.accuracy)}`}>{mock.ga.accuracy}%A</span>}
                              </div>
                            </div>
                          </td>
                          {(onDeleteMock || onEditMock) && (
                            <td className="w-20 p-0 align-middle">
                              <div className={`flex items-center justify-end pr-4 transition-opacity ${activeRowId === mock.id ? 'opacity-100' : 'opacity-0'}`}>
                                {onEditMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onEditMock(mock); }} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors bg-blue-50 dark:bg-blue-900/20" title="Edit Mock">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {onDeleteMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onDeleteMock(mock.id); }} className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-md transition-colors bg-rose-50 dark:bg-rose-900/20 ml-2" title="Remove Mock">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                    })
                  })()}
                </tbody>
              </table>
            </div>

            {/* Heatmap Legend beneath History Log */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 justify-center">
                <span className="font-medium mr-2">Percentile Legend:</span>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500 ring-1 ring-emerald-600/20"></div> &ge;95%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-500/20 dark:ring-emerald-500/50"></div> 90-95%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/50 ring-1 ring-emerald-500/20 dark:ring-emerald-500/50"></div> 80-90%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/50 ring-1 ring-amber-500/20 dark:ring-amber-500/50"></div> 70-80%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-100 dark:bg-rose-900/50 ring-1 ring-rose-500/20 dark:ring-rose-500/50"></div> &lt;70%ile</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
