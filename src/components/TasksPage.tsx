import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
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
      const newTasks = (profile.tasks || []).map(t => t.id === taskId ? { ...t, completed } : t);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="w-full space-y-6"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setActiveTab('dashboard')} 
                      className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl transition-colors"
                      title="Back to Dashboard"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white">Action Items</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Manage and track your tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className={`font-medium px-3 py-1.5 rounded-lg transition-colors text-xs sm:text-sm select-none flex items-center gap-2 ${
                        showCompletedTasks 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/70' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      Completed
                    </button>
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
                               className="flex-1 px-4 py-3 bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 text-sm placeholder:text-slate-400"
                             />
                             <button onClick={handleAddGlobalTask} disabled={!newTaskText.trim()} className="px-5 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Add</button>
                           </div>
                           
                           {globalTasks.length > 0 && (
                             <div className="space-y-2">
                                {globalTasks.map(task => (
                                   <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="group flex items-start gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow transition-shadow cursor-pointer">
                                      <button onClick={(e) => { e.stopPropagation(); handleToggleGlobalTask(task.id, !task.completed); }} className={`shrink-0 mt-0.5 rounded flex items-center justify-center w-5 h-5 transition-colors ${task.completed ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}>
                                        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
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
                                           <div className="flex items-start justify-between gap-3">
                                              <span className={`text-sm leading-relaxed select-none ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 md:group-hover:opacity-100 md:invisible md:group-hover:visible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingGlobalTaskId(task.id); setActiveActionsTaskId(null); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                   <button onClick={(e) => { e.stopPropagation(); handleDeleteGlobalTask(task.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <TaskProgressDisk 
                                                  task={task} 
                                                  variant="inline"
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
                          <div className="flex flex-col items-center justify-center py-20 flex-1 text-center bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/20">
                            <motion.div 
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 border-4 border-white dark:border-emerald-900/20 shadow-xl"
                            >
                              <CheckSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                            </motion.div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">All Caught Up!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-base max-w-sm">
                              You don't have any pending action items. Great job staying on top of your mock reflections.
                            </p>
                          </div>
                        ) : (
                          <div>
                            {sortedDates.map(dateLabel => (
                              <div key={dateLabel} className="mb-8 last:mb-4">
                        <div className="flex items-center gap-4 mb-4">
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
                            
                            const isExpanded = expandedActionMocks[mock.id] !== false; // Default expanded instead of collapsed? No wait, let's keep it based on expandedActionMocks
                            
                            return (
                              <div key={mock.id} className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm hover:shadow transition-all group">
                                <div 
                                  className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2 cursor-pointer transition-colors"
                                  onClick={() => setExpandedActionMocks(prev => ({ ...prev, [mock.id]: !prev[mock.id] }))}
                                >
                                  <div className="flex items-start sm:items-center justify-between">
                                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 overflow-hidden sm:flex-wrap">
                                      <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[220px] sm:max-w-none text-base">
                                        {mock.mockName}
                                      </h4>
                                      
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-md text-[10px] leading-none uppercase tracking-wide border border-slate-200 dark:border-slate-600">{mock.examType}</span>
                                          {mock.examRole && <span className="font-semibold text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 leading-none tracking-wide">{mock.examRole}</span>}
                                        </div>
                                        {(mock.examPhase || mock.examScope) && (
                                          <div className="flex items-center gap-1.5">
                                            {mock.examPhase && <span className="font-semibold text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 leading-none tracking-wide">{mock.examPhase}</span>}
                                            {mock.examScope && <span className="font-semibold text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 leading-none tracking-wide">{mock.examScope}</span>}
                                          </div>
                                        )}
                                      </div>

                                      {isExpanded && mock.tags && mock.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap pl-2 border-l border-slate-200 dark:border-slate-700">
                                          {mock.tags.map((t: string) => (
                                            <span key={t} className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded shrink-0 leading-none">#{t}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setAddingTaskToMockId(addingTaskToMockId === mock.id ? null : mock.id); setNewMockTaskText(''); if (!isExpanded) setExpandedActionMocks(prev => ({ ...prev, [mock.id]: true })); }}
                                      className="p-1.5 ml-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
                                      title="Add Task for this Mock"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                  </div>
                                </div>
                                <div className={`px-4 sm:px-5 pb-5 pt-3 transition-opacity duration-0 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                                  {tasksToShow.map((task) => (
                                    <div key={task.id} onClick={() => setActiveActionsTaskId(activeActionsTaskId === task.id ? null : task.id)} className="flex items-start gap-3 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (onUpdateReflection) {
                                            const updatedTasks = mock.tasks?.map(t => t.id === task.id ? { ...t, completed: !task.completed } : t) || [];
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
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 md:group-hover:opacity-100 md:invisible md:group-hover:visible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingMockTaskId(task.id); setMockIdOfEditingTask(mock.id); setActiveActionsTaskId(null); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 rounded-md transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                                   <button onClick={async (e) => { e.stopPropagation(); if (onUpdateReflection) { const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || []; await onUpdateReflection(mock.id, { tasks: updatedTasks }); setActiveActionsTaskId(null); } }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 rounded-md transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
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
                                        )}
                                      </div>
                                    </div>
                                  ))}
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
    </motion.div>
  );
}
