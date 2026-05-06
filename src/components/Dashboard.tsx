import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { MockScore, UserProfile, ReflectionTask } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine, LabelList, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Trophy, TrendingUp, Target, CalendarDays, Calculator, Brain, BookA, ChevronRight, Trash2, Edit2, RotateCcw, Flame, Download, CheckSquare, X, Check } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { ReflectionEditor } from './ReflectionEditor';

interface DashboardProps {
  mocks: MockScore[];
  deletedMocks?: MockScore[];
  profile?: UserProfile;
  onDeleteMock?: (id: string) => void;
  onEditMock?: (mock: MockScore) => void;
  onRestoreMock?: (id: string) => void;
  onPermanentlyDeleteMock?: (id: string) => void;
  onUpdateReflection?: (id: string, updates: Partial<MockScore>) => Promise<void>;
  onUpdateProfileTasks?: (tasks: ReflectionTask[]) => Promise<void>;
  showTasksModal?: boolean;
  setShowTasksModal?: (show: boolean) => void;
}

const PortalContent = ({ chartRefBox, coordinate, content, screenX, screenY, isRight, isBottom }: any) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el || !chartRefBox.current || !coordinate) return;
    
    let animationFrameId: number;
    
    const updatePosition = () => {
       if (chartRefBox.current && tooltipRef.current && coordinate) {
          const r = chartRefBox.current.getBoundingClientRect();
          const currentScreenX = r.left + coordinate.x;
          const currentScreenY = r.top + coordinate.y;
          
          const rightHalf = currentScreenX > window.innerWidth / 2;
          const bottomHalf = currentScreenY > window.innerHeight / 2;
          
          tooltipRef.current.style.left = `${currentScreenX}px`;
          tooltipRef.current.style.top = `${currentScreenY}px`;
          tooltipRef.current.style.transform = `translate(${rightHalf ? '-110%' : '10%'}, ${bottomHalf ? '-110%' : '10%'})`;
       }
       animationFrameId = requestAnimationFrame(updatePosition);
    };
    
    animationFrameId = requestAnimationFrame(updatePosition);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [chartRefBox, coordinate]);

  return createPortal(
    <div 
      ref={tooltipRef}
      className="fixed z-40 pointer-events-none transition-opacity duration-75 ease-out opacity-100"
      style={{ 
        left: screenX, 
        top: screenY,
        transform: `translate(${isRight ? '-110%' : '10%'}, ${isBottom ? '-110%' : '10%'})`
      }}
    >
      {content}
    </div>,
    document.body
  );
};

const CustomTooltip = ({ active, payload, coordinate, chartRefBox, activeTrendId }: any) => {
  const [visible, setVisible] = useState(false);
  const [lastTrend, setLastTrend] = useState(activeTrendId);
  
  const payloadId = payload?.[0]?.payload?.id || payload?.[0]?.payload?.mockName;
  const coordX = coordinate?.x;
  const coordY = coordinate?.y;

  useEffect(() => {
    if (activeTrendId !== lastTrend) {
      setVisible(false);
      setLastTrend(activeTrendId);
    } else {
      if (active) setVisible(true);
      else setVisible(false);
    }
  }, [active, payloadId, coordX, coordY, activeTrendId, lastTrend]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setVisible(false);
    };

    if (visible && active) {
      // Small timeout so the trigger click doesn't immediately close it
      const timer = setTimeout(() => {
        document.addEventListener('touchstart', handleOutsideClick);
        document.addEventListener('mousedown', handleOutsideClick);
      }, 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('touchstart', handleOutsideClick);
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [visible, active]);

  if (active && visible && payload && payload.length) {
    const data = payload[0].payload as MockScore;
    
    const content = (
      <div 
        className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl text-sm min-w-[220px] max-w-[320px] relative z-40 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
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
              {data.quant?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Quant</span><span className="font-mono text-slate-100 font-medium text-xs"><span className={`text-[9px] font-bold px-1 rounded-sm mr-2 ${getHeatmapColor(data.quant.percentile || 0)}`}>{data.quant.percentile || '-'}%</span>{data.quant.score}</span></div> : null}
              {data.reasoning?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">Reasoning</span><span className="font-mono text-slate-100 font-medium text-xs"><span className={`text-[9px] font-bold px-1 rounded-sm mr-2 ${getHeatmapColor(data.reasoning.percentile || 0)}`}>{data.reasoning.percentile || '-'}%</span>{data.reasoning.score}</span></div> : null}
              {data.english?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">English</span><span className="font-mono text-slate-100 font-medium text-xs"><span className={`text-[9px] font-bold px-1 rounded-sm mr-2 ${getHeatmapColor(data.english.percentile || 0)}`}>{data.english.percentile || '-'}%</span>{data.english.score}</span></div> : null}
              {data.ga?.score ? <div className="flex justify-between items-center gap-4"><span className="text-slate-300 text-xs">GA</span><span className="font-mono text-slate-100 font-medium text-xs"><span className={`text-[9px] font-bold px-1 rounded-sm mr-2 ${getHeatmapColor(data.ga.percentile || 0)}`}>{data.ga.percentile || '-'}%</span>{data.ga.score}</span></div> : null}
            </>
          ) : null}
        </div>
      </div>
    );

    if (chartRefBox && chartRefBox.current && coordinate && typeof document !== 'undefined') {
      const rect = chartRefBox.current.getBoundingClientRect();
      const screenX = rect.left + coordinate.x;
      const screenY = rect.top + coordinate.y;
      const isRight = screenX > window.innerWidth / 2;
      const isBottom = screenY > window.innerHeight / 2;

      return <PortalContent chartRefBox={chartRefBox} coordinate={coordinate} content={content} screenX={screenX} screenY={screenY} isRight={isRight} isBottom={isBottom} />;
    }

    return content;
  }
  return null;
};

const renderCustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined || value === '') return null;
  const scoreY = Math.max(y - 8, 16);
  return (
    <text x={x + width / 2} y={scoreY} className="fill-slate-700 dark:fill-slate-200" fontSize="11" fontWeight="bold" textAnchor="middle">{value}</text>
  );
};

function TaskProgressTracker({ 
  task, 
  onUpdateParts 
}: { 
  task: ReflectionTask, 
  onUpdateParts: (completedParts: number | undefined, totalParts: number | undefined) => void 
}) {
  const hasTracker = task.totalParts !== undefined;
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [localCp, setLocalCp] = useState<string>(task.completedParts !== undefined ? String(task.completedParts) : "0");
  const [localTp, setLocalTp] = useState<string>(task.totalParts !== undefined ? String(task.totalParts) : "10");

  useEffect(() => {
    if (task.completedParts !== undefined) setLocalCp(String(task.completedParts));
    if (task.totalParts !== undefined) setLocalTp(String(task.totalParts));
  }, [task.completedParts, task.totalParts]);

  if (!hasTracker) {
    return (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onUpdateParts(0, 10);
          setIsExpanded(true);
        }}
        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors ml-1"
        title="Track progress"
      >
        <Target className="w-4 h-4" />
      </button>
    );
  }

  const parsedCp = parseInt(localCp);
  const parsedTp = parseInt(localTp);
  const cp = isNaN(parsedCp) ? (task.completedParts || 0) : parsedCp;
  const tp = isNaN(parsedTp) ? (task.totalParts || 10) : parsedTp;
  
  const percentage = tp > 0 ? (cp / tp) : 0;
  const offset = 50.26 - (percentage * 50.26);

  const commitCp = () => {
    let newCp = parseInt(localCp);
    if (isNaN(newCp)) newCp = task.completedParts || 0;
    const currentTp = task.totalParts || 10;
    if (newCp < 0) newCp = 0;
    if (newCp > currentTp) newCp = currentTp;
    setLocalCp(String(newCp));
    if (newCp !== task.completedParts) {
      onUpdateParts(newCp, currentTp);
    }
  };

  const commitTp = () => {
    let newTp = parseInt(localTp);
    if (isNaN(newTp)) newTp = task.totalParts || 10;
    if (newTp < 1) newTp = 1;
    let newCp = task.completedParts || 0;
    if (newCp > newTp) newCp = newTp;
    setLocalTp(String(newTp));
    if (newTp !== task.totalParts || newCp !== task.completedParts) {
      onUpdateParts(newCp, newTp);
    }
  };

  return (
    <div className="flex items-center gap-2 ml-2 shrink-0 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
      {isExpanded && (
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">
          <button 
            onClick={() => onUpdateParts(undefined, undefined)}
            className="text-slate-400 hover:text-rose-500 transition-colors mr-1 w-5 h-5 flex items-center justify-center rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 shrink-0"
            title="Remove tracking"
          >
            &times;
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1">
            <input 
              type="number" 
              min="0"
              max={Math.max(tp, 1)}
              value={localCp} 
              onChange={e => setLocalCp(e.target.value)}
              onBlur={commitCp}
              onKeyDown={e => e.key === 'Enter' && commitCp()}
              className="w-8 sm:w-10 px-0.5 sm:px-1 py-[1px] sm:py-0.5 text-center bg-white dark:bg-slate-800 border-none rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] sm:text-xs leading-none"
            />
            <span className="text-slate-400 hidden sm:block">/</span>
            <hr className="w-full border-t border-slate-300 dark:border-slate-600 sm:hidden my-[1px]" />
            <input 
              type="number" 
              min="1"
              value={localTp} 
              onChange={e => setLocalTp(e.target.value)}
              onBlur={commitTp}
              onKeyDown={e => e.key === 'Enter' && commitTp()}
              className="w-8 sm:w-10 px-0.5 sm:px-1 py-[1px] sm:py-0.5 text-center bg-white dark:bg-slate-800 border-none rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] sm:text-xs leading-none"
            />
          </div>
        </div>
      )}
      
      <div 
        className="cursor-pointer hover:opacity-80 transition-opacity p-0.5" 
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Hide tracking inputs" : `${cp}/${tp} completed`}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" className="rotate-[-90deg]">
          <circle cx="10" cy="10" r="8" fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="3" />
          <circle 
            cx="10" 
            cy="10" 
            r="8" 
            fill="none" 
            className="stroke-indigo-500" 
            strokeWidth="3" 
            strokeDasharray="50.26" 
            strokeDashoffset={offset} 
            strokeLinecap="round" 
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
      </div>
    </div>
  );
}

