import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, X, Check, Edit2, Trash2, CalendarDays, ArrowLeft } from 'lucide-react';
import { MockScore, UserProfile, ReflectionTask } from '../types';
import { getPlatformShort, parseLocalDate } from '../lib/utils';
import { InlineTaskEditor } from './dashboard/InlineTaskEditor';
import { TaskProgressDisk } from './TasksTile';

import { useMocks } from '../hooks/useMocks';
import { useUserProfileCtx, useSystemDataCtx, useAppStateCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';

export function TasksPage() {
  const { profile } = useUserProfileCtx();
  const { mocks: rawMocks, updateMock } = useMocks();
  const { categories } = useSystemDataCtx();
  const { handleUpdateProfileTasks: onUpdateProfileTasks } = useAppStateCtx();
  const setActiveTab = useUIStore(state => state.setActiveTab);

  const activeCategory = (categories || []).find((c: any) => c.id === profile?.categoryId) || categories?.[0];
  const mocks = React.useMemo(() => {
    return rawMocks.filter(m => (m.categoryId || 'banking') === activeCategory?.id);
  }, [rawMocks, activeCategory]);

  const onUpdateReflection = async (id: string, updates: Partial<MockScore>) => {
    const mockToUpdate = rawMocks.find(m => m.id === id);
    if (mockToUpdate) await updateMock({ ...mockToUpdate, ...updates });
  };
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

  const hasAutoDeletedRef = useRef(false);

  useEffect(() => {
    if (hasAutoDeletedRef.current || !profile || !rawMocks.length) return;
    
    let hasDeletions = false;
    const now = Date.now();
    const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
    
    // Check global tasks
    if (profile.tasks && profile.tasks.length > 0) {
      let changed = false;
      const validTasks = profile.tasks.filter(task => {
        if (!task.completed) return true;
        let completedTime = 0;
        if (task.completedAt) completedTime = new Date(task.completedAt).getTime();
        else if (task.createdAt) completedTime = new Date(task.createdAt).getTime();
        
        if (completedTime && now - completedTime > FIFTEEN_DAYS_MS) {
           changed = true;
           return false;
        }
        return true;
      });
      if (changed && onUpdateProfileTasks) {
        onUpdateProfileTasks(validTasks);
        hasDeletions = true;
      }
    }
    
    // Check mock tasks
    rawMocks.forEach(mock => {
      if (!mock.tasks || !mock.tasks.length) return;
      let changed = false;
      const validTasks = mock.tasks.filter(task => {
        if (!task.completed) return true;
        let completedTime = 0;
        if (task.completedAt) completedTime = new Date(task.completedAt).getTime();
        else if (task.createdAt) completedTime = new Date(task.createdAt).getTime();
        else if (mock.date) completedTime = new Date(mock.date).getTime();
        
        if (completedTime && now - completedTime > FIFTEEN_DAYS_MS) {
           changed = true;
           return false;
        }
        return true;
      });
      
      if (changed) {
        onUpdateReflection(mock.id, { tasks: validTasks });
        hasDeletions = true;
      }
    });

    hasAutoDeletedRef.current = true;
  }, [profile, rawMocks, onUpdateProfileTasks]);

  const mocksWithTasks = useMemo(() => mocks.filter(m => m.tasks && m.tasks.length > 0 && (showCompletedTasks || m.tasks.some(t => !t.completed))), [mocks, showCompletedTasks]);
  const globalTasks = useMemo(() => (profile?.tasks || []).filter(t => showCompletedTasks || !t.completed).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [profile?.tasks, showCompletedTasks]);

  const { groupedByDate, sortedDates } = useMemo(() => {
    const grouped: Record<string, typeof mocksWithTasks> = {};
    mocksWithTasks.forEach(mock => {
      const dateStr = parseLocalDate(mock.date)?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || 'Unknown Date';
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(mock);
    });
    const sorted = Object.keys(grouped).sort((a, b) => {
      const dA = new Date(grouped[a][0].date).getTime();
      const dB = new Date(grouped[b][0].date).getTime();
      return dB - dA;
    });
    return { groupedByDate: grouped, sortedDates: sorted };
  }, [mocksWithTasks]);

  const handleAddGlobalTask = () => {
      if (!newTaskText.trim() || !onUpdateProfileTasks || !profile) return;
      const newTasks = [...(profile.tasks || []), { id: Math.random().toString(36).substr(2, 9), text: newTaskText.trim(), completed: false, createdAt: new Date().toISOString() }];
      onUpdateProfileTasks(newTasks);
      setNewTaskText('');
  };
  const handleToggleGlobalTask = (taskId: string, completed: boolean) => {
      if (!onUpdateProfileTasks || !profile) return;
      const newTasks = (profile.tasks || []).map(t => {
        if (t.id === taskId) {
           const updated = { ...t, completed };
           if (completed) updated.completedAt = new Date().toISOString();
           else delete updated.completedAt;
           return updated;
        }
        return t;
      });
      onUpdateProfileTasks(newTasks);
  };
  const handleDeleteGlobalTask = (taskId: string) => {
      if (!onUpdateProfileTasks || !profile) return;
      const newTasks = (profile.tasks || []).filter(t => t.id !== taskId);
      onUpdateProfileTasks(newTasks);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeActionsTaskId && !(e.target as Element).closest('.task-item')) {
        setActiveActionsTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionsTaskId]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setActiveTab('dashboard')} 
                      className="hidden md:block p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl transition-colors"
                      title="Back to Dashboard"
                    >
                      <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <div className="p-1.5 md:p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg md:rounded-xl">
                      <CheckSquare className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">Action Items</h2>
                      <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">Manage and track your tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className={`font-medium px-2 py-1 md:px-3 md:py-1.5 rounded-lg transition-colors text-[10px] md:text-sm select-none flex items-center gap-1 md:gap-2 ${
                        showCompletedTasks 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/70' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      Completed
                    </button>
                    {showCompletedTasks && (
                      <span className="text-[10px] text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 px-2 py-1.5 rounded">Auto deleted in 15 days</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-6 w-full">
                      <div className="space-y-8 flex flex-col h-full w-full">
                         {/* Global Tasks section */}
                        <div className="flex flex-col gap-4">
                           <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                             <input 
                               type="text" 
                               value={newTaskText} 
                               onChange={e => setNewTaskText(e.target.value)} 
                               onKeyDown={e => e.key === 'Enter' && handleAddGlobalTask()}
                               placeholder="Add a new general task..."
                               className="flex-1 px-3 py-2 md:px-4 md:py-3 bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 text-xs md:text-sm placeholder:text-slate-400"
                             />
                             <button onClick={handleAddGlobalTask} disabled={!newTaskText.trim()} className="px-3 py-2 md:px-5 md:py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-xs md:text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Add</button>
                           </div>
                           
                           {globalTasks.length > 0 && (
                             <div className="space-y-2">
                                {globalTasks.map(task => (
                                   <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="task-item group flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow transition-shadow cursor-pointer">
                                      <button onClick={(e) => { e.stopPropagation(); handleToggleGlobalTask(task.id, !task.completed); }} className={`shrink-0 mt-0.5 rounded flex items-center justify-center w-4 h-4 md:w-5 md:h-5 transition-colors ${task.completed ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}>
                                        {task.completed && <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                         {editingGlobalTaskId === task.id ? (
                                           <InlineTaskEditor 
                                             initialText={task.text}
                                             onSave={(newText) => {
                                               if (!newText.trim()) { handleDeleteGlobalTask(editingGlobalTaskId); setEditingGlobalTaskId(null); return; }
                                               if (onUpdateProfileTasks && profile) {
                                                 const newTasks = (profile.tasks || []).map(t => t.id === editingGlobalTaskId ? { ...t, text: newText.trim() } : t);
                                                 onUpdateProfileTasks(newTasks);
                                               }
                                               setEditingGlobalTaskId(null);
                                             }}
                                             onCancel={() => setEditingGlobalTaskId(null)}
                                           />
                                         ) : (
                                           <div className="flex items-start justify-between gap-2 md:gap-3">
                                              <span className={`text-xs md:text-sm leading-relaxed select-none ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-all shrink-0 overflow-hidden ${activeActionsTaskId === task.id ? 'opacity-100 w-auto ml-1 visible' : 'opacity-0 w-0 invisible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingGlobalTaskId(task.id); setActiveActionsTaskId(null); }} className="p-1 md:p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                                                   <button onClick={(e) => { e.stopPropagation(); handleDeleteGlobalTask(task.id); }} className="p-1 md:p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                                                   <TaskProgressDisk 
                                                     task={task} 
                                                     variant="inline"
                                                     onUpdateParts={(cp, tp) => handleUpdateGlobalTaskParts(task.id, cp, tp)} 
                                                   />
                                                </div>
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
                          <div className="flex flex-col items-center justify-center py-20 flex-1 text-center bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/20">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 border-4 border-white dark:border-emerald-900/20 shadow-xl">
                              <CheckSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">All Caught Up!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-base max-w-sm">
                              You don't have any pending action items. Great job staying on top of your mock reflections.
                            </p>
                          </div>
                        ) : (
                          <div>
                            {sortedDates.map(dateLabel => (
                              <div key={dateLabel} className="mb-8 last:mb-4">
                        <div className="flex items-center gap-4 mb-[10px]">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                            <CalendarDays className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            {dateLabel}
                          </h3>
                          <div className="flex-1 border-b border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="space-y-4">
                          {groupedByDate[dateLabel].sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()).map(mock => {
                            const tasksToShow = mock.tasks?.filter(t => showCompletedTasks || !t.completed) || [];
                            if (tasksToShow.length === 0) return null;
                            
                            const showTags = !!expandedActionMocks[mock.id];
                            
                            return (
                              <div key={mock.id} className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm hover:shadow transition-all group">
                                <div 
                                  className="px-5 py-[10px] border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2 transition-colors cursor-pointer"
                                  onClick={() => setExpandedActionMocks(prev => ({ ...prev, [mock.id]: !prev[mock.id] }))}
                                >
                                  <div className="flex items-start sm:items-center justify-between">
                                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 overflow-hidden sm:flex-wrap">
                                      <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[220px] sm:max-w-none text-base shrink-0">
                                        {mock.mockName}
                                      </h4>
                                      
                                      <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 shrink-0 mt-1 sm:mt-0 sm:items-center">
                                        <div className="flex items-center gap-0.5">
                                          <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-1 py-[2px] rounded flex items-center justify-center text-[7px] uppercase leading-none tracking-widest border border-slate-200 dark:border-slate-600 theme-exam-badge">{mock.examType}</span>
                                          {mock.examRole && <span className="font-bold text-[7px] px-1 py-[2px] flex items-center justify-center rounded uppercase bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 leading-none tracking-widest">{mock.examRole}</span>}
                                        </div>
                                        {(mock.examPhase || mock.examScope) && (
                                          <div className="flex items-center gap-0.5">
                                            {mock.examPhase && <span className="font-bold text-[7px] px-1 py-[2px] flex items-center justify-center rounded uppercase bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 leading-none tracking-widest">{mock.examPhase}</span>}
                                            {mock.examScope && <span className="font-bold text-[7px] px-1 py-[2px] flex items-center justify-center rounded uppercase bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 leading-none tracking-widest">{mock.examScope}</span>}
                                          </div>
                                        )}
                                      </div>

                                      {showTags && mock.tags && mock.tags.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap shrink mt-1 sm:mt-0 w-full sm:w-auto">
                                          {mock.tags.map((t: string) => (
                                            <span key={t} className="px-1 py-[2px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[8px] uppercase tracking-wider font-bold rounded shrink-0 leading-none">#{t}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setAddingTaskToMockId(addingTaskToMockId === mock.id ? null : mock.id); setNewMockTaskText(''); }}
                                      className="hidden sm:block p-1.5 ml-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors shrink-0"
                                      title="Add Task for this Mock"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                  </div>
                                  {showTags && (mock.difficulty || mock.nervousness || mock.focus || mock.energy || mock.timeState) && (
                                    <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible items-center gap-1 mt-0 shrink-0 self-start w-[calc(100%+40px)] sm:w-full -mx-5 px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0">
                                          {mock.difficulty && (
                                            <div className="flex flex-col justify-center px-1.5 py-[2px] bg-purple-50 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded shadow-sm shrink-0">
                                              <span className="text-[5px] uppercase tracking-widest text-purple-700 dark:text-purple-300 font-bold opacity-90 leading-tight">Difficulty</span>
                                              <span className="text-purple-900 dark:text-purple-100 text-[8px] font-bold uppercase tracking-wider leading-tight truncate">{mock.difficulty}</span>
                                            </div>
                                          )}
                                          {mock.nervousness && (
                                            <div className="flex flex-col justify-center px-1.5 py-[2px] bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded shadow-sm shrink-0">
                                              <span className="text-[5px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold opacity-90 leading-tight">Nervous</span>
                                              <span className="text-amber-900 dark:text-amber-100 text-[8px] font-bold uppercase tracking-wider leading-tight truncate">{mock.nervousness}</span>
                                            </div>
                                          )}
                                          {mock.focus && (
                                            <div className="flex flex-col justify-center px-1.5 py-[2px] bg-blue-50 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded shadow-sm shrink-0">
                                              <span className="text-[5px] uppercase tracking-widest text-blue-700 dark:text-blue-300 font-bold opacity-90 leading-tight">Focus</span>
                                              <span className="text-blue-900 dark:text-blue-100 text-[8px] font-bold uppercase tracking-wider leading-tight truncate">{mock.focus}</span>
                                            </div>
                                          )}
                                          {mock.energy && (
                                            <div className="flex flex-col justify-center px-1.5 py-[2px] bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 rounded shadow-sm shrink-0">
                                              <span className="text-[5px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold opacity-90 leading-tight">Energy</span>
                                              <span className="text-emerald-900 dark:text-emerald-100 text-[8px] font-bold uppercase tracking-wider leading-tight truncate">{mock.energy}</span>
                                            </div>
                                          )}
                                          {mock.timeState && (
                                            <div className="flex flex-col justify-center px-1.5 py-[2px] bg-orange-50 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 rounded shadow-sm shrink-0">
                                              <span className="text-[5px] uppercase tracking-widest text-orange-700 dark:text-orange-300 font-bold opacity-90 leading-tight">Time</span>
                                              <span className="text-orange-900 dark:text-orange-100 text-[8px] font-bold uppercase tracking-wider leading-tight truncate">{mock.timeState}</span>
                                            </div>
                                          )}
                                    </div>
                                  )}
                                </div>
                                <div className="px-4 sm:px-5 pr-[20px] pb-[10px] pt-[5px] transition-opacity duration-0 opacity-100 block">
                                  {tasksToShow.map((task) => (
                                    <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="task-item flex items-start gap-3 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (onUpdateReflection) {
                                            const updatedTasks = mock.tasks?.map(t => {
                                              if (t.id === task.id) {
                                                const updated = { ...t, completed: !task.completed };
                                                if (!task.completed) updated.completedAt = new Date().toISOString();
                                                else delete updated.completedAt;
                                                return updated;
                                              }
                                              return t;
                                            }) || [];
                                            await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                          }
                                        }}
                                        className={`shrink-0 mt-0.5 rounded flex items-center justify-center w-5 h-5 transition-colors ${task.completed ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                                      >
                                        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        {editingMockTaskId === task.id && mockIdOfEditingTask === mock.id ? (
                                           <InlineTaskEditor 
                                              initialText={task.text}
                                              onSave={async (newText) => {
                                                if (!newText.trim()) {
                                                    const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || [];
                                                    if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                } else {
                                                    const updatedTasks = mock.tasks?.map(t => t.id === task.id ? { ...t, text: newText.trim() } : t) || [];
                                                    if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: updatedTasks });
                                                }
                                                setEditingMockTaskId(null);
                                                setMockIdOfEditingTask(null);
                                              }}
                                              onCancel={() => {
                                                setEditingMockTaskId(null);
                                                setMockIdOfEditingTask(null);
                                              }}
                                           />
                                        ) : (
                                           <div className="flex items-start justify-between gap-3">
                                              <span className={`text-sm py-0.5 select-none ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {task.text}
                                              </span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-all shrink-0 overflow-hidden ${activeActionsTaskId === task.id ? 'opacity-100 w-auto ml-1 visible' : 'opacity-0 w-0 invisible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingMockTaskId(task.id); setMockIdOfEditingTask(mock.id); setActiveActionsTaskId(null); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 rounded-md transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                                   <button onClick={async (e) => { e.stopPropagation(); if (onUpdateReflection) { const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || []; await onUpdateReflection(mock.id, { tasks: updatedTasks }); setActiveActionsTaskId(null); } }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 rounded-md transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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
                                              </div>
                                           </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {addingTaskToMockId !== mock.id && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setAddingTaskToMockId(mock.id); setNewMockTaskText(''); }}
                                      className="sm:hidden flex items-center justify-center gap-2 mt-2 w-full py-2 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-semibold transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                      Add Task
                                    </button>
                                  )}
                                  {addingTaskToMockId === mock.id && (
                                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 pl-8">
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
                                      }} placeholder="New task..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                      <div className="flex gap-2">
                                        <button disabled={!newMockTaskText.trim()} onClick={async () => {
                                          if (newMockTaskText.trim()) {
                                              const newTasks = [...(mock.tasks||[]), { id: Math.random().toString(36).substr(2, 9), text: newMockTaskText.trim(), completed: false }];
                                              if (onUpdateReflection) await onUpdateReflection(mock.id, { tasks: newTasks });
                                              setNewMockTaskText('');
                                          }
                                        }} className="text-xs font-semibold px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">Add Task</button>
                                        <button onClick={() => setAddingTaskToMockId(null)} className="text-xs font-semibold px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Done</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
    </div>
  );
}
