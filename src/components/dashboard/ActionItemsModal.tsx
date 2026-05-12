import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { CheckSquare, X, Check, Edit2, Trash2, CalendarDays } from 'lucide-react';
import { MockScore, UserProfile, ReflectionTask } from '../../types';
import { getPlatformShort, parseLocalDate } from '../../lib/utils';
import { InlineTaskEditor } from './InlineTaskEditor';
import { TaskProgressDisk } from '../TasksTile';

interface ActionItemsModalProps {
   showTasksModal: boolean;
   setShowTasksModal: (show: boolean) => void;
   mocks: MockScore[];
   profile?: UserProfile;
   onUpdateProfileTasks?: (tasks: ReflectionTask[]) => Promise<void>;
   onUpdateReflection?: (id: string, updates: Partial<MockScore>) => Promise<void>;
}

export function ActionItemsModal({
   showTasksModal,
   setShowTasksModal,
   mocks,
   profile,
   onUpdateProfileTasks,
   onUpdateReflection
}: ActionItemsModalProps) {
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

  if (!showTasksModal) return null;

  return createPortal(
    
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
                    const globalTasks = (profile?.tasks || []).filter(t => showCompletedTasks || !t.completed).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                    
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
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
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
                              <div key={mock.id} className="bg-white dark:bg-slate-800 sm:rounded-2xl border-y sm:border-x border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow -mx-4 sm:mx-0">
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
                                           <div className="flex items-start justify-between gap-2">
                                              <span className={`text-sm select-none ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {task.text}
                                              </span>
                                              <div className="flex items-center">
                                                <div className={`flex items-center gap-1 transition-opacity shrink-0 ${activeActionsTaskId === task.id ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                                   <button onClick={(e) => { e.stopPropagation(); setEditingMockTaskId(task.id); setMockIdOfEditingTask(mock.id); setActiveActionsTaskId(null); }} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                                   <button onClick={async (e) => { e.stopPropagation(); if (onUpdateReflection) { const updatedTasks = mock.tasks?.filter(t => t.id !== task.id) || []; await onUpdateReflection(mock.id, { tasks: updatedTasks }); setActiveActionsTaskId(null); } }} className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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
    </div>, document.body)
}
