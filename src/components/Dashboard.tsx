import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { MockScore, UserProfile, ReflectionTask, ExamCategory } from '../types';
import { useUserProfileCtx, useSystemDataCtx, useAppStateCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';
import { useMocks } from '../hooks/useMocks';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine, LabelList, Cell, Label,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Trophy, TrendingUp, Target, CalendarDays, Calculator, Brain, BookA, ChevronRight, Trash2, Edit2, RotateCcw, Flame, Download, CheckSquare, X, Check } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { collection, query, orderBy, getDocs, writeBatch, collectionGroup, deleteField, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { ReflectionEditor } from './ReflectionEditor';

import { ActionItemsModal } from './dashboard/ActionItemsModal';
import { TaskProgressDisk } from './TasksTile';

import { PortalContent, CustomTooltip } from './dashboard/TooltipComponents';
import { InlineTaskEditor } from './dashboard/InlineTaskEditor';

const renderCustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined || value === '') return null;
  const scoreY = Math.max(y - 8, 16);
  return (
    <text x={x + width / 2} y={scoreY} className="fill-slate-700 dark:fill-slate-200" fontSize="11" fontWeight="bold" textAnchor="middle">{value}</text>
  );
};

export default function Dashboard() {
  const { profile } = useUserProfileCtx();
  const { mocks: rawMocks, deletedMocks: rawDeletedMocks = [], deleteMock, restoreDeletedMock, permanentlyDeleteMock, updateMock } = useMocks();
  const { categories } = useSystemDataCtx();
  const { setIsAddModalOpen, showTasksModal: controlledShowTasksModal, setShowTasksModal: controlledSetShowTasksModal, darkMode } = useUIStore();
  const { handleUpdateProfileTasks: onUpdateProfileTasks, setMockToEdit } = useAppStateCtx();

  const onDeleteMock = deleteMock;
  const onRestoreMock = restoreDeletedMock;
  const onPermanentlyDeleteMock = permanentlyDeleteMock;
  const onUpdateReflection = async (id: string, updates: Partial<MockScore>) => {
    const mockToUpdate = rawMocks.find(m => m.id === id);
    if (mockToUpdate) await updateMock({ ...mockToUpdate, ...updates });
  };
  const onEditMock = (mock: MockScore) => {
    setMockToEdit(mock);
    setIsAddModalOpen(true);
  };

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

  const getSub = (mock: any, id: string) => {
    if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(id)) return mock[id];
    if (mock.dynamicSubjects?.[id] != null) return mock.dynamicSubjects[id];
    
    const subj = subjects.find((s: any) => s.id === id);
    if (subj) {
       const n = subj.name.toLowerCase();
       const sh = (subj.short || '').toLowerCase();
       if (n.includes('quant') || sh === 'q') return mock.quant;
       if (n.includes('reason') || sh === 'r') return mock.reasoning;
       if (n.includes('english') || sh === 'e') return mock.english;
       if (n.includes('ga') || n.includes('general') || sh === 'ga') return mock.ga;
       if (n.includes('computer') || sh === 'c') return mock.computer;
    }
    return null;
  };

  const [selectedExam, setSelectedExam] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string>('All');
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
  

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mock History');
    
    const dynamicCols = subjects.flatMap((s: any) => [
      { header: s.name, key: `sub_${s.id}`, width: 12 },
      { header: `${s.name} %ile`, key: `sub_perc_${s.id}`, width: 14 }
    ]);
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Exam', key: 'exam', width: 25 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Percentile', key: 'percentile', width: 12 },
      ...dynamicCols
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600

    displayedMocks.forEach(mock => {
      const mockDate = parseLocalDate(mock.date);
      const rowData: any = {
        date: mockDate.toLocaleDateString(),
        exam: mock.mockName || `${mock.examType} ${mock.examRole} ${mock.examPhase}`,
        platform: mock.platform,
        score: mock.score,
        percentile: mock.percentile,
      };
      subjects.forEach((s: any) => {
        const sub = getSub(mock, s.id);
        rowData[`sub_${s.id}`] = sub?.score ?? '-';
        rowData[`sub_perc_${s.id}`] = sub?.percentile ?? '-';
      });
      const row = sheet.addRow(rowData);

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
    const types = new Set<string>(mocks.map(m => m.examType).filter((t): t is string => !!t));
    return ['All', ...Array.from<string>(types).sort()];
  }, [mocks]);

  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchRank = async () => {
      if (!profile?.userId) return;
      try {
        const q = query(collection(db, 'users'), orderBy('avgPercentile', 'desc'), limit(1000));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data() as UserProfile);
        
        const categoryId = activeCategory?.id || 'banking';

        users.forEach(u => {
           if (u.categoryStats) {
               const cs = u.categoryStats[categoryId]?.allTime;
               if (cs) {
                   u.avgPercentile = cs.avgPercentile || 0;
                   u.totalTests = cs.totalTests || 0;
                   u.avgAccuracy = cs.avgAccuracy || 0;
                   u.avgQuantPercentile = cs.avgQuantPercentile || 0;
                   u.avgReasoningPercentile = cs.avgReasoningPercentile || 0;
                   u.avgEnglishPercentile = cs.avgEnglishPercentile || 0;
                   u.avgGaPercentile = cs.avgGaPercentile || 0;
               } else {
                   u.avgPercentile = 0;
                   u.totalTests = 0;
                   u.avgAccuracy = 0;
                   u.avgQuantPercentile = 0;
                   u.avgReasoningPercentile = 0;
                   u.avgEnglishPercentile = 0;
                   u.avgGaPercentile = 0;
               }
           } else if (u.categoryId === categoryId || (!u.categoryId && categoryId === 'banking')) {
               // Keep global
           } else {
               u.avgPercentile = 0;
               u.totalTests = 0;
               u.avgAccuracy = 0;
               u.avgQuantPercentile = 0;
               u.avgReasoningPercentile = 0;
               u.avgEnglishPercentile = 0;
               u.avgGaPercentile = 0;
           }
        });

        users.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));
        
        let visibleUsers = users.filter((u) => !u.isBanned && !u.isMuted);
        
        visibleUsers = visibleUsers.filter(u => u.categoryId === categoryId || (!u.categoryId && categoryId === 'banking') || (u.categoryStats && u.categoryStats[categoryId] && u.categoryStats[categoryId].allTime.totalTests > 0));
        visibleUsers = visibleUsers.filter(u => u.totalTests > 0);

        // Deduplicate by email
        const emailMap = new Map<string, UserProfile>();
        const finalVisibleUsers: UserProfile[] = [];
        for (const u of visibleUsers) {
           if (u.email) {
               if (!emailMap.has(u.email)) {
                   emailMap.set(u.email, u);
               } else {
                   const existing = emailMap.get(u.email)!;
                   if ((u.totalTests || 0) > (existing.totalTests || 0)) {
                       emailMap.set(u.email, u);
                   }
               }
           } else {
               finalVisibleUsers.push(u);
           }
        }
        for (const u of emailMap.values()) {
            finalVisibleUsers.push(u);
        }
        
        finalVisibleUsers.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));

        const rank = finalVisibleUsers.findIndex(u => u.userId === profile.userId) + 1;
        if (rank > 0) {
          setLeaderboardRank(rank);
        } else {
          setLeaderboardRank(null);
        }
      } catch (e) {
        console.error("Error fetching rank", e);
      }
    };
    fetchRank();
  }, [profile?.userId, activeCategory?.id]);

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
  const [statsCountRange, setStatsCountRange] = useState<number | 'all'>('all');
  const [showPcntOptions, setShowPcntOptions] = useState(false);
  const [showAccOptions, setShowAccOptions] = useState(false);

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
    return displayedMocks.filter(m => {
      if (activeTrendId === 'overall') return true;
      if (activeTrendId === 'full') return (!m.examScope || m.examScope === 'Full');
      
      const val = getSub(m, activeTrendId);
      return val != null && ((val.percentile != null && val.percentile !== '') || (val.score != null && val.score !== ''));
    });
  }, [displayedMocks, activeTrendId]);

  const activeTrendFilteredChronologicalMocks = useMemo(() => {
    return [...activeTrendFilteredMocks].sort((a,b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [activeTrendFilteredMocks]);

  const averageTrendLineValue = useMemo(() => {
    let sum = 0;
    let count = 0;
    activeTrendFilteredChronologicalMocks.forEach(m => {
      let val = null;
      if (activeTrendId === 'overall' || activeTrendId === 'full') {
         val = m.percentile || m.score;
      } else {
         const v = getSub(m, activeTrendId);
         if (v) val = v.percentile || v.score;
      }
      if (val != null && val !== '') {
        sum += typeof val === 'string' ? parseFloat(val) : val;
        count++;
      }
    });
    return count > 0 ? Number((sum / count).toFixed(1)) : undefined;
  }, [activeTrendFilteredChronologicalMocks, activeTrendId]);

  const overallTrendAveragesData = useMemo(() => {
    if (activeTrendId !== 'overall') return { original: [], displayMap: {} };
    
    const avgs = [{ id: 'full', name: 'Full' }, ...subjects].map(s => {
      let sum = 0;
      let count = 0;
      activeTrendFilteredChronologicalMocks.forEach(m => {
        let val: any = null;
        if (s.id === 'full') {
          if (!m.examScope || m.examScope === 'Full') val = m.percentile || m.score;
        } else {
          const v = getSub(m, s.id);
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
  }, [activeTrendId, activeTrendFilteredChronologicalMocks, subjects]);

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
        return getSub(m, activeTrendId)?.[fieldName];
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
        const perc = getSub(m, s.id)?.percentile;
        return perc != null && perc > 0;
      });
      subjectAverages[s.id] = sMocks.length ? sMocks.reduce((acc, m) => acc + getSub(m, s.id)!.percentile!, 0) / sMocks.length : 0;
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
  }, [displayedMocks, statsCountRange, activeTrendFilteredMocks, activeTrendId, subjects, selectedTrendPeriod]);

  const chartDataReversed = useMemo(() => {
    return [...activeTrendFilteredChronologicalMocks].reverse().map(m => {
      const scores = subjects.map(s => getSub(m, s.id)?.score || 0);
      const maxSectionScore = Math.max(...scores, 0);
      return { ...m, maxSectionScore };
    });
  }, [activeTrendFilteredChronologicalMocks, subjects]);

  const flattenedData = useMemo(() => {
    const data: any[] = [];
    let index = 0;
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
    chartDataReversed.forEach((mock) => {
      const bars: any[] = [];
      subjects.forEach((s, sIdx) => {
        const score = getSub(mock, s.id)?.score;
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
  }, [chartDataReversed, activeTrendId, subjects]);

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
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 lg:mb-2 gap-3 lg:gap-4">
                <div className="flex items-start sm:items-center justify-between w-full lg:w-auto">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-start whitespace-nowrap tracking-tight">
                    <Trophy className="w-5 h-5 flex-shrink-0 mr-1.5 text-slate-400 dark:text-slate-500 mt-0.5" /> 
                    <div className="flex items-start whitespace-nowrap">
                      Performance Trend
                      <div className="-mt-1.5 ml-1">
                        <CustomDropdown
                          value={selectedTrendPeriod === 'All' ? 'All' : selectedTrendPeriod.replace(' Days', '')}
                          options={['All', '7', '30', 'Custom']}
                          onChange={(val) => {
                             if (val === 'Custom') setSelectedTrendPeriod('60');
                             else if (val === 'All') setSelectedTrendPeriod('All');
                             else setSelectedTrendPeriod(val + ' Days');
                          }}
                          placeholder="Days"
                          buttonClassName="px-0.5 py-0 text-[10.5px] font-bold text-indigo-500 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50 border-none rounded whitespace-nowrap leading-none shadow-none"
                          optionClassName="px-2 py-1 text-xs text-center"
                          hideArrow={true}
                          editable={!['All', '7 Days', '30 Days'].includes(selectedTrendPeriod)}
                        />
                      </div>
                    </div>
                  </h3>
                  <div className="flex items-center gap-2 mt-0 ml-2">
                    <div className="w-20 sm:w-28">
                      <CustomDropdown
                        value={selectedPhase}
                        options={selectedExam === 'All' || availablePhases.length === 0 ? allGlobalPhases : availablePhases}
                        onChange={(val) => setSelectedPhase(val)}
                        placeholder="Phase"
                        buttonClassName="px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs text-indigo-700 dark:text-indigo-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg whitespace-nowrap"
                        optionClassName="px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-row overflow-x-auto custom-scrollbar gap-1.5 sm:gap-2 pb-1 sm:pb-0 w-full lg:w-auto lg:flex-1 lg:justify-end">
                  {[{ id: 'overall', name: 'Overall' }, { id: 'full', name: 'Full' }, ...subjects].map((s) => {
                    const isActive = activeTrendId === s.id;
                    const getSubjectColor = (subjectId: string) => {
                      if (subjectId === 'overall') return '#6366f1';
                      if (subjectId === 'full') return '#ec4899';
                      const sIdx = subjects.findIndex(sub => sub.id === subjectId);
                      if (sIdx !== -1) {
                        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                        return colors[sIdx % colors.length];
                      }
                      return '#6366f1';
                    };
                    const color = getSubjectColor(s.id);
                    
                    return (
                      <button 
                        key={s.id} 
                        onClick={() => setActiveTrendId(s.id)}
                        style={{ 
                          backgroundColor: isActive ? `${color}20` : `${color}10`,
                          color: color,
                          borderColor: isActive ? `${color}` : `${color}30`,
                          opacity: isActive ? 1 : 0.65
                        }}
                        className={`text-xs px-2.5 py-1 border rounded-full font-medium transition-all whitespace-nowrap hover:opacity-100 ${isActive ? 'shadow-sm' : ''}`}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex-1 w-full mt-4 overflow-hidden relative min-h-[200px] sm:min-h-[250px]">
                <div className="absolute inset-0 h-full w-full" ref={lineChartRefInner}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart key={`line-${activeTrendId}`} data={activeTrendFilteredChronologicalMocks} margin={{ top: 5, right: 20, left: -20, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} height={40} tickFormatter={(val) => { const d = parseLocalDate(val); return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`; }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => {
                      if (activeTrendId === 'overall') {
                        for (const avg of overallTrendAveragesData.original) {
                          if (Math.abs(value - avg) <= 5) return '';
                        }
                      } else if (averageTrendLineValue !== undefined && Math.abs(value - averageTrendLineValue) <= 5) {
                        return '';
                      }
                      return String(Math.round(value));
                    }} />
                    <RechartsTooltip content={<CustomTooltip chartRefBox={lineChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={getSub} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                    {(averageTrendLineValue !== undefined && activeTrendId !== 'overall') && (
                      <ReferenceLine y={averageTrendLineValue} stroke="transparent">
                        <Label value={`${Math.round(averageTrendLineValue * 10) / 10}`} position="left" fill={(() => {
                          if (activeTrendId === 'full') return '#ec4899';
                          if (activeTrendId === 'overall') return '#6366f1';
                          const sIdx = subjects.findIndex(sub => sub.id === activeTrendId);
                          if (sIdx !== -1) {
                            return ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'][sIdx % 6];
                          }
                          return '#10b981';
                        })()} fontSize={12} fontWeight="bold" />
                      </ReferenceLine>
                    )}
                    {activeTrendId === 'overall' ? (
                      [{ id: 'full', name: 'Full' }, ...subjects].map((s) => {
                         const getSubjectColor = (subjectId: string) => {
                           if (subjectId === 'full') return '#ec4899';
                           const sIdx = subjects.findIndex(sub => sub.id === subjectId);
                           if (sIdx !== -1) {
                             const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                             return colors[sIdx % colors.length];
                           }
                           return '#6366f1';
                         };
                         const color = getSubjectColor(s.id);
                         
                         const avgData = overallTrendAveragesData.displayMap[s.id];

                         return (
                           <React.Fragment key={s.id}>
                             {avgData !== undefined && (
                               <ReferenceLine y={avgData.display} stroke="transparent">
                                 <Label value={`${Math.round(avgData.original * 10) / 10}`} position="left" fill={color} fontSize={12} fontWeight="bold" />
                               </ReferenceLine>
                             )}
                             <Line 
                               connectNulls={true} 
                               type="monotone" 
                               dataKey={(m: any) => {
                                 if (s.id === 'full') {
                                   if (m.examScope && m.examScope !== 'Full') return null;
                                   return m.percentile || m.score;
                                 }
                                 const v = getSub(m, s.id);
                                 if (!v) return null;
                                 return v.percentile || v.score;
                               }} 
                               name={`${s.name} %ile/Score`} 
                               stroke={color} 
                               strokeWidth={s.id === 'full' ? 3 : 2} 
                               dot={{ r: s.id === 'full' ? 4 : 3, strokeWidth: 2, fill: '#fff' }} 
                               activeDot={{ r: s.id === 'full' ? 6 : 5, strokeWidth: 0, fill: color }} 
                             />
                           </React.Fragment>
                         );
                      })
                    ) : (
                      <Line connectNulls={true} type="monotone" dataKey={(m: any) => {
                          if (activeTrendId === 'full') return m.percentile || m.score;
                          const v = getSub(m, activeTrendId);
                          if (!v) return null;
                          return v.percentile || v.score;
                      }} name={activeTrendId === 'full' ? 'Percentile/Score' : `${activeTrendId} %ile/Score`} stroke={(() => {
                          if (activeTrendId === 'full') return '#ec4899';
                          const sIdx = subjects.findIndex(sub => sub.id === activeTrendId);
                          if (sIdx !== -1) {
                            const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                            return colors[sIdx % colors.length];
                          }
                          return '#6366f1';
                      })()} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={(() => {
                           if (activeTrendId === 'full') return { r: 6, strokeWidth: 0, fill: '#ec4899' };
                           const sIdx = subjects.findIndex(sub => sub.id === activeTrendId);
                           const color = sIdx !== -1 ? ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'][sIdx % 6] : '#6366f1';
                           return { r: 6, strokeWidth: 0, fill: color };
                      })()} />
                    )}
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
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart key={`bar-${activeTrendId}`} style={{ touchAction: 'pan-x' }} data={flattenedData} margin={{ top: 30, right: 20, left: -20, bottom: 5 }} barCategoryGap="0%">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                          <XAxis dataKey="flatIndex" axisLine={false} tickLine={false} interval={0} height={30} tick={renderCustomTick} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <RechartsTooltip content={<CustomTooltip chartRefBox={barChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={getSub} />} isAnimationActive={false} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                          
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
                    {subjects.map((s: any, idx: number) => {
                       const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                       const hasSub = displayedMocks.some(m => getSub(m, s.id)?.score != null && getSub(m, s.id)?.score !== 0);
                       if (!hasSub) return null;
                       return (
                         <div key={s.id} className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }}></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400">{s.short || s.name}</span></div>
                       );
                    })}
                  </div>
                </>
                ) : (
                <div className="w-full h-full relative min-h-[200px] sm:min-h-[250px]">
                <div className="absolute inset-0 w-full h-full" ref={radarChartRefInner}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  {(() => {
                    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                    const radarData = subjects.filter((s: any) => displayedMocks.some(m => getSub(m, s.id)?.score != null && getSub(m, s.id)?.score !== 0)).map((s: any, idx: number) => ({
                      subject: s.short || s.name,
                      value: Number(stats?.subjectAverages?.[s.id] || 0).toFixed(1),
                      fullMark: 100,
                      color: colors[idx % colors.length]
                    }));
                    return (
                      <RadarChart key={`radar-${activeTrendId}`} cx="50%" cy="50%" outerRadius="65%" margin={{ top: 20, right: 30, bottom: 20, left: 30 }} data={radarData}>
                        <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                        <PolarAngleAxis dataKey="subject" tick={(props: any) => { 
                          const { payload, x, y, textAnchor, index } = props; 
                          // Apply vertical offset based on position to avoid chart overlap
                          const dy = y < 150 ? -14 : 24;
                          return <text x={x} y={y} dy={dy} fill={radarData[index]?.color || '#64748b'} fontSize={13} fontWeight={600} textAnchor={textAnchor}>{payload.value}</text>; 
                        }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={6} />
                        <Radar name="Percentile" dataKey="value" stroke="#ec4899" strokeWidth={2} fill="#ec4899" fillOpacity={0.3} dot={{ r: 3, fill: '#ec4899' }} activeDot={{ r: 5 }} label={(props: any) => { 
                          const { x, y, value, index } = props; 
                          // Push percentage labels slightly away from the center to avoid overlap with radar lines and subject labels
                          const dyVal = y < 150 ? 12 : -8;
                          return <text x={x} y={y} dy={dyVal} fill={radarData[index]?.color || "#ec4899"} fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>; 
                        }} />
                        <RechartsTooltip content={<CustomTooltip chartRefBox={radarChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={getSub} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
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
                const secStats: Record<string, number[]> = {};
                subjects.forEach((s: any) => secStats[s.id] = []);
                
                recentMocks.forEach(m => {
                   subjects.forEach((s: any) => {
                     const perc = getSub(m, s.id)?.percentile;
                     if (perc != null && perc > 0) secStats[s.id].push(perc);
                   });
                });

                const sectionAverages = Object.entries(secStats).map(([id, scores]) => {
                   const subj = subjects.find((s: any) => s.id === id);
                   return {
                     name: subj?.name || id,
                     avg: scores.length > 0 ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0
                   };
                }).filter(s => s.avg > 0).sort((a, b) => b.avg - a.avg);

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

                let taskCardBg = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
                let taskHeaderColor = "text-emerald-700 dark:text-emerald-400";
                let taskIcon = "🎉";
                let taskMessage = "Wow, 0 pending tasks! You actually did your job. Keep it that way.";

                if (pendingTasksCount > 8) {
                    taskCardBg = "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600";
                    taskHeaderColor = "text-red-700 dark:text-red-400";
                    taskIcon = "🚨";
                    taskMessage = `Stop procrastinating! You have ${pendingTasksCount} pending tasks piling up. Get them done now!`;
                } else if (pendingTasksCount >= 5) {
                    taskCardBg = "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600";
                    taskHeaderColor = "text-amber-700 dark:text-amber-400";
                    taskIcon = "⚠️";
                    taskMessage = `You have ${pendingTasksCount} pending tasks. They are piling up, start clearing them soon.`;
                } else if (pendingTasksCount > 0) {
                    taskCardBg = "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600";
                    taskHeaderColor = "text-blue-700 dark:text-blue-400";
                    taskIcon = "📝";
                    taskMessage = `You have ${pendingTasksCount} pending tasks. Try to complete them when you can.`;
                }

                return (
                   <>
                      <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-colors ${taskCardBg}`}>
                         <div className="text-3xl mb-2">{taskIcon}</div>
                         <h4 className={`text-sm font-semibold ${taskHeaderColor}`}>Action Required</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
                            {taskMessage}
                         </p>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                         <div className="text-3xl mb-2">{trendIcon}</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Recent Trend (Last 5)</h4>
                         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
                            {isImproving ? "Your percentiles are trending up!" : "Your percentiles are trending down. Time to review!"}
                         </p>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-fuchsia-300 dark:hover:border-fuchsia-600 transition-colors">
                         <div className="text-3xl mb-2">⚖️</div>
                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Section Balance</h4>
                         <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-medium truncate">
                             <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">💪 Best:</span> {strongest ? `${strongest.name} (~${Math.round(strongest.avg)}%ile)` : "N/A"}</div>
                             <div className="mt-1"><span className="font-semibold text-rose-600 dark:text-rose-400">🎯 Focus:</span> {weakest ? `${weakest.name} (~${Math.round(weakest.avg)}%ile)` : "N/A"}</div>
                         </div>
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
                    {subjects.map((s: any) => (
                      <th key={s.id} className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort(`${s.id}.score`)}>{s.name} {getSortConfig(`${s.id}.score`)}</th>
                    ))}
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
                    {subjects.map((s: any) => {
                      const sub = getSub(mock, s.id);
                      return (
                        <td key={s.id} className="px-4 py-3 text-center align-middle">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-slate-600 dark:text-slate-300">{sub?.score != null && sub.score !== 0 ? sub.score : '-'}</span>
                            <div className="flex flex-col gap-0.5 mt-1 items-center">
                              {sub?.percentile != null && sub.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(sub.percentile)}`}>{sub.percentile}%P</span>}
                              {sub?.accuracy != null && sub.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded whitespace-nowrap ${getHeatmapColor(sub.accuracy)}`}>{sub.accuracy}%A</span>}
                            </div>
                          </div>
                        </td>
                      );
                    })}
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
                                          <div key={task.id} className="flex items-start gap-2 group">
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
                                              <TaskProgressDisk 
                                                task={task} 
                                                variant="inline"
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
                  const getNestedVal = (obj: any, path: string) => {
                    const parts = path.split('.');
                    if (['score', 'percentile', 'accuracy'].includes(parts[1]) && parts.length === 2 && !['examType', 'mockName'].includes(parts[0])) {
                      const sub = getSub(obj, parts[0]);
                      return sub ? sub[parts[1]] : null;
                    }
                    return parts.reduce((acc, part) => acc && acc[part], obj);
                  };
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
          <ActionItemsModal 
            showTasksModal={showTasksModal}
            setShowTasksModal={setShowTasksModal}
            mocks={mocks}
            profile={profile}
            onUpdateProfileTasks={onUpdateProfileTasks}
            onUpdateReflection={onUpdateReflection}
          />
    </div>
  );
}


