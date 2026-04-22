import React, { useMemo, useState } from 'react';
import { MockScore } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine
} from 'recharts';
import { Trophy, TrendingUp, Target, CalendarDays, Calculator, Brain, BookA, ChevronRight, Trash2, Edit2, RotateCcw } from 'lucide-react';

interface DashboardProps {
  mocks: MockScore[];
  onDeleteMock?: (id: string) => void;
  onEditMock?: (mock: MockScore) => void;
  lastDeletedMock?: MockScore | null;
  onRestoreMock?: () => void;
}

export default function Dashboard({ mocks, onDeleteMock, onEditMock, lastDeletedMock, onRestoreMock }: DashboardProps) {
  const [selectedExam, setSelectedExam] = useState<string>('Overview');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // get unique exam types
  const examTypes = useMemo(() => {
    const types = new Set(mocks.map(m => m.examType).filter(Boolean));
    return ['Overview', ...Array.from(types).sort()];
  }, [mocks]);

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
  const stats = useMemo(() => {
    if (displayedMocks.length === 0) return null;
    
    const avgScore = (displayedMocks.reduce((acc, m) => acc + m.score, 0) / displayedMocks.length).toFixed(1);
    const avgPercentile = (displayedMocks.reduce((acc, m) => acc + m.percentile, 0) / displayedMocks.length).toFixed(1);
    const totalTests = displayedMocks.length;
    
    // Recent trend (last vs second last)
    const recent = displayedMocks[displayedMocks.length - 1];
    const prev = displayedMocks.length > 1 ? displayedMocks[displayedMocks.length - 2] : null;
    const scoreDiff = prev ? (recent.score - prev.score).toFixed(1) : 0;
    const isScoreUp = prev ? recent.score >= prev.score : true;

    return { avgScore, avgPercentile, totalTests, scoreDiff, isScoreUp, recent };
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
            {(data.quant?.score || data.reasoning?.score || data.english?.score) ? (
              <>
                <div className="border-t border-slate-800 my-1.5" />
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">Sectional Scores</div>
                {data.quant?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Quant</span><span className="font-mono text-slate-100 font-medium text-xs">{data.quant.score}</span></div> : null}
                {data.reasoning?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Reasoning</span><span className="font-mono text-slate-100 font-medium text-xs">{data.reasoning.score}</span></div> : null}
                {data.english?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">English</span><span className="font-mono text-slate-100 font-medium text-xs">{data.english.score}</span></div> : null}
              </>
            ) : null}
          </div>
        </div>
      );
    }
    return null;
  };

  const getHeatmapColor = (percentile: number) => {
    if (percentile >= 95) return 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600/20';
    if (percentile >= 90) return 'bg-emerald-400 text-white shadow-sm ring-1 ring-emerald-500/20';
    if (percentile >= 80) return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20';
    if (percentile >= 70) return 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20';
    if (percentile > 0) return 'bg-rose-100 text-rose-700 ring-1 ring-rose-500/20';
    return 'bg-slate-100 text-slate-400';
  };

  const renderCustomBarLabel = (props: any, section: 'quant' | 'reasoning' | 'english') => {
    const { x, y, width, value, index } = props;
    const mock = displayedMocks[index];
    if (!mock) return null;
    const percentile = mock[section]?.percentile;
    if (!value && !percentile) return null;
    return (
      <g>
        {percentile > 0 && <text x={x + width / 2} y={y - 16} fill="#64748b" fontSize="10" textAnchor="middle">{percentile}%</text>}
        {value > 0 && <text x={x + width / 2} y={y - 4} fill="#334155" fontSize="11" fontWeight="bold" textAnchor="middle">{value}</text>}
      </g>
    );
  };

  if (mocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
          <Target className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">No mocks added yet</h2>
        <p className="text-slate-500 max-w-md">Click the "Add Mock" button above to upload a scorecard image and start tracking your progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {examTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedExam(type)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedExam === type 
                ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {selectedExam !== 'Overview' && (availableRoles.length > 1 || availablePhases.length > 1 || availableScopes.length > 1) && (
        <div className="flex flex-col gap-3 -mt-4 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
          {availableRoles.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest w-16">Role:</span>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedRole === role 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availablePhases.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest w-16">Phase:</span>
              <div className="flex flex-wrap gap-2">
                {availablePhases.map(phase => (
                  <button
                    key={phase}
                    onClick={() => setSelectedPhase(phase)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedPhase === phase 
                        ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {phase}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableScopes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest w-16">Scope:</span>
              <div className="flex flex-wrap gap-2">
                {availableScopes.map(scope => (
                  <button
                    key={scope}
                    onClick={() => setSelectedScope(scope)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedScope === scope 
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <Target className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-sm">Average Score</span>
              </div>
              <div className="text-3xl font-light text-slate-900">{stats.avgScore}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <Trophy className="w-5 h-5 text-indigo-500" />
                <span className="font-medium text-sm">Avg Percentile</span>
              </div>
              <div className="text-3xl font-light text-slate-900">{stats.avgPercentile}<span className="text-lg text-slate-400 ml-1">%ile</span></div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-sm">Recent Trend</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-light text-slate-900">{stats.recent.score}</span>
                {Number(stats.scoreDiff) !== 0 && (
                  <span className={`text-sm font-medium mb-1 ${stats.isScoreUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.isScoreUp ? '+' : ''}{stats.scoreDiff}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
               <div className="flex items-center gap-3 text-slate-500 mb-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-sm">Total Tests</span>
              </div>
              <div className="text-3xl font-light text-slate-900">{stats.totalTests}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Percentile Trend */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[300px] lg:col-span-2">
              <h3 className="font-semibold text-slate-800 mb-6 flex items-center justify-between">
                <span className="flex items-center"><Trophy className="w-5 h-5 mr-2 text-slate-400" /> Percentile Trend & Score Progression</span>
              </h3>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayedMocks.filter(m => m.examScope === 'Full' || !m.examScope)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                    <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
                    <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                    <Line type="monotone" dataKey="percentile" name="Percentile" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Chart: Sectional Scores */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[300px] lg:col-span-2">
              <h3 className="font-semibold text-slate-800 mb-6 flex items-center">
                <Target className="w-5 h-5 mr-2 text-slate-400" /> 
                Sectional Score Breakdown
              </h3>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayedMocks} margin={{ top: 30, right: 20, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mockName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} tickFormatter={(val) => val.length > 20 ? val.substring(0,20)+'...' : val} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} wrapperStyle={{ zIndex: 1000 }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="quant.score" name="Quant" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} label={(props: any) => renderCustomBarLabel(props, 'quant')} />
                    <Bar dataKey="reasoning.score" name="Reasoning" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28} label={(props: any) => renderCustomBarLabel(props, 'reasoning')} />
                    <Bar dataKey="english.score" name="English" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} label={(props: any) => renderCustomBarLabel(props, 'english')} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Grid: Technical Style */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">History Log</h3>
              {lastDeletedMock && onRestoreMock && (
                <button
                  onClick={onRestoreMock}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors animate-in fade-in slide-in-from-right-4"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore '{lastDeletedMock.mockName}'
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Mock Name</th>
                    {selectedExam === 'Overview' && <th className="p-4 font-semibold">Exam</th>}
                    <th className="p-4 font-semibold text-right">Score</th>
                    <th className="p-4 font-semibold text-right">Percentile</th>
                    <th className="p-4 font-semibold text-right hidden sm:table-cell">Quant</th>
                    <th className="p-4 font-semibold text-right hidden lg:table-cell">Reasoning</th>
                    <th className="p-4 font-semibold text-right hidden lg:table-cell">English</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[...displayedMocks].reverse().map((mock, index, arr) => {
                    const mockDate = new Date(mock.date);
                    const formattedDate = mockDate.toLocaleDateString('en-GB');
                    const formattedTime = mockDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    const isTimeValid = !isNaN(mockDate.getTime()) && mock.date.includes('T');
                    
                    const currentDateString = mockDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                    const prevDateString = index > 0 ? new Date(arr[index - 1].date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : null;
                    const showDivider = index > 0 && currentDateString !== prevDateString;

                    return (
                      <React.Fragment key={mock.id}>
                        {showDivider && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={selectedExam === 'Overview' ? 9 : 8} className="px-4 py-2 text-xs font-semibold text-slate-500 border-y border-slate-100">
                              {currentDateString}
                            </td>
                          </tr>
                        )}
                        <tr 
                          onClick={(e) => setActiveRowId(activeRowId === mock.id ? null : mock.id)}
                          className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors group relative cursor-pointer ${activeRowId === mock.id ? 'bg-slate-50/80' : ''}`}
                        >
                          <td className="p-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                            <div className="flex flex-col">
                              {isTimeValid && <span className="text-[10px] text-slate-400 mb-0.5">{formattedTime}</span>}
                              <span>{isTimeValid ? formattedDate : mock.date}</span>
                            </div>
                          </td>
                          <td className="p-4 font-medium text-slate-800">
                            <div className="flex flex-col">
                               <span>{mock.mockName}</span>
                               <div className="flex gap-1.5 mt-1">
                                 {mock.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-600 font-medium">{mock.examRole}</span>}
                                 {mock.examPhase && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-600 font-medium">{mock.examPhase}</span>}
                                 {mock.examScope && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 font-medium">{mock.examScope}</span>}
                               </div>
                             </div>
                          </td>
                          {selectedExam === 'Overview' && (
                            <td className="p-4 text-slate-600">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                                {mock.examType}
                              </span>
                            </td>
                          )}
                          <td className="p-4 text-right font-mono font-medium text-blue-600">{mock.score}</td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(mock.percentile)}`}>
                              {mock.percentile}%
                            </span>
                          </td>
                          <td className="p-4 text-right hidden sm:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-slate-600">{mock.quant.score}</span>
                              {mock.quant.percentile > 0 && <span className={`text-[10px] font-medium mt-0.5 px-1.5 rounded ${getHeatmapColor(mock.quant.percentile)}`}>{mock.quant.percentile}%</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right hidden lg:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-slate-600">{mock.reasoning.score}</span>
                              {mock.reasoning.percentile > 0 && <span className={`text-[10px] font-medium mt-0.5 px-1.5 rounded ${getHeatmapColor(mock.reasoning.percentile)}`}>{mock.reasoning.percentile}%</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right hidden lg:table-cell">
                             <div className="flex flex-col items-end">
                              <span className="font-mono text-slate-600">{mock.english.score}</span>
                              {mock.english.percentile > 0 && <span className={`text-[10px] font-medium mt-0.5 px-1.5 rounded ${getHeatmapColor(mock.english.percentile)}`}>{mock.english.percentile}%</span>}
                            </div>
                          </td>
                          {(onDeleteMock || onEditMock) && (
                            <td className="w-20 p-0 align-middle">
                              <div className={`flex items-center justify-end pr-4 transition-opacity ${activeRowId === mock.id ? 'opacity-100' : 'opacity-0'}`}>
                                {onEditMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onEditMock(mock); }} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-colors bg-blue-50" title="Edit Mock">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {onDeleteMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onDeleteMock(mock.id); }} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-md transition-colors bg-rose-50 ml-2" title="Remove Mock">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Heatmap Legend beneath History Log */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 justify-center">
                <span className="font-medium mr-2">Percentile Legend:</span>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500 ring-1 ring-emerald-600/20"></div> &ge;95%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-500/20"></div> 90-95%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-500/20"></div> 80-90%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-100 ring-1 ring-amber-500/20"></div> 70-80%ile</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-100 ring-1 ring-rose-500/20"></div> &lt;70%ile</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
