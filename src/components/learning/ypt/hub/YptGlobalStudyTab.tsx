import React from 'react';
import { Trophy, Sparkles, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { YptChallenge, YptDailyDaySnapshot } from '../../../../types/yptTypes';
import { YptUserEntry } from '../../../../services/yptService';
import { areYptHandlesMatching, normalizeHandle, extractAlpha, getLocalYmd } from '../../../../utils/yptUtils';

export type GlobalDateFilter = 'date' | 'allTime';

export interface GlobalMemberStat {
  cleanHandle: string;
  displayHandle: string;
  periodHours: number;
  periodXP: number;
  totalHours: number;
  totalXP: number;
  submissionCount: number;
}

export function formatStudyHours(hours: number): string {
  if (!hours || hours <= 0) return '0h 00m';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

export function computeGlobalLeaderboardData(
  registeredUsers: YptUserEntry[],
  activeChallenges: YptChallenge[],
  allSnapshots: YptDailyDaySnapshot[],
  dateFilter: GlobalDateFilter,
  selectedFilterDateYmd: string
): (GlobalMemberStat & { aliases: string[] })[] {
  // Build alias map and pre-initialize registered members in membersMap
  const aliasToUserMap = new Map<string, { userKey: string; primaryDisplayHandle: string; allAliases: string[] }>();
  const membersMap = new Map<string, GlobalMemberStat & { aliases: string[] }>();

  registeredUsers.forEach((u) => {
    const allAliases = Array.isArray(u.yptNames) ? [...u.yptNames] : [];
    if (u.displayName && !allAliases.includes(u.displayName)) {
      allAliases.push(u.displayName);
    }
    if (u.defaultYptHandle && !allAliases.includes(u.defaultYptHandle)) {
      allAliases.push(u.defaultYptHandle);
    }
    if (allAliases.length === 0) return;

    let primaryDisplay = u.defaultYptHandle;
    if (!primaryDisplay && allAliases.length > 0) {
      primaryDisplay = allAliases[0];
    }
    if (!primaryDisplay) {
      primaryDisplay = u.displayName || u.uid;
    }
    primaryDisplay = primaryDisplay.replace(/^@/, '').trim();

    const userKey = u.uid;

    membersMap.set(userKey, {
      cleanHandle: userKey,
      displayHandle: primaryDisplay,
      periodHours: 0,
      periodXP: 0,
      totalHours: 0,
      totalXP: 0,
      submissionCount: 0,
      aliases: allAliases,
    });

    const addAliasToMap = (key: string) => {
      if (!key) return;
      if (!aliasToUserMap.has(key)) {
        aliasToUserMap.set(key, {
          userKey,
          primaryDisplayHandle: primaryDisplay!,
          allAliases,
        });
      }
    };

    // Map UID directly
    addAliasToMap(u.uid.toLowerCase());

    allAliases.forEach((alias) => {
      if (!alias) return;
      const clean = alias.replace(/^@/, '').trim().toLowerCase();
      addAliasToMap(clean);

      const norm = normalizeHandle(alias);
      addAliasToMap(norm);

      const noSpace = norm.replace(/\s+/g, '');
      addAliasToMap(noSpace);

      const alpha = extractAlpha(alias);
      if (alpha && alpha.length >= 2) {
        addAliasToMap(alpha);
      }
    });
  });

  // Helper to get registered member record (returns null for non-registered handles)
  const getOrInitMemberRecord = (rawHandle?: string, matchedUid?: string) => {
    if (!rawHandle && !matchedUid) return null;

    if (matchedUid && membersMap.has(matchedUid)) {
      return membersMap.get(matchedUid)!;
    }

    if (rawHandle) {
      const cleanHandle = rawHandle.replace(/^@/, '').trim().toLowerCase();
      let registered = aliasToUserMap.get(cleanHandle);
      if (!registered) {
        const norm = normalizeHandle(rawHandle);
        registered = aliasToUserMap.get(norm);
      }
      if (!registered) {
        const noSpace = normalizeHandle(rawHandle).replace(/\s+/g, '');
        registered = aliasToUserMap.get(noSpace);
      }
      if (!registered) {
        const alpha = extractAlpha(rawHandle);
        if (alpha && alpha.length >= 2) {
          registered = aliasToUserMap.get(alpha);
        }
      }

      if (registered) {
        return membersMap.get(registered.userKey) || null;
      }

      // Fallback multi-tier match
      for (const userEntry of registeredUsers) {
        const userKey = userEntry.uid;
        const userAliases = Array.isArray(userEntry.yptNames) ? [...userEntry.yptNames] : [];
        if (userEntry.displayName) userAliases.push(userEntry.displayName);

        for (const alias of userAliases) {
          if (areYptHandlesMatching(alias, rawHandle, userKey, matchedUid)) {
            return membersMap.get(userKey) || null;
          }
        }
      }
    }

    return null;
  };

  // 1. Index registered members across all active challenges
  activeChallenges.forEach((c) => {
    (c.teams || []).forEach((t) => {
      (t.memberUids || []).forEach((rawHandle) => {
        getOrInitMemberRecord(rawHandle);
      });
    });
  });

  // 2. Scan dailySnapshots across all challenges, deduplicating by (userKey, dateYmd) using Math.max
  const userDailyMaxHours = new Map<string, number>();

  allSnapshots.forEach((snap) => {
    const snapDateYmd = snap.targetDateYmd || snap.dateYmd;
    if (!snapDateYmd) return;

    const entries: Array<{ handle: string; hours: number; matchedUid?: string }> = [];
    if (snap.memberSnapshots && Object.keys(snap.memberSnapshots).length > 0) {
      Object.values(snap.memberSnapshots).forEach((ms) => {
        entries.push({
          handle: ms.handle,
          hours: ms.hoursStudied || 0,
          matchedUid: ms.appUserId || (ms.rawYptUd ? String(ms.rawYptUd) : undefined),
        });
      });
    } else if (Array.isArray(snap.memberRecords)) {
      snap.memberRecords.forEach((mr) => {
        entries.push({
          handle: mr.yptHandle,
          hours: mr.hoursStudied || 0,
          matchedUid: mr.userId,
        });
      });
    }

    entries.forEach(({ handle, hours, matchedUid }) => {
      if (!hours || hours <= 0) return;
      const stat = getOrInitMemberRecord(handle, matchedUid);
      if (!stat) return;

      const compositeKey = `${stat.cleanHandle}__${snapDateYmd}`;
      const prevHours = userDailyMaxHours.get(compositeKey) || 0;
      if (hours > prevHours) {
        userDailyMaxHours.set(compositeKey, hours);
      }
    });
  });

  userDailyMaxHours.forEach((hours, compositeKey) => {
    const [userKey, snapDateYmd] = compositeKey.split('__');
    const stat = membersMap.get(userKey);
    if (!stat) return;

    stat.totalHours += hours;
    stat.submissionCount += 1;

    const isPeriodMatch = dateFilter === 'allTime' || snapDateYmd === selectedFilterDateYmd;
    if (isPeriodMatch) {
      stat.periodHours += hours;
    }
  });

  // 3. Convert to array and round floats nicely (1 study hour = 1 XP)
  const result = Array.from(membersMap.values()).map((stat) => {
    const periodHours = Math.round(stat.periodHours * 100) / 100;
    const totalHours = Math.round(stat.totalHours * 100) / 100;
    return {
      ...stat,
      periodHours,
      periodXP: periodHours,
      totalHours,
      totalXP: totalHours,
    };
  });

  // 4. Sorting: If dateFilter is allTime, sort by totalHours/totalXP.
  result.sort((a, b) => {
    if (dateFilter === 'allTime') {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return b.periodHours - a.periodHours;
    } else {
      if (b.periodHours !== a.periodHours) return b.periodHours - a.periodHours;
      return b.totalHours - a.totalHours;
    }
  });

  return result;
}

interface YptGlobalStudyTabProps {
  activeChallenges: YptChallenge[];
  globalLeaderboard: (GlobalMemberStat & { aliases: string[] })[];
  filteredLeaderboard: (GlobalMemberStat & { aliases: string[] })[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  dateFilter: GlobalDateFilter;
  setDateFilter: (f: GlobalDateFilter) => void;
  selectedFilterDateYmd: string;
  setSelectedFilterDateYmd: (ymd: string) => void;
}

export function YptGlobalStudyTab({
  activeChallenges,
  globalLeaderboard,
  filteredLeaderboard,
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  selectedFilterDateYmd,
  setSelectedFilterDateYmd,
}: YptGlobalStudyTabProps) {
  return (
    <div className="space-y-6">
      {/* Global Arena Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Global YPT Arena
              </span>
              <span className="text-[11px] sm:text-xs text-indigo-200/80 font-medium">
                Real-time study analytics across all challenges
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-1">
              Global Individual Leaderboard
            </h2>
          </div>

          {/* Filter Controls: Handle Search Input & Date Filter Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by @handle..."
                className="pl-8 pr-3 py-1.5 text-[11px] sm:text-xs bg-slate-800/90 border border-indigo-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 w-full sm:w-44 transition-all"
              />
            </div>

            {/* Date Filter Toggle Control with Arrow Navigation */}
            {(() => {
              const earliestStartDateYmd = activeChallenges.reduce((earliest, c) => {
                if (!c.startDate) return earliest;
                const raw = String(c.startDate).trim();
                const ymd = raw.split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd < earliest) return ymd;
                return earliest;
              }, getLocalYmd(new Date(Date.now() - 60 * 86400000)));

              const minAllowedDateYmd = earliestStartDateYmd;
              const todayYmd = getLocalYmd(new Date());

              const isPrevDateDisabled = selectedFilterDateYmd <= minAllowedDateYmd;
              const isNextDateDisabled = selectedFilterDateYmd >= todayYmd;

              const getDayOffsetFromToday = (dateYmd: string): number => {
                const todayStr = getLocalYmd(new Date());
                if (dateYmd === todayStr) return 0;
                const [tY, tM, tD] = todayStr.split('-').map(Number);
                const [sY, sM, sD] = dateYmd.split('-').map(Number);
                const tDate = new Date(tY, tM - 1, tD);
                const sDate = new Date(sY, sM - 1, sD);
                const diffMs = sDate.getTime() - tDate.getTime();
                return Math.round(diffMs / (1000 * 60 * 60 * 24));
              };

              const getFilterDateLabel = (dateYmd: string): string => {
                const offset = getDayOffsetFromToday(dateYmd);
                if (offset === 0) return '☀️ Today';
                if (offset === -1) return '📅 Yesterday';

                const [y, m, d] = dateYmd.split('-').map(Number);
                const dateObj = new Date(y, m - 1, d);
                const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `📅 ${formatted}`;
              };

              return (
                <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-indigo-500/30 text-xs font-bold shrink-0">
                  <div
                    className={`flex items-center rounded-lg transition-all ${
                      dateFilter === 'date'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPrevDateDisabled) {
                          const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          dateObj.setDate(dateObj.getDate() - 1);
                          const nextYmd = getLocalYmd(dateObj);
                          if (nextYmd >= minAllowedDateYmd) {
                            setSelectedFilterDateYmd(nextYmd);
                            setDateFilter('date');
                          }
                        }
                      }}
                      disabled={isPrevDateDisabled}
                      className="p-1 hover:bg-indigo-700 rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={`Previous day (${minAllowedDateYmd})`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDateFilter('date')}
                      className="px-2 py-1 text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      {getFilterDateLabel(selectedFilterDateYmd)}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isNextDateDisabled) {
                          const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          dateObj.setDate(dateObj.getDate() + 1);
                          const nextYmd = getLocalYmd(dateObj);
                          if (nextYmd <= todayYmd) {
                            setSelectedFilterDateYmd(nextYmd);
                            setDateFilter('date');
                          }
                        }
                      }}
                      disabled={isNextDateDisabled}
                      className="p-1 hover:bg-indigo-700 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next day (up to Today)"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDateFilter('allTime')}
                    className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      dateFilter === 'allTime'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🏆 All-Time
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Leaderboard Member Cards Grid */}
      {filteredLeaderboard.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center space-y-2">
          <Trophy className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {searchQuery ? `No members found matching "@${searchQuery}"` : 'No study data available for this period'}
          </p>
          <p className="text-[11px] text-slate-400">
            Try changing the date filter or searching for another handle.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLeaderboard.map((member) => {
            // True rank (1-indexed) in full globalLeaderboard array (sorted by cumulative totalHours)
            const rank = globalLeaderboard.findIndex((m) => m.cleanHandle === member.cleanHandle) + 1;

            const isRank1 = rank === 1 && member.totalHours > 0;
            const isRank2 = rank === 2 && member.totalHours > 0;
            const isRank3 = rank === 3 && member.totalHours > 0;

            return (
              <div
                key={member.cleanHandle}
                className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-2 sm:gap-3 ${
                  isRank1
                    ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/30'
                    : isRank2
                    ? 'bg-slate-200/60 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-2xs'
                    : isRank3
                    ? 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/30 dark:border-orange-500/40 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Rank + Handle Info */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Rank Position Pill */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 flex items-center justify-center font-black text-[11px] sm:text-xs font-mono shadow-2xs ${
                      isRank1
                        ? 'bg-amber-400 text-amber-950 shadow-amber-500/30'
                        : isRank2
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                        : isRank3
                        ? 'bg-orange-400 text-orange-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    #{rank}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate">
                        @{member.displayHandle}
                      </span>

                      {isRank1 ? (
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-400/30 shrink-0 flex items-center justify-center">
                          👑
                        </span>
                      ) : isRank2 ? (
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold border border-slate-400/30 shrink-0 flex items-center justify-center">
                          🥈
                        </span>
                      ) : isRank3 ? (
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 font-extrabold border border-orange-500/30 shrink-0 flex items-center justify-center">
                          🥉
                        </span>
                      ) : null}
                    </div>

                    {/* Study Duration Details */}
                    <div className="text-[10px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2">
                      <span>
                        {dateFilter === 'date' ? (selectedFilterDateYmd === getLocalYmd(new Date()) ? 'Today' : selectedFilterDateYmd) : 'Period'}:{' '}
                        <strong className="font-mono">{formatStudyHours(member.periodHours)}</strong>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px]">
                        Total: <strong className="font-mono">{formatStudyHours(member.totalHours)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Metrics: Earned XP */}
                <div className="flex flex-col items-end text-right shrink-0 font-mono space-y-0.5">
                  <div className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400">
                    Total: {member.totalXP} XP
                  </div>
                  <div className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +{member.periodXP} XP {dateFilter === 'date' ? (selectedFilterDateYmd === getLocalYmd(new Date()) ? 'today' : selectedFilterDateYmd) : 'period'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
