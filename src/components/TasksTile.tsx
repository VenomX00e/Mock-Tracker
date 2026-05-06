import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Check, Target } from 'lucide-react';

export function TaskProgressDisk({ 
  task, 
  onUpdateParts,
  variant = 'floating'
}: { 
  task: any, 
  onUpdateParts: (completedParts: number | undefined, totalParts: number | undefined) => void,
  variant?: 'inline' | 'floating'
}) {
  const hasTracker = task.totalParts !== undefined;
  const [isExpanded, setIsExpanded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const [localCp, setLocalCp] = useState<string>(task.completedParts !== undefined ? String(task.completedParts) : "0");
  const [localTp, setLocalTp] = useState<string>(task.totalParts !== undefined ? String(task.totalParts) : "10");

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const actualVariant = (variant === 'inline' && isMobile) ? 'floating' : variant;

  useEffect(() => {
    if (task.completedParts !== undefined) setLocalCp(String(task.completedParts));
    if (task.totalParts !== undefined) setLocalTp(String(task.totalParts));
  }, [task.completedParts, task.totalParts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        (!contentRef.current || !contentRef.current.contains(target))
      ) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isExpanded && popoverRef.current) {
      const updateCoords = () => {
        if (popoverRef.current) {
          const rect = popoverRef.current.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            setPopoverCoords({ top: 0, left: 0 });
            return;
          }
          setPopoverCoords({
            top: Math.max(0, rect.bottom + 4),
            left: Math.max(10, Math.min(rect.left - 50, window.innerWidth - 145)),
          });
        }
      };
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    } else {
      setPopoverCoords({ top: 0, left: 0 });
    }
  }, [isExpanded]);

  if (!hasTracker) {
    return (
      <button 
        ref={popoverRef as any}
        onClick={(e) => {
          e.stopPropagation();
          onUpdateParts(0, 10);
          setIsExpanded(true);
        }}
        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors ml-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
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

  const popoverContent = isExpanded ? (
    <div 
      ref={contentRef}
      className={actualVariant === 'floating' 
        ? "fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[9999] p-1.5 flex gap-1 items-center min-w-max transition-opacity duration-150"
        : "flex items-center gap-1 mr-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
      }
      style={actualVariant === 'floating' ? { top: popoverCoords.top, left: popoverCoords.left, opacity: popoverCoords.top === 0 ? 0 : 1, pointerEvents: popoverCoords.top === 0 ? 'none' : 'auto' } : {}}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 sm:gap-1">
        <input 
          type="number" 
          min="0"
          max={Math.max(tp, 1)}
          value={localCp} 
          onChange={e => setLocalCp(e.target.value)}
          onBlur={commitCp}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commitCp();
              setIsExpanded(false);
            }
          }}
          className={actualVariant === 'floating' 
            ? "w-10 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-900 border-none rounded focus:ring-1 focus:ring-indigo-500 font-mono text-[11px] leading-none text-slate-700 dark:text-slate-300"
            : "w-8 sm:w-10 px-0.5 sm:px-1 py-[1px] sm:py-0.5 text-center bg-transparent border-none rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] sm:text-xs leading-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800"
          }
          autoFocus={actualVariant === 'floating'}
        />
        <span className="text-slate-400 text-xs text-center hidden sm:block">/</span>
        <input 
          type="number" 
          min="1"
          value={localTp} 
          onChange={e => setLocalTp(e.target.value)}
          onBlur={commitTp}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commitTp();
              setIsExpanded(false);
            }
          }}
          className={actualVariant === 'floating'
            ? "w-10 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-900 border-none rounded focus:ring-1 focus:ring-indigo-500 font-mono text-[11px] leading-none text-slate-700 dark:text-slate-300"
            : "w-8 sm:w-10 px-0.5 sm:px-1 py-[1px] sm:py-0.5 text-center bg-transparent border-none rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] sm:text-xs leading-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800"
          }
        />
      </div>
      <button 
        onClick={() => {
          onUpdateParts(undefined, undefined);
          setIsExpanded(false);
        }}
        className={actualVariant === 'floating'
          ? "text-slate-400 hover:text-rose-500 transition-colors ml-1 w-6 h-6 flex items-center justify-center rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 shrink-0 text-sm font-bold"
          : "text-slate-400 hover:text-rose-500 transition-colors mx-1 w-5 h-5 flex items-center justify-center rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 shrink-0 text-sm font-bold"
        }
        title="Remove tracking"
      >
        &times;
      </button>
    </div>
  ) : null;

  return (
    <div className="relative inline-flex items-center shrink-0" ref={popoverRef}>
      {isExpanded && (actualVariant === 'floating' ? createPortal(popoverContent, document.body) : popoverContent)}

      <div 
        className="cursor-pointer hover:opacity-80 transition-opacity p-0.5" 
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        title={`${cp}/${tp} completed`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" className="rotate-[-90deg]">
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

export const TasksTile = ({ mocks, profileTasks = [], onUpdateReflection, onUpdateProfileTasks, onOpenTasks }: { mocks: any[], profileTasks?: any[], onUpdateReflection: (mockId: string, updates: any) => Promise<void>, onUpdateProfileTasks?: (tasks: any[]) => Promise<void>, onOpenTasks?: () => void }) => {
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());

  const displayTasks = mocks.reduce<{mockId: string, task: any, mockDate: string, mockName: string}[]>((acc, mock) => {
    if (mock.tasks && mock.tasks.length > 0) {
      mock.tasks.forEach((t: any) => {
        if (!t.completed || recentlyCompleted.has(t.id)) {
          acc.push({ mockId: mock.id, task: t, mockDate: mock.date || 'Unknown Date', mockName: mock.mockName || '' });
        }
      });
    }
    return acc;
  }, []);

  if (profileTasks && profileTasks.length > 0) {
    profileTasks.forEach((t: any) => {
      if (!t.completed || recentlyCompleted.has(t.id)) {
        let dateStr = new Date().toISOString().split('T')[0];
        if (t.createdAt) {
          dateStr = new Date(t.createdAt).toISOString().split('T')[0];
        }
        displayTasks.push({ mockId: 'general', task: t, mockDate: dateStr, mockName: 'General Tasks' });
      }
    });
  }

  const pendingCount = displayTasks.filter(item => !item.task.completed).length;

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Unknown Date' || !dateStr) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const groupedTasks: { date: string, tasks: typeof displayTasks }[] = [];
  displayTasks.forEach(item => {
    let group = groupedTasks.find(g => g.date === item.mockDate);
    if (!group) {
      group = { date: item.mockDate, tasks: [] };
      groupedTasks.push(group);
    }
    group.tasks.push(item);
  });

  groupedTasks.sort((a, b) => {
    if (a.date === 'Unknown Date') return 1;
    if (b.date === 'Unknown Date') return -1;
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const handleToggleTask = async (mockId: string, taskId: string, completed: boolean) => {
    if (completed) {
      setRecentlyCompleted(prev => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
      setTimeout(() => {
        setRecentlyCompleted(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }, 10000);
    } else {
      setRecentlyCompleted(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }

    if (mockId === 'general') {
      if (onUpdateProfileTasks && profileTasks) {
        const updatedTasks = profileTasks.map((t: any) => 
          t.id === taskId ? { ...t, completed } : t
        );
        await onUpdateProfileTasks(updatedTasks);
      }
      return;
    }

    const mockToUpdate = mocks.find(m => m.id === mockId);
    if (!mockToUpdate || !mockToUpdate.tasks) return;
    
    const updatedTasks = mockToUpdate.tasks.map((t: any) => 
      t.id === taskId ? { ...t, completed } : t
    );
    
    await onUpdateReflection(mockId, { tasks: updatedTasks });
  };

  const handleUpdateParts = async (mockId: string, taskId: string, completedParts: number | undefined, totalParts: number | undefined) => {
    if (mockId === 'general') {
      if (onUpdateProfileTasks && profileTasks) {
        const updatedTasks = profileTasks.map((t: any) => {
          if (t.id === taskId) {
            const { completedParts: _cp, totalParts: _tp, ...rest } = t;
            if (completedParts === undefined) return rest;
            return { ...rest, completedParts, totalParts };
          }
          return t;
        });
        await onUpdateProfileTasks(updatedTasks);
      }
      return;
    }

    const mockToUpdate = mocks.find(m => m.id === mockId);
    if (!mockToUpdate || !mockToUpdate.tasks) return;
    
    const updatedTasks = mockToUpdate.tasks.map((t: any) => {
      if (t.id === taskId) {
        const { completedParts: _cp, totalParts: _tp, ...rest } = t;
        if (completedParts === undefined) return rest;
        return { ...rest, completedParts, totalParts };
      }
      return t;
    });
    
    await onUpdateReflection(mockId, { tasks: updatedTasks });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/80 to-white dark:from-slate-800/80 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md flex flex-col h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
      
      <div 
        className="flex mt-0 -mb-[10px] cursor-pointer group hover:opacity-80 transition-opacity justify-between items-start relative z-10 shrink-0"
        onClick={onOpenTasks}
      >
        <div className="flex items-center gap-2">
           <CheckSquare className="w-5 h-5 text-indigo-500 shrink-0" />
           <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Pending Tasks</h3>
        </div>
        <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full ml-1 whitespace-nowrap shrink-0">
          {pendingCount} Pending
        </span>
      </div>
      
      <div className="mt-[14px] pt-0 border-t border-indigo-100 dark:border-indigo-900/30 flex-1 flex flex-col">
        <div className="flex-1 relative min-h-[110px]">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-1 z-10 pb-1 mt-1 mb-0">
            {groupedTasks.length > 0 ? groupedTasks.map(({date, tasks}, i) => (
              <div key={date} className="pb-0.5">
                <div className="flex items-center gap-1.5 opacity-70" style={{ marginTop: '-4px', marginBottom: '-4px' }}>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wider whitespace-nowrap">{formatDate(date)}</span>
                </div>
                <div className="flex flex-col">
                  {tasks.map(({mockId, task}) => (
                    <div key={`${mockId}-${task.id}`} className="flex items-start gap-2 group p-1 -ml-1 rounded-lg transition-colors">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(mockId, task.id, !task.completed);
                        }}
                        className={`mt-0.5 shrink-0 rounded flex items-center justify-center w-5 h-5 transition-colors ${task.completed ? 'bg-emerald-500 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <div className="flex-1 flex flex-wrap items-center">
                        <span className={`text-sm leading-snug break-words mr-0.5 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {task.text}
                        </span>
                        <TaskProgressDisk 
                          task={task} 
                          onUpdateParts={(cp, tp) => handleUpdateParts(mockId, task.id, cp, tp)} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-2 pt-1 border-transparent">No pending tasks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