export default function Dashboard({ mocks, deletedMocks = [], profile, onDeleteMock, onEditMock, onRestoreMock, onPermanentlyDeleteMock, onUpdateReflection, onUpdateProfileTasks, showTasksModal: controlledShowTasksModal, setShowTasksModal: controlledSetShowTasksModal }: DashboardProps) {
  const [selectedExam, setSelectedExam] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [activeTrendId, setActiveTrendId] = useState<string>('overall');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);

  const lineChartRefInner = useRef<HTMLDivElement>(null);
  const barChartRefInner = useRef<HTMLDivElement>(null);
  const radarChartRefInner = useRef<HTMLDivElement>(null);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const [chartView, setChartView] = useState<'bar' | 'radar'>('bar');
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [localShowTasksModal, setLocalShowTasksModal] = useState(false);
  const showTasksModal = controlledShowTasksModal !== undefined ? controlledShowTasksModal : localShowTasksModal;
  const setShowTasksModal = controlledSetShowTasksModal || setLocalShowTasksModal;
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingGlobalTaskId, setEditingGlobalTaskId] = useState<string | null>(null);
  const [editGlobalTaskText, setEditGlobalTaskText] = useState('');
  const [activeActionsTaskId, setActiveActionsTaskId] = useState<string | null>(null);
  const [addingTaskToMockId, setAddingTaskToMockId] = useState<string | null>(null);
  const [newMockTaskText, setNewMockTaskText] = useState('');
  const [editingMockTaskId, setEditingMockTaskId] = useState<string | null>(null);
  const [editMockTaskText, setEditMockTaskText] = useState('');
  const [mockIdOfEditingTask, setMockIdOfEditingTask] = useState<string | null>(null);
  const [expandedActionMocks, setExpandedActionMocks] = useState<Record<string, boolean>>({});

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mock History');
    
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Exam', key: 'exam', width: 25 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Percentile', key: 'percentile', width: 12 },
      { header: 'Quant', key: 'quant', width: 10 },
      { header: 'Quant %ile', key: 'quant_percentile', width: 12 },
      { header: 'Reasoning', key: 'reasoning', width: 12 },
      { header: 'Reasoning %ile', key: 'reasoning_percentile', width: 14 },
      { header: 'English', key: 'english', width: 10 },
      { header: 'English %ile', key: 'english_percentile', width: 12 },
      { header: 'GA', key: 'ga', width: 10 },
      { header: 'GA %ile', key: 'ga_percentile', width: 10 },
      { header: 'Computer', key: 'computer', width: 10 },
      { header: 'Comp %ile', key: 'computer_percentile', width: 10 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600

    displayedMocks.forEach(mock => {
      const mockDate = parseLocalDate(mock.date);
      const row = sheet.addRow({
        date: mockDate.toLocaleDateString(),
        exam: mock.mockName || `${mock.examType} ${mock.examRole} ${mock.examPhase}`,
        platform: mock.platform,
        score: mock.score,
        percentile: mock.percentile,
        quant: mock.quant?.score ?? '-',
        quant_percentile: mock.quant?.percentile ?? '-',
        reasoning: mock.reasoning?.score ?? '-',
        reasoning_percentile: mock.reasoning?.percentile ?? '-',
        english: mock.english?.score ?? '-',
        english_percentile: mock.english?.percentile ?? '-',
        ga: mock.ga?.score ?? '-',
        ga_percentile: mock.ga?.percentile ?? '-',
        computer: mock.computer?.score ?? '-',
        computer_percentile: mock.computer?.percentile ?? '-',
      });

      // Color coding percentile
      const pCell = row.getCell('percentile');
      if (mock.percentile >= 95) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // emerald-500
      else if (mock.percentile >= 90) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34D399' } }; // emerald-400
      else if (mock.percentile >= 80) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // emerald-100

      // Optional: Add some standard colors to score cells if desired, keeping it simple for now
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    saveAs(new Blob([buffer]), `mock_history_${nowStr}.xlsx`);
  };

  const handleReflectionEditStart = (mock: MockScore) => {
    setActiveRowId(mock.id);
    setEditingReflectionId(mock.id);
  };

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
    return ['All', ...Array.from(types).sort()];
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

  const allGlobalPhases = useMemo(() => {
    const phases = Array.from(new Set(mocks.map(m => m.examPhase).filter(Boolean)));
    phases.sort((a, b) => {
      if (a === 'Prelims') return -1;
      if (b === 'Prelims') return 1;
      if (a === 'Mains') return -1;
      if (b === 'Mains') return 1;
      return mocks.findIndex(m => m.examPhase === a) - mocks.findIndex(m => m.examPhase === b);
    });
    return ['All', ...phases];
  }, [mocks]);

  const [goalPercentileStr, setGoalPercentileStr] = useState<string>(() => localStorage.getItem('goalPercentile') || '95');
  const [statsCountRange, setStatsCountRange] = useState<number | 'all'>('all');
  const [showPcntOptions, setShowPcntOptions] = useState(false);
  const [showAccOptions, setShowAccOptions] = useState(false);

  useEffect(() => {
    localStorage.setItem('goalPercentile', goalPercentileStr);
  }, [goalPercentileStr]);
  
  const goalPercentile = Number(goalPercentileStr) || 0;

  // filter
  const displayedMocks = useMemo(() => {
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
    // sort by date asc for charts
    return [...filtered].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [mocks, selectedExam, selectedRole, selectedPhase, selectedScope]);

  const activeTrendFilteredMocks = useMemo(() => {
    return displayedMocks.filter(m => {
      if (activeTrendId === 'overall') return true;
      if (activeTrendId === 'full') return (!m.examScope || m.examScope === 'Full');
      
      if (m.examScope === 'Sectional') {
          const nameLower = (m.mockName || '').toLowerCase();
          const isQuantName = nameLower.includes('quant') || nameLower.includes('math');
          const isEngName = nameLower.includes('english') || nameLower.includes('eng');
          const isReasName = nameLower.includes('reasoning') || nameLower.includes('lr') || nameLower.includes('logic');
          const isGaName = nameLower.includes('ga') || nameLower.includes('general') || nameLower.includes('gk') || nameLower.includes('awareness');

          if (activeTrendId === 'quant' && (isEngName || isReasName || isGaName) && !isQuantName) return false;
          if (activeTrendId === 'english' && (isQuantName || isReasName || isGaName) && !isEngName) return false;
          if (activeTrendId === 'reasoning' && (isQuantName || isEngName || isGaName) && !isReasName) return false;
          if (activeTrendId === 'ga' && (isQuantName || isEngName || isReasName) && !isGaName) return false;
      }

      const val = m[activeTrendId as keyof typeof m] as any;
      return val != null && ((val.percentile != null && val.percentile !== '') || (val.score != null && val.score !== ''));
    });
  }, [displayedMocks, activeTrendId]);

  const activeTrendFilteredChronologicalMocks = useMemo(() => {
    return [...activeTrendFilteredMocks].sort((a,b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [activeTrendFilteredMocks]);

  // Derive unique roles and scopes for the current selection
  const availableRoles = useMemo(() => {
    if (selectedExam === 'All') return [];
    const baseSelected = mocks.filter(m => m.examType === selectedExam);
    const roles = new Set(baseSelected.map(m => m.examRole).filter(Boolean));
    return roles.size > 0 ? ['All', ...Array.from(roles).sort()] : [];
  }, [mocks, selectedExam]);

  const availablePhases = useMemo(() => {
    if (selectedExam === 'All') return [];
    let baseSelected = mocks.filter(m => m.examType === selectedExam);
    if (selectedRole !== 'All') {
      baseSelected = baseSelected.filter(m => m.examRole === selectedRole);
    }
    const phases = new Set(baseSelected.map(m => m.examPhase).filter(Boolean));
    return phases.size > 0 ? ['All', ...Array.from(phases).sort()] : [];
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
    const scopes = new Set(baseSelected.map(m => m.examScope).filter(Boolean));
    return scopes.size > 0 ? ['All', ...Array.from(scopes).sort()] : [];
  }, [mocks, selectedExam, selectedRole, selectedPhase]);

  // Overview stats calculation
  const chronologicalMocks = useMemo(() => {
    return [...displayedMocks].sort((a,b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [displayedMocks]);

  const stats = useMemo(() => {
    if (displayedMocks.length === 0) return null;
    
    // Total tests shown in the view
    const totalTests = activeTrendFilteredMocks.length;

    // Filter properties based on active trend (Overall, Full, Quant, etc.)
    const getField = (m: any, fieldName: 'score' | 'percentile' | 'accuracy') => {
      if (activeTrendId === 'overall' || activeTrendId === 'full') {
        return m[fieldName];
      } else {
        return m[activeTrendId]?.[fieldName];
      }
    };

    // Depending on activeTrendId, pick the relevant mocks range (we need newest first)
    // activeTrendFilteredMocks is already filtered and is newest-first
    const targetMocksLength = statsCountRange === 'all' ? activeTrendFilteredMocks.length : statsCountRange;
    const lastN = activeTrendFilteredMocks.slice(0, targetMocksLength);
    
    const scores = lastN.map(m => getField(m, 'score')).filter(v => v != null && !isNaN(parseFloat(v as string))) as number[];
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(1) : '-';

    const percentiles = lastN.map(m => getField(m, 'percentile')).filter(v => v != null && !isNaN(parseFloat(v as string)) && v > 0) as number[];
    const avgPercentile = percentiles.length > 0 ? (percentiles.reduce((a, b) => a + Number(b), 0) / percentiles.length).toFixed(1) : '-';

    const accuracies = lastN.map(m => getField(m, 'accuracy')).filter(v => v != null && !isNaN(parseFloat(v as string)) && v > 0) as number[];
    const avgAccuracy = accuracies.length > 0 ? (accuracies.reduce((a, b) => a + Number(b), 0) / accuracies.length).toFixed(1) : '-';

    // For Radar chart - calculate average sectional percentiles off the last N generic mocks
    const targetDescLength = statsCountRange === 'all' ? displayedMocks.length : Math.max(statsCountRange as number, 5); 
    const recentDescending = displayedMocks.slice(0, targetDescLength);

    const quantMocks = recentDescending.filter(m => m.quant?.percentile != null && m.quant.percentile > 0);
    const avgQuantPercentile = quantMocks.length ? quantMocks.reduce((acc, m) => acc + m.quant!.percentile!, 0) / quantMocks.length : 0;

    const resMocks = recentDescending.filter(m => m.reasoning?.percentile != null && m.reasoning.percentile > 0);
    const avgReasoningPercentile = resMocks.length ? resMocks.reduce((acc, m) => acc + m.reasoning!.percentile!, 0) / resMocks.length : 0;

    const engMocks = recentDescending.filter(m => m.english?.percentile != null && m.english.percentile > 0);
    const avgEnglishPercentile = engMocks.length ? engMocks.reduce((acc, m) => acc + m.english!.percentile!, 0) / engMocks.length : 0;

    const gaMocks = recentDescending.filter(m => m.ga?.percentile != null && m.ga.percentile > 0);
    const avgGaPercentile = gaMocks.length ? gaMocks.reduce((acc, m) => acc + m.ga!.percentile!, 0) / gaMocks.length : 0;

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
      avgQuantPercentile, avgReasoningPercentile, avgEnglishPercentile, avgGaPercentile 
    };
  }, [displayedMocks, statsCountRange, activeTrendFilteredMocks, activeTrendId]);

  const chartData = useMemo(() => {
    const hasQuant = displayedMocks.some(m => m.quant?.score != null && m.quant.score !== 0);
    const hasReasoning = displayedMocks.some(m => m.reasoning?.score != null && m.reasoning.score !== 0);
    const hasEnglish = displayedMocks.some(m => m.english?.score != null && m.english.score !== 0);
    const hasGA = displayedMocks.some(m => m.ga?.score != null && m.ga.score !== 0);
    return { hasQuant, hasReasoning, hasEnglish, hasGA };
  }, [displayedMocks]);

  const chartDataReversed = useMemo(() => {
    return [...activeTrendFilteredChronologicalMocks].reverse().map(m => {
      const scores = [
        m.quant?.score || 0,
        m.reasoning?.score || 0,
        m.english?.score || 0,
        m.ga?.score || 0
      ];
      const maxSectionScore = Math.max(...scores, 0);
      return { ...m, maxSectionScore };
    });
  }, [activeTrendFilteredChronologicalMocks]);

  const flattenedData = useMemo(() => {
    const data: any[] = [];
    let index = 0;
    chartDataReversed.forEach((mock) => {
      const bars: any[] = [];
      if ((activeTrendId === 'overall' || activeTrendId === 'full' || activeTrendId === 'quant') && chartData.hasQuant && mock.quant?.score) bars.push({ ...mock, cellSub: 'Quant', cellScore: mock.quant.score, fill: '#3b82f6' });
      if ((activeTrendId === 'overall' || activeTrendId === 'full' || activeTrendId === 'reasoning') && chartData.hasReasoning && mock.reasoning?.score) bars.push({ ...mock, cellSub: 'Reasoning', cellScore: mock.reasoning.score, fill: '#8b5cf6' });
      if ((activeTrendId === 'overall' || activeTrendId === 'full' || activeTrendId === 'english') && chartData.hasEnglish && mock.english?.score) bars.push({ ...mock, cellSub: 'English', cellScore: mock.english.score, fill: '#f59e0b' });
      if ((activeTrendId === 'overall' || activeTrendId === 'full' || activeTrendId === 'ga') && chartData.hasGA && mock.ga?.score) bars.push({ ...mock, cellSub: 'GA', cellScore: mock.ga.score, fill: '#10b981' });
      
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
  }, [chartDataReversed, chartData]);

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const item = flattenedData[payload.value];
    if (!item || item.isGap || !item.isCenter) return null;
    
    const words = item.mockName.split(' '); 
    const name = words.length <= 3 ? item.mockName : words.slice(-3).join(' ');
    
    // Shift slightly to the right if even number of bars to be perfectly centered
    const dx = item.barCount % 2 === 0 ? 15 : 0; 

    return (
      <text x={x} y={y} dy={10} dx={dx} textAnchor="middle" fill="#64748b" fontSize={11}>
        {name}
      </text>
    );
  };

  if (mocks.length === 0 && deletedMocks.length === 0) {
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

  if (mocks.length === 0 && deletedMocks.length > 0 && !showRecycleBin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center relative">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
          <Target className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No mocks added yet</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">Click the "Add Mock" button above to upload a scorecard image and start tracking your progress.</p>
        
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Tabs */}
      {mocks.length > 0 && (
      <div className="flex overflow-x-auto mb-[6px] pb-[12px] gap-2 custom-scrollbar">
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
      )}

      {selectedExam !== 'All' && (availableRoles.length > 1 || availablePhases.length > 1 || availableScopes.length > 1) && (
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
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-indigo-500 relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer" onClick={() => setShowPcntOptions(!showPcntOptions)}>
              {showPcntOptions && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium animate-in slide-in-from-top-2 duration-200">
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange(5); setShowPcntOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 5 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>5</button>
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange(10); setShowPcntOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 10 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>10</button>
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange('all'); setShowPcntOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 'all' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>All</button>
                </div>
              )}
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-2 mt-1">
                <Trophy className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-medium text-xs sm:text-sm truncate">Avg Percentile</span>
              </div>
              <div className="text-3xl font-light text-slate-900 dark:text-slate-100 mb-2">{stats.avgPercentile}<span className="text-sm sm:text-lg text-slate-400 dark:text-slate-500 ml-1">%</span></div>
              <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden flex shadow-inner">
                <div className="bg-indigo-500 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, (Number(stats.avgPercentile) / goalPercentile) * 100 || 0))}%` }}></div>
              </div>
              <div className="flex justify-end w-full mt-1.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-0.5 group">
                  Goal: 
                  <input type="text" maxLength={3} value={goalPercentileStr} onChange={(e) => setGoalPercentileStr(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => !goalPercentileStr && setGoalPercentileStr('95')} className="w-6 text-right bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-[10px] leading-none mb-[2px] transition-colors hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer text-slate-600 dark:text-slate-300" />
                  %ile
                </div>
              </div>
            </div>

            {/* 3. Avg Accuracy */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer" onClick={() => setShowAccOptions(!showAccOptions)}>
              {showAccOptions && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium animate-in slide-in-from-top-2 duration-200">
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange(5); setShowAccOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 5 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>5</button>
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange(10); setShowAccOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 10 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>10</button>
                  <button onClick={(e) => { e.stopPropagation(); setStatsCountRange('all'); setShowAccOptions(false); }} className={`px-2 py-0.5 rounded-full transition-colors ${statsCountRange === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>All</button>
                </div>
              )}
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-2 mt-1">
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
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col min-h-[325px] sm:h-[325px] lg:col-span-2 relative mt-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-slate-400 dark:text-slate-500" /> Performance Trend
                  </h3>
                  <div className="w-24 sm:w-28 mt-1 sm:mt-0">
                    <CustomDropdown
                      value={selectedPhase}
                      options={selectedExam === 'All' ? allGlobalPhases : (availablePhases.length > 0 ? availablePhases.map(p => typeof p === 'string' ? p : p) : allGlobalPhases)}
                      onChange={(val) => setSelectedPhase(val)}
                      placeholder="Phase"
                      buttonClassName="px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50 border-transparent rounded-lg"
                      optionClassName="px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-row overflow-x-auto custom-scrollbar gap-1.5 sm:gap-2 pb-1 sm:pb-0 w-full sm:w-auto">
                  {['overall', 'full', 'quant', 'reasoning', 'english', 'ga'].map(key => (
                    <button 
                      key={key} 
                      onClick={() => setActiveTrendId(key)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${activeTrendId === key ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full mt-4 overflow-hidden relative min-h-[200px] sm:min-h-[250px]">
                <div className="absolute inset-0 h-full w-full" ref={lineChartRefInner}>
                  <ResponsiveContainer width="99%" height="100%">
                    <LineChart key={`line-${activeTrendId}`} data={activeTrendFilteredChronologicalMocks} margin={{ top: 5, right: 20, left: -20, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} height={40} tickFormatter={(val) => { const d = parseLocalDate(val); return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`; }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <RechartsTooltip content={<CustomTooltip chartRefBox={lineChartRefInner} activeTrendId={activeTrendId} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                    <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                    <Line connectNulls={true} type="monotone" dataKey={(m: any) => {
                        if (activeTrendId === 'overall' || activeTrendId === 'full') return m.percentile || m.score;
                        const v = m[activeTrendId];
                        if (!v) return null;
                        return v.percentile || v.score;
                    }} name={(activeTrendId === 'overall' || activeTrendId === 'full') ? 'Percentile/Score' : `${activeTrendId} %ile/Score`} stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </div>
            </div>
            
            {/* Chart: Sectional Scores */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col min-h-[325px] sm:h-[325px] lg:col-span-2">
              <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-6">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center text-sm sm:text-base whitespace-nowrap">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-slate-400 dark:text-slate-500" /> Sectional Breakdown
                 </h3>
                 <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                    <button 
                      onClick={() => setChartView('bar')} 
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'bar' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Bar
                    </button>
                    <button 
                      onClick={() => setChartView('radar')} 
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'radar' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Radar
                    </button>
                 </div>
              </div>
              <div className="flex-1 w-full relative flex flex-col overflow-hidden">
                {chartView === 'bar' ? (
                <>
                  <div className="w-full flex-1 overflow-x-auto overflow-y-hidden touch-pan-x touch-pan-y [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div style={{ height: '100%', minWidth: Math.max(flattenedData.length * 28, 400) }} ref={barChartRefInner}>
                      <ResponsiveContainer width="99%" height="100%">
                        <BarChart key={`bar-${activeTrendId}`} style={{ touchAction: 'pan-x' }} data={flattenedData} margin={{ top: 30, right: 20, left: -20, bottom: 5 }} barCategoryGap="0%">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                          <XAxis dataKey="flatIndex" axisLine={false} tickLine={false} interval={0} height={30} tick={renderCustomTick} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <RechartsTooltip content={<CustomTooltip chartRefBox={barChartRefInner} activeTrendId={activeTrendId} />} isAnimationActive={false} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                          
                          <Bar dataKey="cellScore" barSize={26} radius={[4, 4, 0, 0]}>
                            {flattenedData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.isGap ? 'transparent' : entry.fill} />
                            ))}
                            <LabelList dataKey="cellScore" position="top" content={(props: any) => {
                               const { x, y, width, value, payload } = props;
                               if (x == null || y == null || width == null || !value) return null;
                               const fill = payload?.fill || '#64748b';
                               return (
                                 <text x={x + width / 2} y={y - 5} fill={fill} fontSize={10} fontWeight={700} textAnchor="middle">
                                   {value > 0 ? value : ''}
                                 </text>
                               );
                            }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {/* Custom Legend to prevent scrolling and control order */}
                  <div className="flex flex-wrap justify-center gap-4 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                     {chartData.hasQuant && <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#3b82f6] rounded-sm"></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Quant</span></div>}
                     {chartData.hasReasoning && <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#8b5cf6] rounded-sm"></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Reasoning</span></div>}
                     {chartData.hasEnglish && <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#f59e0b] rounded-sm"></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400">English</span></div>}
                     {chartData.hasGA && <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#10b981] rounded-sm"></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400">GA</span></div>}
                  </div>
                </>
                ) : (
                <div className="w-full h-full relative min-h-[200px] sm:min-h-[250px]">
                <div className="absolute inset-0 w-full h-full" ref={radarChartRefInner}>
                <ResponsiveContainer width="99%" height="100%">
                  {(() => {
                    const radarData = [
                      ...(chartData.hasQuant ? [{ subject: 'Quant', value: Number(stats?.avgQuantPercentile || 0).toFixed(1), fullMark: 100, color: '#3b82f6' }] : []),
                      ...(chartData.hasReasoning ? [{ subject: 'Reasoning', value: Number(stats?.avgReasoningPercentile || 0).toFixed(1), fullMark: 100, color: '#8b5cf6' }] : []),
                      ...(chartData.hasEnglish ? [{ subject: 'English', value: Number(stats?.avgEnglishPercentile || 0).toFixed(1), fullMark: 100, color: '#f59e0b' }] : []),
                      ...(chartData.hasGA ? [{ subject: 'GA', value: Number(stats?.avgGaPercentile || 0).toFixed(1), fullMark: 100, color: '#10b981' }] : [])
                    ];
                    return (
                      <RadarChart key={`radar-${activeTrendId}`} cx="50%" cy="50%" outerRadius="65%" margin={{ top: 20, right: 30, bottom: 20, left: 30 }} data={radarData}>
                        <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                        <PolarAngleAxis dataKey="subject" tick={(props: any) => { 
                          const { payload, x, y, textAnchor } = props; 
                          const colorMap: any = { 'Quant': '#3b82f6', 'Reasoning': '#8b5cf6', 'English': '#f59e0b', 'GA': '#10b981' }; 
                          // Apply vertical offset based on position to avoid chart overlap
                          const dy = y < 150 ? -14 : 24;
                          return <text x={x} y={y} dy={dy} fill={colorMap[payload.value] || '#64748b'} fontSize={13} fontWeight={600} textAnchor={textAnchor}>{payload.value}</text>; 
                        }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={6} />
                        <Radar name="Percentile" dataKey="value" stroke="#ec4899" strokeWidth={2} fill="#ec4899" fillOpacity={0.3} dot={{ r: 3, fill: '#ec4899' }} activeDot={{ r: 5 }} label={(props: any) => { 
                          const { x, y, value, index } = props; 
                          // Push percentage labels slightly away from the center to avoid overlap with radar lines and subject labels
                          const dyVal = y < 150 ? 12 : -8;
                          return <text x={x} y={y} dy={dyVal} fill={radarData[index]?.color || "#ec4899"} fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>; 
                        }} />
                        <RechartsTooltip content={<CustomTooltip chartRefBox={radarChartRefInner} activeTrendId={activeTrendId} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                      </RadarChart>
                    );
                  })()}
                </ResponsiveContainer>
                </div>
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Smart Insights */}
          <div className="mt-8 mb-4 flex items-center gap-2">
            <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-100">Smart Insights</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Beta</span>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
             {(() => {
                if (chronologicalMocks.length < 2) {
                   return (
                      <div className="col-span-full p-6 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                         Take at least 2 mocks to generate insights.
                      </div>
                   )
                }

                const recentMocks = [...chronologicalMocks].reverse().slice(0, 5); // Last 5 mocks (newest first)
                
                // 1. Trend Analysis
                // We want to see if the newest mock is better than the oldest mock in this recent batch
                const recentPercentiles = recentMocks.filter(m => m.percentile != null && m.percentile > 0).map(m => m.percentile).reverse();
                const isImproving = recentPercentiles.length >= 2 && recentPercentiles[recentPercentiles.length - 1] >= recentPercentiles[0];
                const trendIcon = isImproving ? "📈" : "📉";

                // 2. Strongest / Weakest Sections by Percentile
                type SectionScore = { name: string, percentile: number };
                const secStats: Record<string, number[]> = { Quant: [], Reasoning: [], English: [], GA: [] };
                
                recentMocks.forEach(m => {
                   if (m.quant?.percentile) secStats.Quant.push(m.quant.percentile);
                   if (m.reasoning?.percentile) secStats.Reasoning.push(m.reasoning.percentile);
                   if (m.english?.percentile) secStats.English.push(m.english.percentile);
                   if (m.ga?.percentile) secStats.GA.push(m.ga.percentile);
                });

                const sectionAverages = Object.entries(secStats).map(([name, scores]) => ({
                   name,
                   avg: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
                })).filter(s => s.avg > 0).sort((a, b) => b.avg - a.avg);

                const strongest = sectionAverages.length > 0 ? sectionAverages[0] : null;
                const weakest = sectionAverages.length > 1 ? sectionAverages[sectionAverages.length - 1] : null;
                
                // 3. Last Attempt Activity
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastMockDate = parseLocalDate(recentMocks[0].date);
                lastMockDate.setHours(0, 0, 0, 0);
                
                const msSinceLast = today.getTime() - lastMockDate.getTime();
                const daysSinceLast = Math.max(0, Math.floor(msSinceLast / (1000 * 60 * 60 * 24)));
                const streakMessage = daysSinceLast === 0 ? "You took a mock today! 🔥" : daysSinceLast === 1 ? "You took a mock yesterday. Keep it up!" : `It's been ${daysSinceLast} days since your last mock.`;

                return (
                   <>
                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                         <div className="text-3xl mb-2">{trendIcon}</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Recent Trend (Last 5)</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
                            {isImproving ? "Your percentiles are trending up!" : "Your percentiles are trending down. Time to review!"}
                         </p>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors">
                         <div className="text-3xl mb-2">💪</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Strongest Section</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap">
                            {strongest ? `${strongest.name} (~${Math.round(strongest.avg)}%ile)` : "Need more data"}
                         </p>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-rose-300 dark:hover:border-rose-600 transition-colors">
                         <div className="text-3xl mb-2">🎯</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Area of Focus</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap">
                            {weakest ? `${weakest.name} (~${Math.round(weakest.avg)}%ile)` : "Need more data"}
                         </p>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-600 transition-colors">
                         <div className="text-3xl mb-2">{daysSinceLast <= 1 ? "🔥" : "⏳"}</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Consistency</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
                            {streakMessage}
                         </p>
                      </div>
                   </>
                );
             })()}
          </div>

        </>
      )}

      <div className="flex flex-wrap items-center mt-12 mb-6 gap-3 sm:gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 mr-2">
            {showRecycleBin ? 'Recycle Bin' : 'History Log'}
            {showRecycleBin && deletedMocks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">{deletedMocks.length}</span>
            )}
          </h3>

          <button
            onClick={() => setShowTasksModal(true)}
            className="px-3 py-1.5 border rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/60 relative shadow-sm"
            title="View Action Items"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Tasks
            {totalTasksCount > 0 && (
              <div className={`absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold border-2 border-white dark:border-slate-900 text-white shadow-sm px-1 ${pendingTasksCount === 0 ? 'bg-emerald-500' : pendingTasksCount >= 10 ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                {pendingTasksCount === 0 ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : pendingTasksCount}
              </div>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <button
            onClick={handleExportExcel}
            className="p-2 border rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            title="Download History as Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          
          {deletedMocks.length > 0 && (
            <button
              onClick={() => setShowRecycleBin(!showRecycleBin)}
              className={`p-2 border rounded-lg transition-colors flex items-center justify-center text-xs font-medium ${showRecycleBin ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
              title={showRecycleBin ? "Close Recycle Bin" : "Open Recycle Bin"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

          <div className="space-y-8">
            {(() => {
              const dataToRender = showRecycleBin ? deletedMocks : activeTrendFilteredMocks;
              if (dataToRender.length === 0) {
                 return (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                       <Trash2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                       <p className="text-slate-500 dark:text-slate-400 font-medium">No {showRecycleBin ? 'deleted mocks' : 'history'} found.</p>
                    </div>
                 );
              }
              const tableHeader = (
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('date')}>Time {getSortConfig('date')}</th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('examType')}>Exam {getSortConfig('examType')}</th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('mockName')}>Mock Name {getSortConfig('mockName')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('score')}>Score {getSortConfig('score')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('percentile')}>Percentile {getSortConfig('percentile')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('quant.score')}>Quant {getSortConfig('quant.score')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('reasoning.score')}>Reasoning {getSortConfig('reasoning.score')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('english.score')}>English {getSortConfig('english.score')}</th>
                    <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('ga.score')}>GA {getSortConfig('ga.score')}</th>
                    {(onDeleteMock || onEditMock || showRecycleBin) && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
              );

              const renderRow = (mock: any) => {
                const mockDate = parseLocalDate(mock.date);
                const formattedTime = mockDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const isTimeValid = !isNaN(mockDate.getTime()) && mock.date.includes('T');
                
                return (
                  <React.Fragment key={mock.id}>
                  <tr 
                    onClick={(e) => setActiveRowId(activeRowId === mock.id ? null : mock.id)}
                    className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group relative cursor-pointer ${activeRowId === mock.id ? 'bg-slate-50/80 dark:bg-slate-700/50' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap text-center align-middle w-[140px]">
                      <div className="flex flex-col items-center">
                        {isTimeValid ? <span className="text-[10px] uppercase font-semibold text-slate-400">{formattedTime}</span> : <span className="text-[10px] uppercase font-semibold text-slate-400">-</span>}
                        {mock.tags && mock.tags.length > 0 && (
                           <div className="flex flex-col gap-1 mt-1.5 w-full items-center">
                              {mock.tags.slice(0, 2).map((t: string) => (
                                 <span key={t} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded text-[9px] text-slate-600 dark:text-slate-300 font-sans truncate max-w-[120px] cursor-help" title={t}>#{t}</span>
                              ))}
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-center align-middle">
                       <div className="flex flex-col items-center gap-1">
                         <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold whitespace-nowrap">
                           {mock.examType}
                         </span>
                         {mock.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{mock.examRole}</span>}
                       </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 align-middle">
                      <div className="flex flex-col max-w-[140px] sm:max-w-none">
                         <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mb-1">
                           <span className="whitespace-nowrap shrink-0 max-w-[120px] sm:max-w-[250px] truncate">{mock.mockName}</span>
                         </div>
                         <div className="flex gap-1.5 mt-1 overflow-x-auto scrollbar-hide flex-nowrap md:flex-wrap pb-1">
                           {mock.platform && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">{getPlatformShort(mock.platform)}</span>}
                           {mock.examPhase && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{mock.examPhase}</span>}
                           {mock.examScope && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">{mock.examScope}</span>}
                         </div>
                       </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-blue-600 dark:text-blue-400 text-center align-middle whitespace-nowrap">
                      {mock.score != null && mock.score !== 0 ? mock.score : '-'}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        {mock.percentile != null && mock.percentile !== 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium whitespace-nowrap ${getHeatmapColor(mock.percentile)}`}>
                            {mock.percentile}%P
                          </span>
                        ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                        {mock.accuracy != null && mock.accuracy !== 0 && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium whitespace-nowrap ${getHeatmapColor(mock.accuracy)}`}>
                            {mock.accuracy}%A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{mock.quant?.score != null && mock.quant.score !== 0 ? mock.quant.score : '-'}</span>
                        <div className="flex flex-col gap-0.5 mt-1 items-center">
                          {mock.quant?.percentile != null && mock.quant.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.quant.percentile)}`}>{mock.quant.percentile}%P</span>}
                          {mock.quant?.accuracy != null && mock.quant.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.quant.accuracy)}`}>{mock.quant.accuracy}%A</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{mock.reasoning?.score != null && mock.reasoning.score !== 0 ? mock.reasoning.score : '-'}</span>
                        <div className="flex flex-col gap-0.5 mt-1 items-center">
                          {mock.reasoning?.percentile != null && mock.reasoning.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.reasoning.percentile)}`}>{mock.reasoning.percentile}%P</span>}
                          {mock.reasoning?.accuracy != null && mock.reasoning.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.reasoning.accuracy)}`}>{mock.reasoning.accuracy}%A</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                       <div className="flex flex-col items-center">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{mock.english?.score != null && mock.english.score !== 0 ? mock.english.score : '-'}</span>
                        <div className="flex flex-col gap-0.5 mt-1 items-center">
                          {mock.english?.percentile != null && mock.english.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.english.percentile)}`}>{mock.english.percentile}%P</span>}
                          {mock.english?.accuracy != null && mock.english.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.english.accuracy)}`}>{mock.english.accuracy}%A</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                       <div className="flex flex-col items-center">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{mock.ga?.score != null && mock.ga.score !== 0 ? mock.ga.score : '-'}</span>
                        <div className="flex flex-col gap-0.5 mt-1 items-center">
                          {mock.ga?.percentile != null && mock.ga.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.ga.percentile)}`}>{mock.ga.percentile}%P</span>}
                          {mock.ga?.accuracy != null && mock.ga.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(mock.ga.accuracy)}`}>{mock.ga.accuracy}%A</span>}
                        </div>
                      </div>
                    </td>
                    {(onDeleteMock || onEditMock || showRecycleBin) && (
                      <td className="pr-4 py-3 align-middle text-right w-[120px]">
                        <div className="flex items-center justify-end gap-3 text-right">
                          <div className={`flex items-center gap-1 transition-all ${activeRowId === mock.id ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'}`}>
                            {showRecycleBin ? (
                              <>
                                {onRestoreMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onRestoreMock(mock.id); }} className="p-1.5 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded transition-colors bg-white dark:bg-slate-800 shadow-sm" title="Restore Mock">
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {onPermanentlyDeleteMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onPermanentlyDeleteMock(mock.id); }} className="p-1.5 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/40 rounded transition-colors bg-white dark:bg-slate-800 shadow-sm" title="Permanently Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {onEditMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onEditMock(mock); }} className="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors bg-white dark:bg-slate-800 shadow-sm" title="Edit Mock">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteMock && (
                                  <button onClick={(e) => { e.stopPropagation(); onDeleteMock(mock.id); }} className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded transition-colors bg-white dark:bg-slate-800 shadow-sm" title="Move to Recycle Bin">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          {!showRecycleBin && onUpdateReflection && (
                            <button onClick={(e) => { e.stopPropagation(); handleReflectionEditStart(mock); }} className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors bg-indigo-50 dark:bg-indigo-900/20 shadow-sm" title="Edit Reflection">
                              <BookA className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                    {(activeRowId === mock.id && (mock.note || (mock.tags && mock.tags.length > 0) || mock.difficulty || mock.nervousness || mock.focus || mock.energy || mock.timeState || editingReflectionId === mock.id)) && (
                     <tr className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
                        <td colSpan={onDeleteMock || onEditMock ? 10 : 9} className="p-0">
                          <div className="sticky left-0 w-[calc(100vw-1.5rem)] max-w-full sm:w-auto sm:max-w-none px-4 sm:px-6 py-4">
                            <div className="flex flex-col gap-2 relative">
                               <div className="absolute left-[2px] sm:left-[-24px] top-0 bottom-0 w-1 bg-indigo-200 dark:bg-indigo-800 rounded-full"></div>
                               
                               {editingReflectionId === mock.id ? (
                                 <ReflectionEditor 
                                    mock={mock}
                                    onSave={async (id, data) => {
                                      if (onUpdateReflection) await onUpdateReflection(id, data);
                                      setEditingReflectionId(null);
                                    }}
                                    onCancel={() => setEditingReflectionId(null)}
                                 />
                               ) : (
                               <>
                                 {(mock.difficulty || mock.nervousness || mock.focus || mock.energy || mock.timeState || (mock.tags && mock.tags.length > 0)) && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
                                      {(mock.difficulty || mock.nervousness || mock.focus || mock.energy || mock.timeState) && (
                                        <div className="flex items-center gap-1 sm:gap-2">
                                          {mock.difficulty && (
                                            <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-purple-50 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded shadow-sm text-center sm:text-left">
                                              <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-purple-700 dark:text-purple-300 font-bold opacity-90 leading-tight">Difficulty</span>
                                              <span className="text-purple-900 dark:text-purple-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.difficulty}</span>
                                            </div>
                                          )}
                                          {mock.nervousness && (
                                            <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded shadow-sm text-center sm:text-left">
                                              <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold opacity-90 leading-tight">Nervous</span>
                                              <span className="text-amber-900 dark:text-amber-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.nervousness}</span>
                                            </div>
                                          )}
                                          {mock.focus && (
                                            <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded shadow-sm text-center sm:text-left">
                                              <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-blue-700 dark:text-blue-300 font-bold opacity-90 leading-tight">Focus</span>
                                              <span className="text-blue-900 dark:text-blue-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.focus}</span>
                                            </div>
                                          )}
                                          {mock.energy && (
                                            <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 rounded shadow-sm text-center sm:text-left">
                                              <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold opacity-90 leading-tight">Energy</span>
                                              <span className="text-emerald-900 dark:text-emerald-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.energy}</span>
                                            </div>
                                          )}
                                          {mock.timeState && (
                                            <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-orange-50 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 rounded shadow-sm text-center sm:text-left">
                                              <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-orange-700 dark:text-orange-300 font-bold opacity-90 leading-tight">Time</span>
                                              <span className="text-orange-900 dark:text-orange-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.timeState}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {mock.tags && mock.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {mock.tags.map((t: string) => <span key={t} className="shrink-0 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-300 text-[8px] sm:text-[10px] rounded font-medium uppercase tracking-wider flex items-center">#{t}</span>)}
                                        </div>
                                      )}
                                    </div>
                                 )}
                                 {mock.note && (
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm whitespace-pre-wrap">
                                       {mock.note}
                                    </p>
                                 )}
                                 {mock.tasks && mock.tasks.length > 0 && (
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action Items</span>
                                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                          {mock.tasks.filter(t => t.completed).length}/{mock.tasks.length} Completed
                                        </span>
                                      </div>
                                      <div className="space-y-1.5 pt-1">
                                        {mock.tasks.map(task => (
                                          <div key={task.id} className="flex items-start gap-2">
                                              <input 
                                                type="checkbox" 
                                                checked={task.completed} 
                                                readOnly 
                                                className="mt-0.5 w-3.5 h-3.5 text-indigo-600 rounded-sm border-slate-300 focus:ring-0 dark:border-slate-600 dark:bg-slate-800 mb-auto"
                                                style={{ opacity: task.completed ? 0.7 : 1 }}
                                              />
                                              <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {task.text}
                                              </span>
                                              <TaskProgressTracker 
                                                task={task} 
                                                onUpdateParts={async (cp, tp) => {
                                                  if (!onUpdateReflection) return;
                                                  const updatedTasks = mock.tasks?.map(t => {
                                                    if (t.id === task.id) {
                                                      const { completedParts: _cp, totalParts: _tp, ...rest } = t;
                                                      if (cp === undefined) return rest;
                                                      return { ...rest, completedParts: cp, totalParts: tp };
                                                    }
                                                    return t;
                                                  }) || [];
                                                  await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                }} 
                                              />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                 )}
                               </>
                             )}
                          </div>
                         </div>
                        </td>
                     </tr>
                  )}
                  </React.Fragment>
                );
              };

              let data = [...dataToRender].reverse();
              if (sortField && sortDirection) {
                // Sorting currently active, display in one list
                data.sort((a, b) => {
                  const getNestedVal = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
                  let valA = getNestedVal(a, sortField);
                  let valB = getNestedVal(b, sortField);
                  
                  if (valA == null) valA = '';
                  if (valB == null) valB = '';
                  
                  const numA = Number(valA);
                  const numB = Number(valB);
                  if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                    return sortDirection === 'desc' ? numB - numA : numA - numB;
                  }
                  
                  valA = String(valA).toLowerCase();
                  valB = String(valB).toLowerCase();
                  if (valA < valB) return sortDirection === 'desc' ? 1 : -1;
                  if (valA > valB) return sortDirection === 'desc' ? -1 : 1;
                  return 0;
                });

                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto text-sm">
                      <table className="w-full text-left whitespace-nowrap">
                        {tableHeader}
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {data.map(mock => renderRow(mock))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // Group by date
              const groups: { date: string, mocks: any[] }[] = [];
              data.forEach(mock => {
                const mockDate = parseLocalDate(mock.date);
                const dateString = mockDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                let group = groups.find(g => g.date === dateString);
                if (!group) {
                  group = { date: dateString, mocks: [] };
                  groups.push(group);
                }
                group.mocks.push(mock);
              });

              return groups.map((group) => (
                <div key={group.date} className="animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {group.date}
                  </h4>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto text-sm">
                      <table className="w-full text-left whitespace-nowrap">
                        {tableHeader}
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {group.mocks.map((mock: any) => renderRow(mock))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Heatmap Legend beneath History Log */}
          <div className="mt-8 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-800/50 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 justify-center">
            <span className="font-medium mr-2">Percentile Legend:</span>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500 ring-1 ring-emerald-600/20"></div> &ge;95%ile</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-500/20 dark:ring-emerald-500/50"></div> 90-95%ile</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/50 ring-1 ring-emerald-500/20 dark:ring-emerald-500/50"></div> 80-90%ile</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/50 ring-1 ring-amber-500/20 dark:ring-amber-500/50"></div> 70-80%ile</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-100 dark:bg-rose-900/50 ring-1 ring-rose-500/20 dark:ring-rose-500/50"></div> &lt;70%ile</div>
          </div>

          {/* Action Items Modal */}
          {showTasksModal && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white">Action Items</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Your pending tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className={`font-medium px-3 py-1.5 rounded-lg transition-colors text-[10px] sm:text-sm select-none flex items-center gap-2 ${
                        showCompletedTasks 
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70' 
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Completed
                    </button>
                    <button
                      onClick={() => setShowTasksModal(false)}
                      className="p-1.5 sm:p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg sm:rounded-xl transition-all hover:scale-105"
                      title="Close window"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-slate-50/30 dark:bg-slate-950/20 custom-scrollbar relative z-0">
                  {(() => {
                    const mocksWithTasks = mocks.filter(m => m.tasks && m.tasks.length > 0 && (showCompletedTasks || m.tasks.some(t => !t.completed)));
                    const globalTasks = (profile?.tasks || []).filter(t => showCompletedTasks || !t.completed);
                    
                    const handleAddGlobalTask = () => {
                        if (!newTaskText.trim() || !onUpdateProfileTasks || !profile) return;
                        const newTasks = [...(profile.tasks || []), { id: Math.random().toString(36).substr(2, 9), text: newTaskText.trim(), completed: false }];
                        onUpdateProfileTasks(newTasks);
                        setNewTaskText('');
                    };
                    const handleToggleGlobalTask = (taskId: string, completed: boolean) => {
                        if (!onUpdateProfileTasks || !profile) return;
                        const newTasks = (profile.tasks || []).map(t => t.id === taskId ? { ...t, completed } : t);
                        onUpdateProfileTasks(newTasks);
                    };
                    const handleDeleteGlobalTask = (taskId: string) => {
                        if (!onUpdateProfileTasks || !profile) return;
                        const newTasks = (profile.tasks || []).filter(t => t.id !== taskId);
                        onUpdateProfileTasks(newTasks);
                    };
                    const handleSaveGlobalTaskEdit = () => {
                        if (!onUpdateProfileTasks || !profile || !editingGlobalTaskId) return;
                        if (!editGlobalTaskText.trim()) { handleDeleteGlobalTask(editingGlobalTaskId); setEditingGlobalTaskId(null); return; }
                        const newTasks = (profile.tasks || []).map(t => t.id === editingGlobalTaskId ? { ...t, text: editGlobalTaskText.trim() } : t);
                        onUpdateProfileTasks(newTasks);
                        setEditingGlobalTaskId(null);
                    };
                    const handleUpdateGlobalTaskParts = (taskId: string, completedParts: number | undefined, totalParts: number | undefined) => {
                        if (!onUpdateProfileTasks || !profile) return;
                        const newTasks = (profile.tasks || []).map(t => {
                           if (t.id === taskId) {
                              const { completedParts: _cp, totalParts: _tp, ...rest } = t;
                              if (completedParts === undefined) return rest;
                              return { ...rest, completedParts, totalParts };
                           }
                           return t;
                        });
                        onUpdateProfileTasks(newTasks);
                    };

                    const caughtUp = mocksWithTasks.length === 0 && globalTasks.length === 0;

                    return (
                      <div className="space-y-6 flex flex-col h-full">
                        {/* Global Tasks section */}
                        <div className="flex flex-col gap-4 mb-4">
                           <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                             <input 
                               type="text" 
                               value={newTaskText} 
                               onChange={e => setNewTaskText(e.target.value)} 
                               onKeyDown={e => e.key === 'Enter' && handleAddGlobalTask()}
                               placeholder="Add a new general task..."
                               className="flex-1 px-4 py-3 bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 text-sm placeholder:text-slate-400"
                             />
                             <button onClick={handleAddGlobalTask} disabled={!newTaskText.trim()} className="px-5 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Add</button>
                           </div>
                           
                           {globalTasks.length > 0 && (
                             <div className="space-y-2">
                                {globalTasks.map(task => (
                                   <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="group flex items-start gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer">
                                      <button onClick={(e) => { e.stopPropagation(); handleToggleGlobalTask(task.id, !task.completed); }} className={`shrink-0 mt-0.5 rounded flex items-center justify-center w-5 h-5 transition-colors ${task.completed ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}>
                                        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                         {editingGlobalTaskId === task.id ? (
                                           <div className="flex flex-col gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                                              <input autoFocus type="text" value={editGlobalTaskText} onChange={e => setEditGlobalTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveGlobalTaskEdit()} className="w-full bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                              <div className="flex gap-2">
                                                 <button onClick={(e) => { e.stopPropagation(); handleSaveGlobalTaskEdit(); }} className="text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Save</button>
                                                 <button onClick={(e) => { e.stopPropagation(); setEditingGlobalTaskId(null); }} className="text-xs font-medium px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                                              </div>
                                           </div>
                                         ) : (
                                           <div className="flex items-start justify-between gap-3">
                                              <span className={`text-sm leading-relaxed select-none ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingGlobalTaskId(task.id); setEditGlobalTaskText(task.text); setActiveActionsTaskId(null); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                   <button onClick={(e) => { e.stopPropagation(); handleDeleteGlobalTask(task.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <TaskProgressTracker 
                                                  task={task} 
                                                  onUpdateParts={(cp, tp) => handleUpdateGlobalTaskParts(task.id, cp, tp)} 
                                                />
                                              </div>
                                           </div>
                                         )}
                                      </div>
                                   </div>
                                ))}
                             </div>
                           )}
                        </div>

                        {caughtUp ? (
                          <div className="flex flex-col items-center justify-center py-10 flex-1 text-center">
                            <motion.div 
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-slate-900 shadow-xl"
                            >
                              <CheckSquare className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                            </motion.div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">All Caught Up!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-base max-w-sm">
                              You don't have any pending action items. Great job staying on top of your mock reflections.
                            </p>
                          </div>
                        ) : (
                          <div>
                            {(() => {
                              // Group by date
                    const groupedByDate: Record<string, typeof mocksWithTasks> = {};
                    mocksWithTasks.forEach(mock => {
                      const dateStr = parseLocalDate(mock.date)?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || 'Unknown Date';
                      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
                      groupedByDate[dateStr].push(mock);
                    });

                    // Sort dates (we'll just use the first mock's natural date string to sort the keys)
                    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                       const dA = new Date(groupedByDate[a][0].date).getTime();
                       const dB = new Date(groupedByDate[b][0].date).getTime();
                       return dB - dA;
                    });
                    
                    return sortedDates.map(dateLabel => (
                      <div key={dateLabel} className="mb-6 last:mb-2">
                        <div className="flex items-center gap-4 mb-3 py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wider uppercase flex items-center gap-2">

                            <CalendarDays className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            {dateLabel}
                          </h3>
                          <div className="flex-1 border-b border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="space-y-4">
                          {groupedByDate[dateLabel].sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()).map(mock => {
                            const tasksToShow = mock.tasks?.filter(t => showCompletedTasks || !t.completed) || [];
                            if (tasksToShow.length === 0) return null;
                            
                            const isExpanded = expandedActionMocks[mock.id];
                            
                            return (
                              <div key={mock.id} className="bg-white dark:bg-slate-800 sm:rounded-2xl border-y sm:border-x border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all -mx-4 sm:mx-0">
                                <div 
                                  className="px-4 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/80 flex flex-col gap-2 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors group"
                                  onClick={() => setExpandedActionMocks(prev => ({ ...prev, [mock.id]: !prev[mock.id] }))}
                                >
                                  <div className="flex items-start sm:items-center justify-between">
                                    <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0 overflow-hidden sm:flex-wrap pt-0 pb-[2px]">
                                      <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[220px] sm:max-w-none text-lg leading-[24px]">
                                        {mock.mockName}
                                      </h4>
                                      
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 shrink-0">
                                        <div className="flex items-center gap-1">
                                          <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-700 px-1 sm:px-1.5 py-[2px] sm:py-0.5 rounded text-[6px] sm:text-[10px] leading-none uppercase tracking-wide">{mock.examType}</span>
                                          {mock.examRole && <span className="font-semibold text-[6px] sm:text-[10px] px-1 sm:px-1.5 py-[2px] sm:py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 leading-none tracking-wide">{mock.examRole}</span>}
                                        </div>
                                        {(mock.examPhase || mock.examScope) && (
                                          <div className="flex items-center gap-1">
                                            {mock.examPhase && <span className="font-semibold text-[6px] sm:text-[10px] px-1 sm:px-1.5 py-[2px] sm:py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 leading-none tracking-wide">{mock.examPhase}</span>}
                                            {mock.examScope && <span className="font-semibold text-[6px] sm:text-[10px] px-1 sm:px-1.5 py-[2px] sm:py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 leading-none tracking-wide">{mock.examScope}</span>}
                                          </div>
                                        )}
                                      </div>

                                      {isExpanded && mock.tags && mock.tags.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap border-l border-slate-200 dark:border-slate-700 pl-1.5 ml-0.5 sm:border-none sm:pl-0 sm:ml-0">
                                          {mock.tags.map((t: string) => (
                                            <span key={t} className="px-1 sm:px-1.5 py-[2px] sm:py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-[6px] sm:text-[10px] rounded font-bold uppercase tracking-wider flex items-center shrink-0 leading-none">#{t}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {isExpanded && <span className="font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md shadow-sm shrink-0 ml-2 hidden sm:inline-block">{getPlatformShort(mock.platform)}</span>}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setAddingTaskToMockId(addingTaskToMockId === mock.id ? null : mock.id); setNewMockTaskText(''); if (!isExpanded) setExpandedActionMocks(prev => ({ ...prev, [mock.id]: true })); }}
                                      className="p-1 sm:p-1.5 ml-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md transition-colors"
                                      title="Add Task for this Mock"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                  </div>
                                  {isExpanded && (mock.difficulty || mock.focus || mock.timeState || mock.energy || mock.nervousness) && (
                                    <div className="flex flex-nowrap items-center justify-start gap-1 sm:gap-2 w-full -mt-2 overflow-x-auto scrollbar-hide pb-[2px] leading-6">
                                      {mock.difficulty && (
                                        <div style={{ height: '13.0833px' }} className="flex items-center gap-[2px] sm:gap-1 px-1 sm:px-2 py-[2px] sm:py-1 bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50 rounded shadow-sm shrink-0 whitespace-nowrap">
                                          <span className="text-[6px] sm:text-[10px] uppercase tracking-wide text-purple-600 dark:text-purple-400 font-bold opacity-90 leading-none">Diff:</span>
                                          <span className="text-[6px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-100 leading-none">{mock.difficulty}</span>
                                        </div>
                                      )}
                                      {mock.nervousness && (
                                        <div style={{ height: '13.0833px' }} className="flex items-center gap-[2px] sm:gap-1 px-1 sm:px-2 py-[2px] sm:py-1 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 rounded shadow-sm shrink-0 whitespace-nowrap">
                                          <span className="text-[6px] sm:text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-bold opacity-90 leading-none">Nervous:</span>
                                          <span className="text-[6px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 leading-none">{mock.nervousness}</span>
                                        </div>
                                      )}
                                      {mock.focus && (
                                        <div style={{ height: '13.0833px' }} className="flex items-center gap-[2px] sm:gap-1 px-1 sm:px-2 py-[2px] sm:py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50 rounded shadow-sm shrink-0 whitespace-nowrap">
                                          <span className="text-[6px] sm:text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-bold opacity-90 leading-none">Focus:</span>
                                          <span className="text-[6px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-100 leading-none">{mock.focus}</span>
                                        </div>
                                      )}
                                      {mock.energy && (
                                        <div style={{ height: '13.0833px' }} className="flex items-center gap-[2px] sm:gap-1 px-1 sm:px-2 py-[2px] sm:py-1 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 rounded shadow-sm shrink-0 whitespace-nowrap">
                                          <span className="text-[6px] sm:text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-bold opacity-90 leading-none">Energy:</span>
                                          <span className="text-[6px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-100 leading-none">{mock.energy}</span>
                                        </div>
                                      )}
                                      {mock.timeState && (
                                        <div style={{ height: '13.0833px' }} className="flex items-center gap-[2px] sm:gap-1 px-1 sm:px-2 py-[2px] sm:py-1 bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800/50 rounded shadow-sm shrink-0 whitespace-nowrap">
                                          <span className="text-[6px] sm:text-[10px] uppercase tracking-wide text-orange-600 dark:text-orange-400 font-bold opacity-90 leading-none">Time:</span>
                                          <span className="text-[6px] sm:text-[10px] font-bold uppercase tracking-wider text-orange-900 dark:text-orange-100 leading-none">{mock.timeState}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="px-4 py-2.5 sm:p-4 -mt-1.5 sm:mt-0 space-y-2 bg-white dark:bg-slate-800">
                                  {tasksToShow.map((task) => (
                                    <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="flex items-start gap-2 group cursor-pointer p-1 -ml-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                      <input 
                                        type="checkbox" 
                                        checked={task.completed} 
                                        onChange={async (e) => {
                                          e.stopPropagation();
                                          if (onUpdateReflection) {
                                            const updatedTasks = mock.tasks?.map(t => t.id === task.id ? { ...t, completed: !task.completed } : t) || [];
                                            await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                          }
                                        }}
                                        className="mt-0.5 w-3.5 h-3.5 text-indigo-600 rounded-sm border-slate-300 focus:ring-0 dark:border-slate-600 dark:bg-slate-800 mb-auto cursor-pointer"
                                        style={{ opacity: task.completed ? 0.7 : 1 }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        {editingMockTaskId === task.id && mockIdOfEditingTask === mock.id ? (
                                           <div className="flex flex-col gap-2 w-full" onClick={e => e.stopPropagation()}>
                                              <input autoFocus type="text" value={editMockTaskText} onChange={e => setEditMockTaskText(e.target.value)} onKeyDown={async e => {
                                                if (e.key === 'Enter') {
                                                  if (!editMockTaskText.trim()) {
                                                      const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || [];
                                                      if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                  } else {
                                                      const updatedTasks = mock.tasks?.map(t => t.id === task.id ? { ...t, text: editMockTaskText.trim() } : t) || [];
                                                      if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                  }
                                                  setEditingMockTaskId(null);
                                                  setMockIdOfEditingTask(null);
                                                }
                                              }} className="w-full bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                              <div className="flex gap-2">
                                                 <button onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!editMockTaskText.trim()) {
                                                        const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || [];
                                                        if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                    } else {
                                                        const updatedTasks = mock.tasks?.map(t => t.id === task.id ? { ...t, text: editMockTaskText.trim() } : t) || [];
                                                        if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                    }
                                                    setEditingMockTaskId(null);
                                                    setMockIdOfEditingTask(null);
                                                 }} className="text-xs font-medium px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">Save</button>
                                                 <button onClick={(e) => { e.stopPropagation(); setEditingMockTaskId(null); setMockIdOfEditingTask(null); }} className="text-xs font-medium px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                                              </div>
                                           </div>
                                        ) : (
                                           <div className="flex items-start justify-between gap-2">
                                              <span className={`text-sm select-none ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {task.text}
                                              </span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingMockTaskId(task.id); setEditMockTaskText(task.text); setMockIdOfEditingTask(mock.id); setActiveActionsTaskId(null); }} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                                   <button onClick={async (e) => { e.stopPropagation(); if (onUpdateReflection) { const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || []; await onUpdateReflection(mock.id, { tasks: updatedTasks }); setActiveActionsTaskId(null); } }} className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <TaskProgressTracker 
                                                  task={task} 
                                                  onUpdateParts={async (cp, tp) => {
                                                    if (!onUpdateReflection) return;
                                                    const updatedTasks = mock.tasks?.map(t => {
                                                      if (t.id === task.id) {
                                                        const { completedParts: _cp, totalParts: _tp, ...rest } = t;
                                                        if (cp === undefined) return rest;
                                                        return { ...rest, completedParts: cp, totalParts: tp };
                                                      }
                                                      return t;
                                                    }) || [];
                                                    await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                  }} 
                                                />
                                              </div>
                                           </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {addingTaskToMockId === mock.id && (
                                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                      <input autoFocus type="text" value={newMockTaskText} onChange={e => setNewMockTaskText(e.target.value)} onKeyDown={async e => {
                                        if (e.key === 'Enter') {
                                          if (newMockTaskText.trim()) {
                                              const newTasks = [...(mock.tasks||[]), { id: Math.random().toString(36).substr(2, 9), text: newMockTaskText.trim(), completed: false }];
                                              if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: newTasks });
                                              setNewMockTaskText('');
                                          } else {
                                              setAddingTaskToMockId(null);
                                          }
                                        }
                                      }} placeholder="New task text..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                      <div className="flex gap-2">
                                        <button disabled={!newMockTaskText.trim()} onClick={async () => {
                                          if (newMockTaskText.trim()) {
                                              const newTasks = [...(mock.tasks||[]), { id: Math.random().toString(36).substr(2, 9), text: newMockTaskText.trim(), completed: false }];
                                              if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: newTasks });
                                              setNewMockTaskText('');
                                          }
                                        }} className="text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50">Add</button>
                                        <button onClick={() => setAddingTaskToMockId(null)} className="text-xs font-medium px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Done</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </motion.div>
    </div>, document.body)}
    </div>
  );
}
