import React from 'react';
import { MockScore } from '../../types';
import { Card } from '../ui/Card';
import { useCommunityView } from './CommunityContext';

export function CommunityFeed() {
  const { user, Users, loadingFeed, filteredFeedLogs, daysVisible, feedSort, handleFeedSort, getFeedSortConfig, subjects, sortedLeaderboard, onUserClick, Flame, getPlatformShort, getHeatmapColor, getSub, handleReact, reactions, Calendar, setDaysVisible, ArrowRight } = useCommunityView();
  return <>
    {/* FEED */}
      <Card id="community-log" noPadding className="border border-slate-100 dark:border-slate-700 overflow-hidden" data-jarvis-section="Community Activity Log">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Community Log
          </h3>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900">
          {loadingFeed ? (
            <div className="space-y-6">
              {[1, 2].map((group) => (
                <div key={group} className="animate-pulse">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4 mx-2"></div>
                  <div className="w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 h-10 w-full flex items-center px-4 gap-4">
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                    </div>
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="bg-white dark:bg-slate-800 border-b border-slate-50 dark:border-slate-700/50 h-16 w-full flex items-center px-4 gap-6">
                        <div className="flex items-center gap-3 w-1/4">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                        </div>
                        <div className="flex flex-col gap-2 w-1/4">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                          <div className="flex gap-1.5"><div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-10"></div></div>
                        </div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 mx-auto"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 mx-auto"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {(() => {
                const flattenFeed = () => {
                  const flat: any[] = [];
                  filteredFeedLogs.slice(0, daysVisible).forEach(dg => {
                    flat.push(...dg.mocks);
                  });
                  return flat;
                };

                const flatFeed = flattenFeed();
                let feedToDisplay = null;
                
                if (feedSort.key && feedSort.direction) {
                  feedToDisplay = [...flatFeed].sort((a, b) => {
                    let aVal = a[feedSort.key];
                    let bVal = b[feedSort.key];
                    if (feedSort.key.includes('.')) {
                      const parts = feedSort.key.split('.');
                      aVal = a[parts[0]]?.[parts[1]];
                      bVal = b[parts[0]]?.[parts[1]];
                    }
                    if (aVal == null) aVal = '';
                    if (bVal == null) bVal = '';
                    const numA = Number(aVal);
                    const numB = Number(bVal);
                    if (!isNaN(numA) && !isNaN(numB) && aVal !== '' && bVal !== '') {
                      return feedSort.direction === 'desc' ? numB - numA : numA - numB;
                    }
                    if (String(aVal).toLowerCase() < String(bVal).toLowerCase()) return feedSort.direction === 'asc' ? -1 : 1;
                    if (String(aVal).toLowerCase() > String(bVal).toLowerCase()) return feedSort.direction === 'asc' ? 1 : -1;
                    return 0;
                  });
                }
                
                const tableHeader = (
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              <th className="px-2 py-2 sm:px-4 sm:py-3 pr-4 font-semibold cursor-pointer min-w-[120px] sm:min-w-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('userName')}>Aspirant {getFeedSortConfig('userName')}</th>
                              <th className="px-2 py-2 sm:px-4 sm:py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('mockName')}>Mock Name {getFeedSortConfig('mockName')}</th>
                              <th className="px-2 py-2 sm:px-4 sm:py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('examType')}>Exam {getFeedSortConfig('examType')}</th>
                              <th className="px-2 py-2 sm:px-4 sm:py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('score')}>Score {getFeedSortConfig('score')}</th>
                              <th className="px-2 py-2 sm:px-4 sm:py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('percentile')}>Percentile {getFeedSortConfig('percentile')}</th>
                              {subjects.map((s: any) => {
                                const sortKey = ['quant', 'reasoning', 'english', 'ga'].includes(s.id) ? `${s.id}.score` : `dynamicSubjects.${s.id}.score`;
                                return (
                                  <th key={s.id} className="px-2 py-2 sm:px-4 sm:py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort(sortKey)}>
                                    {s.name} {getFeedSortConfig(sortKey)}
                                  </th>
                                );
                              })}
                              <th className="px-2 py-2 sm:px-4 sm:py-3 w-10"></th>
                            </tr>
                          </thead>
                );

                const renderFeedRow = (m: any) => {
                  const feedItemText = `Community Log Entry: ${m.userName || 'Aspirant'} scored ${m.score ?? '-'} on ${m.mockName || 'Mock Test'}`;
                  return (
                              <tr 
                                key={m.id} 
                                data-jarvis-item={feedItemText}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <td className="px-2 py-2 sm:px-4 sm:py-3 pr-3 sm:pr-4 font-medium text-slate-700 dark:text-slate-300">
                                  <div 
                                    className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 sm:p-1.5 rounded-lg transition-colors inline-flex"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rank = sortedLeaderboard.findIndex(u => u.userId === m.userId) + 1;
                                        if (onUserClick && m.userProfileRef) {
                                            onUserClick({ ...m.userProfileRef, leaderboardRank: rank > 0 ? rank : undefined });
                                        }
                                    }}
                                  >
                                    <img src={m.userPhoto || `https://ui-avatars.com/api/?name=${m.userName || 'U'}`} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                                    <span className="text-slate-800 dark:text-slate-200 text-xs sm:text-base">{m.userName}</span>
                                    {m.userStreak && m.userStreak > 0 ? (
                                       <span className={`flex items-center ml-0.5 sm:ml-1 text-[10px] sm:text-xs ${m.userStreakActive ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                         <Flame className={`w-3 h-3 md:w-3.5 md:h-3.5 ${m.userStreakActive ? 'animate-pulse' : ''}`} /> {m.userStreak}
                                       </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-base">{m.mockName}</span>
                                    <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-1 mt-0.5 sm:mt-1 w-full max-w-full pb-0.5">
                                      {m.platform && <span className="text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap px-1 sm:px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">{getPlatformShort(m.platform)}</span>}
                                      {m.examPhase && <span className="text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap px-1 sm:px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">{m.examPhase}</span>}
                                      {m.examScope && <span className="text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap px-1 sm:px-1.5 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium">{m.examScope}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent rounded-md text-xs font-semibold theme-exam-badge">
                                     {m.examType}
                                    </span>
                                    {m.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">{m.examRole}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-medium text-blue-600 dark:text-blue-400 text-center align-middle">
                                  {m.score != null && m.score !== 0 ? m.score : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    {m.percentile != null && m.percentile !== 0 ? (
                                      <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium rounded ${getHeatmapColor(m.percentile)}`}>
                                        {m.percentile}%P
                                      </span>
                                    ) : <span className="text-slate-300">-</span>}
                                    {m.accuracy != null && m.accuracy !== 0 && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium ${getHeatmapColor(m.accuracy)}`}>
                                        {m.accuracy}%A
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {subjects.map((s: any) => {
                                  const sub = getSub(m, s.id, subjects);
                                  return (
                                    <td key={s.id} className="px-4 py-3 text-center align-middle">
                                       <div className="flex flex-col items-center">
                                          <span className="font-mono text-slate-600 dark:text-slate-300">{sub?.score != null && sub.score !== 0 ? sub.score : '-'}</span>
                                          <div className="flex flex-col gap-0.5 mt-1 items-center">
                                            {sub?.percentile != null && sub.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(sub.percentile)}`}>{sub.percentile}%P</span>}
                                            {sub?.accuracy != null && sub.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(sub.accuracy)}`}>{sub.accuracy}%A</span>}
                                          </div>
                                        </div>
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex justify-end items-center gap-2 pr-2">
                                      <button 
                                        onClick={(e) => handleReact(e, m.id, m.userId)}
                                        className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors text-xs font-medium " + (user && m.likes?.includes(user.uid) ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300")}
                                      >
                                        <span className="text-sm">🔥</span> 
                                        <span>{m.likes?.length || 0}</span>
                                      </button>
                                    </div>
                                </td>
                              </tr>
                );
              };

                if (feedToDisplay) {
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm mt-4">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          {tableHeader}
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {feedToDisplay.map((m: any) => renderFeedRow(m))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                return filteredFeedLogs.slice(0, daysVisible).map((dayGroup, idx) => (
                  <div key={dayGroup.date} className="animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {dayGroup.date}
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            {tableHeader}
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                              {dayGroup.mocks.map((m: MockScore) => renderFeedRow(m))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}

              {daysVisible < filteredFeedLogs.length && (
                <div className="text-center pt-0 pb-1 -mt-2 -mb-1">
                  <button 
                    onClick={() => setDaysVisible(prev => prev + 3)}
                    className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    View Next {Math.min(3, filteredFeedLogs.length - daysVisible)} Days <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              )}
              {filteredFeedLogs.length === 0 && (
                 <div className="text-center text-slate-400 py-4">No community data yet.</div>
              )}
            </div>
          )}
        </div>
      </Card>
  </>
}
