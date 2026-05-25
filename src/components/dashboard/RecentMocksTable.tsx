import React, { useState } from 'react';
import { CheckSquare, Check, Download, History, Trash2, CalendarDays, RotateCcw, Edit2, BookA } from 'lucide-react';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../../lib/utils';
import { handleExportExcel } from '../../lib/exportUtils';
import { ReflectionEditor } from '../ReflectionEditor';
import { TaskProgressDisk } from '../TasksTile';

interface RecentMocksTableProps {
  showRecycleBin: boolean;
  setShowRecycleBin: (val: boolean) => void;
  activeTrendFilteredMocks: any[];
  deletedMocks: any[];
  subjects: any[];
  getSub: (m: any, id: string, subjects: any[]) => any;
  setActiveTab: (val: string) => void;
  totalTasksCount: number;
  pendingTasksCount: number;
  onDeleteMock?: (id: string) => void;
  onEditMock?: (mock: any) => void;
  onRestoreMock?: (id: string) => void;
  onPermanentlyDeleteMock?: (id: string) => void;
  onUpdateReflection?: (id: string, updates: any) => Promise<void>;
}

export const RecentMocksTable: React.FC<RecentMocksTableProps> = ({
  showRecycleBin,
  setShowRecycleBin,
  activeTrendFilteredMocks,
  deletedMocks,
  subjects,
  getSub,
  setActiveTab,
  totalTasksCount,
  pendingTasksCount,
  onDeleteMock,
  onEditMock,
  onRestoreMock,
  onPermanentlyDeleteMock,
  onUpdateReflection
}) => {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);

  const handleReflectionEditStart = (mock: any) => {
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

  const displayedMocks = showRecycleBin ? deletedMocks : activeTrendFilteredMocks;

  return (
    <>
      <div id="history-log" className="flex flex-wrap items-center mt-12 mb-6 gap-3 sm:gap-4 scroll-mt-24">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 mr-2">
            {showRecycleBin ? 'Recycle Bin' : 'History Log'}
            {showRecycleBin && deletedMocks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">{deletedMocks.length}</span>
            )}
          </h3>

          <button
            onClick={() => { setActiveTab('tasks'); window.scrollTo(0, 0); }}
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

          {showRecycleBin && (
            <span className="text-[10px] text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 px-2 py-1 rounded">Auto deleted in 15 days</span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <button
            onClick={() => handleExportExcel(displayedMocks, subjects, (m: any, id: string) => getSub(m, id, subjects))}
            className="p-2 border rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            title="Download History as Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          
          {deletedMocks.length > 0 && (
            <button
              onClick={() => setShowRecycleBin(!showRecycleBin)}
              className={`p-2 border rounded-lg transition-colors flex items-center justify-center text-xs font-medium ${showRecycleBin ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
              title={showRecycleBin ? "Close Recycle Bin" : "Open Recycle Bin"}
            >
              {showRecycleBin ? <History className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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
                onClick={() => setActiveRowId(activeRowId === mock.id ? null : mock.id)}
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
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent rounded-md text-xs font-semibold whitespace-nowrap theme-exam-badge">
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
                      <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-hide flex-nowrap pb-1 w-full max-w-full">
                        {mock.platform && <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">{getPlatformShort(mock.platform)}</span>}
                        {mock.examPhase && <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{mock.examPhase}</span>}
                        {mock.examScope && <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">{mock.examScope}</span>}
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
                  const sub = getSub(mock, s.id, subjects);
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
                      <div className="sticky left-0 w-[calc(100vw-30px)] sm:w-[calc(100vw-48px)] md:w-[calc(100vw-280px)] lg:w-[calc(100vw-300px)] xl:w-[calc(100vw-320px)] max-w-full px-4 sm:px-6 py-[10px] whitespace-normal">
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
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0 pb-0">
                                  {(mock.difficulty || mock.nervousness || mock.focus || mock.energy || mock.timeState) && (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      {mock.difficulty && (
                                        <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-1.5 py-0.5 sm:py-[2px] bg-purple-50 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded shadow-sm text-center sm:text-left">
                                          <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-purple-700 dark:text-purple-300 font-bold opacity-90 leading-tight">Difficulty</span>
                                          <span className="text-purple-900 dark:text-purple-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.difficulty}</span>
                                        </div>
                                      )}
                                      {mock.nervousness && (
                                        <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-1.5 py-0.5 sm:py-[2px] bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded shadow-sm text-center sm:text-left">
                                          <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold opacity-90 leading-tight">Nervous</span>
                                          <span className="text-amber-900 dark:text-amber-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.nervousness}</span>
                                        </div>
                                      )}
                                      {mock.focus && (
                                        <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-1.5 py-0.5 sm:py-[2px] bg-blue-50 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded shadow-sm text-center sm:text-left">
                                          <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-blue-700 dark:text-blue-300 font-bold opacity-90 leading-tight">Focus</span>
                                          <span className="text-blue-900 dark:text-blue-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.focus}</span>
                                        </div>
                                      )}
                                      {mock.energy && (
                                        <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-1.5 py-0.5 sm:py-[2px] bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 rounded shadow-sm text-center sm:text-left">
                                          <span className="text-[5px] sm:text-[7px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold opacity-90 leading-tight">Energy</span>
                                          <span className="text-emerald-900 dark:text-emerald-100 text-[6px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight truncate w-full">{mock.energy}</span>
                                        </div>
                                      )}
                                      {mock.timeState && (
                                        <div className="flex-1 sm:flex-none flex flex-col items-center sm:items-start justify-center px-1 sm:px-1.5 py-0.5 sm:py-[2px] bg-orange-50 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 rounded shadow-sm text-center sm:text-left">
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
                                      {mock.tasks.filter((t: any) => t.completed).length}/{mock.tasks.length} Completed
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pt-1">
                                    {mock.tasks.map((task: any) => (
                                      <div key={task.id} className="flex items-start gap-2 group">
                                          <div 
                                            className={`mt-0.5 shrink-0 rounded flex items-center justify-center transition-colors w-5 h-5 ${task.completed ? 'bg-emerald-500 border-none' : 'border-2 border-slate-300 dark:border-slate-600'}`}
                                            style={{ opacity: task.completed ? 0.7 : 1 }}
                                          >
                                            {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                                          </div>
                                          <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {task.text}
                                          </span>
                                          <TaskProgressDisk 
                                            task={task} 
                                            variant="inline"
                                            onUpdateParts={async (cp, tp) => {
                                              if (!onUpdateReflection) return;
                                              const updatedTasks = mock.tasks?.map((t: any) => {
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

          let data = showRecycleBin ? [...dataToRender] : [...dataToRender].reverse();
          if (sortField && sortDirection) {
            // Sorting currently active, display in one list
            data.sort((a, b) => {
              const getNestedVal = (obj: any, path: string) => {
                const parts = path.split('.');
                if (['score', 'percentile', 'accuracy'].includes(parts[1]) && parts.length === 2 && !['examType', 'mockName'].includes(parts[0])) {
                  const sub = getSub(obj, parts[0], subjects);
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
    </>
  );
};
