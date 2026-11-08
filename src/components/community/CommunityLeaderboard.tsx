import React from 'react';
import { Card } from '../ui/Card';
import { useCommunityView } from './CommunityContext';

export function CommunityLeaderboard() {
  const { Trophy, CustomDropdown, selectedPeriod, setSelectedPeriod, isOwner, sortConfig, handleAdminChangeGlobalSort, selectedPhase, availablePhases, setSelectedPhase, setDoc, doc, db, loadingTop, handleSort, subjects, sortedLeaderboard, parseLocalDate, onUserClick, getHeatmapColor, Flame } = useCommunityView();

  const handleUserRowClick = (user: any, idx: number) => {
    if (onUserClick) {
       onUserClick({ ...user, leaderboardRank: idx + 1, periodContext: selectedPeriod });
    }
  };

  return <Card id="community-leaderboard" noPadding className="border border-slate-100 dark:border-slate-700" data-jarvis-section="Community Leaderboard">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-3 sm:flex-row sm:items-center justify-between rounded-t-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
             <div className="flex items-center justify-between w-full sm:w-auto">
               <div className="flex items-center gap-3">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 whitespace-nowrap">
                   <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
                 </h3>
                 
                 <div className="flex items-center gap-1.5 shrink-0">
                    <CustomDropdown
                      value={selectedPeriod}
                      options={['All', '7 Days', '30 Days', 'Custom']}
                      onChange={(val) => {
                         if (val === 'Custom') setSelectedPeriod('60');
                         else setSelectedPeriod(val);
                      }}
                      placeholder="Period"
                      buttonClassName="px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50 rounded-lg w-fit text-center"
                      optionClassName="px-2 py-1 text-xs text-center"
                      hideArrow={true}
                      editable={!['All', '7 Days', '30 Days'].includes(selectedPeriod)}
                    />
                 </div>
               </div>
               
               <div className="w-24 flex-shrink-0 sm:hidden">
                 <CustomDropdown
                   value={selectedPhase}
                   options={availablePhases.map((p: any) => typeof p === 'string' ? p : p)}
                   onChange={(val) => setSelectedPhase(val)}
                   placeholder="Phase"
                   buttonClassName="px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg w-full font-medium text-left"
                   optionClassName="px-3 py-1.5 text-xs"
                 />
               </div>
             </div>
             
             {isOwner && (
               <div className="w-[140px] sm:hidden">
                 <CustomDropdown 
                    value={sortConfig.key || ''}
                    onChange={handleAdminChangeGlobalSort}
                    options={['avgPercentile', 'avgAccuracy', 'totalTests', 'streak']}
                    placeholder="Sort Default"
                    buttonClassName="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg w-full font-medium"
                 />
               </div>
             )}
          </div>
          
          <div className="hidden sm:flex items-center justify-end gap-3 sm:gap-4 w-full sm:w-auto">
             {isOwner && (
               <div className="flex items-center justify-end gap-2 border-r border-slate-200 dark:border-slate-700 pr-3">
                 <div className="w-[180px]">
                   <CustomDropdown 
                      value={sortConfig.key || ''}
                      onChange={handleAdminChangeGlobalSort}
                      options={['avgPercentile', 'avgAccuracy', 'totalTests', 'streak']}
                      placeholder="Select default sort"
                      buttonClassName="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg w-full font-medium"
                   />
                 </div>
               </div>
             )}
             <div className="w-32 flex-shrink-0">
               <CustomDropdown
                 value={selectedPhase}
                 options={availablePhases.map((p: any) => typeof p === 'string' ? p : p)}
                 onChange={(val) => setSelectedPhase(val)}
                 placeholder="Phase"
                 buttonClassName="px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg w-full font-medium text-left"
                 optionClassName="px-3 py-1.5 text-xs"
               />
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loadingTop ? (
            <div className="animate-pulse w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 h-10 w-full flex items-center px-4 gap-4">
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-24 mx-4"></div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto"></div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-4"></div>
              </div>
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="bg-white dark:bg-slate-800 border-b border-slate-50 dark:border-slate-700/50 h-14 w-full flex items-center px-4">
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-6"></div>
                  <div className="flex items-center gap-3 ml-6">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                  </div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-10 ml-auto mx-4"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-10 ml-4"></div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-[10px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-2 sm:p-4 font-semibold text-center hidden sm:table-cell">Rank</th>
                  <th className="p-2 sm:p-4 pr-4 font-semibold cursor-pointer min-w-[140px] sm:min-w-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('displayName')}>Aspirant {sortConfig.key === 'displayName' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-2 sm:p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('avgPercentile')}>FULL {sortConfig.key === 'avgPercentile' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  {subjects.map((s: any) => {
                     const sortKey = ['quant', 'reasoning', 'english', 'ga'].includes(s.id) 
                       ? `avg${s.id.charAt(0).toUpperCase() + s.id.slice(1)}Percentile` 
                       : `dynamicAverages.${s.id}`;
                     return (
                       <th key={s.id} className="p-2 sm:p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort(sortKey)}>
                         {s.name} {sortConfig.key === sortKey && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                       </th>
                     );
                  })}
                  <th className="p-2 sm:p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('totalTests')}>Tests {sortConfig.key === 'totalTests' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-2 sm:p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('streak')}>Streak {sortConfig.key === 'streak' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedLeaderboard.map((user, idx) => {
                  const now = new Date();
                  let displayStreak = 0;
                  let isToday = false;
                  
                  if (user.lastMockDate) {
                     const todayDt = new Date();
                     const today = new Date(todayDt.getFullYear(), todayDt.getMonth(), todayDt.getDate()).getTime();
                     const d = parseLocalDate(user.lastMockDate);
                     const lastMockDt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                     
                     // 86400000 ms is one day
                     const isYesterday = lastMockDt === today - 86400000;
                     isToday = lastMockDt === today;
                     
                     const isZeroStreak = lastMockDt < today - 86400000;
                     displayStreak = isZeroStreak ? 0 : (user.streak || 0);
                  }
                  
                  const quantVal = user.avgQuantPercentile ?? user.dynamicAverages?.quant ?? 0;
                  const itemText = `Leaderboard Rank #${idx + 1}: ${user.displayName || 'User'} - Full: ${user.avgPercentile || 0}%, Quant: ${quantVal}%`;
                  
                  return (
                  <tr key={user.userId} data-jarvis-item={itemText} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-2 sm:p-4 font-bold text-slate-400 dark:text-slate-500 text-center hidden sm:table-cell">#{idx + 1}</td>
                    <td className="p-2 sm:p-4 pr-3 sm:pr-4">
                      <div 
                         className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 sm:p-1.5 rounded-lg transition-colors inline-flex"
                         onClick={() => handleUserRowClick(user, idx)}
                      >
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}`} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover" />
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {user.displayName}
                            {user.badges && user.badges.length > 0 && (
                              <div className="flex items-center gap-0.5">
                                {user.badges.slice(0, 3).map((b: any, bi: number) => (
                                  <span key={bi} title={b.name} className={`flex items-center justify-center w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] rounded border ${b.imageBase64 ? 'bg-slate-50 dark:bg-slate-800' : (b.color || 'bg-slate-50 text-slate-700')} text-[9px] sm:text-[10px] leading-none overflow-hidden`}>
                                    {b.imageBase64 ? (
                                       <img src={b.imageBase64} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                       b.icon
                                    )}
                                  </span>
                                ))}
                                {user.badges.length > 3 && (
                                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-0.5">+{user.badges.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400">{user.targetedExam}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-center font-mono font-medium"><span className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 rounded text-[10px] sm:text-xs font-mono font-medium ${getHeatmapColor(user.avgPercentile)}`}>{user.avgPercentile}%</span></td>
                    {subjects.map((s: any) => {
                      let val = 0;
                      if (['quant', 'reasoning', 'english', 'ga'].includes(s.id)) {
                         val = (user as any)[`avg${s.id.charAt(0).toUpperCase() + s.id.slice(1)}Percentile`] || 0;
                      } else {
                         val = user.dynamicAverages?.[s.id] || 0;
                      }
                      return (
                        <td key={s.id} className="p-2 sm:p-4 text-center font-mono text-slate-600 dark:text-slate-400">
                          <span className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 rounded text-[10px] sm:text-xs font-mono font-medium ${getHeatmapColor(val)}`}>
                            {val}%
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 sm:p-4 text-center font-mono text-slate-600 dark:text-slate-300">{user.totalTests}</td>
                    <td className="p-2 sm:p-4 text-center">
                      <div className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs font-medium ${isToday ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        <Flame className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isToday ? '' : 'text-slate-300 dark:text-slate-600'}`} /> {displayStreak}
                      </div>
                    </td>
                  </tr>
                )})}
                {sortedLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500">No data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
}
