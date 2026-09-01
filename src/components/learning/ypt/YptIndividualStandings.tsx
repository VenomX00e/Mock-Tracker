import React, { useState } from 'react';
import {
  Crown,
  Medal,
  Award,
  Trophy,
  Flame,
  Clock,
  Zap,
  User,
  Pencil,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { YptCustomRule } from '../../../types/yptTypes';
import { formatStudyDuration } from '../../../utils/yptUtils';

export interface CalculatedParticipant {
  yptUd?: number;
  handleRaw: string;
  cleanHandle: string;
  displayName?: string;
  avatarUrl?: string;
  periodPoints: number;
  periodHours: number;
  cumulativePoints: number;
  cumulativeHours: number;
  periodBadges: { emoji: string; name: string; points: number; count: number; isTeamAll?: boolean }[];
  isLiveFromApi: boolean;
  isStudyingCurrently: boolean;
  rank: number;
}

interface YptIndividualStandingsProps {
  participants: CalculatedParticipant[];
  filterPeriodLabel: string;
  filterTitleLabel: string;
  dateFilter: 'date' | 'allTime';
  viewMode: 'cards' | 'table';
  canEdit: boolean;
  customRules?: YptCustomRule[];
  onEditMember: (handleRaw: string) => void;
  onAwardQuickRule: (handleRaw: string, rule: YptCustomRule) => void;
  onRemoveBadge: (handleRaw: string, badge: any) => void;
}

export const YptIndividualStandings: React.FC<YptIndividualStandingsProps> = ({
  participants,
  filterPeriodLabel,
  filterTitleLabel,
  dateFilter,
  viewMode,
  canEdit,
  customRules = [],
  onEditMember,
  onAwardQuickRule,
  onRemoveBadge,
}) => {
  const [quickRulePopoverHandle, setQuickRulePopoverHandle] = useState<string | null>(null);
  const [expandedBreakdownHandle, setExpandedBreakdownHandle] = useState<string | null>(null);

  if (participants.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 text-xs">
        <User className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">No participants enrolled in this challenge</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Use the "Manage Participants" button to add members.</p>
      </div>
    );
  }

  const leader = participants[0];

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 shadow-xs">
          <Crown className="w-3.5 h-3.5 fill-amber-950" /> #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-800 dark:text-slate-100 shadow-xs">
          <Medal className="w-3.5 h-3.5" /> #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-600 to-amber-700 text-amber-50 shadow-xs">
          <Award className="w-3.5 h-3.5" /> #3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        #{rank}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 👑 Top Leader Spotlight Banner */}
      {leader && (
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-amber-900/10 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-amber-950/30 border-2 border-amber-400/40 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-amber-950 font-black text-lg shadow-md">
                  👑
                </div>
                {leader.isStudyingCurrently && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40">
                    Current Leader • 1st Place
                  </span>
                  {leader.isStudyingCurrently && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Studying Now
                    </span>
                  )}
                </div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {leader.displayName || leader.cleanHandle}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                  {filterTitleLabel} Score
                </span>
                <span className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                  {leader.periodPoints > 0 ? `+${leader.periodPoints}` : leader.periodPoints} XP
                </span>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                  All-Time Total
                </span>
                <span className="text-base sm:text-lg font-black text-amber-500 font-mono">
                  {leader.cumulativePoints} XP
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode: Cards Layout */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {participants.map((p) => {
            const isLeader = p.rank === 1;
            const isTopThree = p.rank <= 3;
            const isExpanded = expandedBreakdownHandle === p.cleanHandle;

            return (
              <div
                key={p.handleRaw}
                className={`relative flex flex-col justify-between bg-white dark:bg-slate-900 border rounded-2xl p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
                  isLeader
                    ? 'border-amber-400/50 dark:border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent'
                    : isTopThree
                    ? 'border-purple-300/40 dark:border-purple-800/40'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Card Header: Rank, Avatar, Name, Live status */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isLeader
                              ? 'bg-amber-400 text-amber-950 font-black'
                              : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          {p.cleanHandle.slice(0, 2).toUpperCase()}
                        </div>
                        {p.isStudyingCurrently && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white dark:border-slate-900" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {p.displayName || p.cleanHandle}
                          </span>
                          {p.isStudyingCurrently && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Live
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getRankBadge(p.rank)}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onEditMember(p.handleRaw)}
                          className="p-1 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit member logs or adjust XP"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 py-3">
                    <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium block flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> {filterTitleLabel} Time
                      </span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-0.5 block">
                        {formatStudyDuration(p.periodHours)}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium block flex items-center gap-1">
                        <Zap className="w-3 h-3 text-purple-500" /> {filterTitleLabel} XP
                      </span>
                      <span
                        className={`font-mono font-extrabold text-xs sm:text-sm mt-0.5 block ${
                          p.periodPoints > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : p.periodPoints < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {p.periodPoints > 0 ? `+${p.periodPoints}` : p.periodPoints} XP
                      </span>
                    </div>
                  </div>

                  {/* Badges Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Badges & Rules</span>
                      {canEdit && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setQuickRulePopoverHandle(
                                quickRulePopoverHandle === p.handleRaw ? null : p.handleRaw
                              )
                            }
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" /> Rule
                          </button>

                          {/* Quick Rule Popover */}
                          {quickRulePopoverHandle === p.handleRaw && (
                            <div className="absolute right-0 top-6 z-30 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-1 text-left animate-in fade-in zoom-in-95 duration-150">
                              <div className="text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span>Award Rule</span>
                                <button
                                  type="button"
                                  onClick={() => setQuickRulePopoverHandle(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                                {customRules.length === 0 ? (
                                  <p className="text-[10px] text-slate-400 italic">No custom rules configured</p>
                                ) : (
                                  customRules.map((rule) => (
                                    <button
                                      key={rule.id}
                                      type="button"
                                      onClick={() => {
                                        onAwardQuickRule(p.handleRaw, rule);
                                        setQuickRulePopoverHandle(null);
                                      }}
                                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between gap-1 transition-colors cursor-pointer"
                                    >
                                      <span className="truncate">
                                        {rule.emoji || '⭐'} {rule.name}
                                      </span>
                                      <span
                                        className={`font-mono text-[10px] font-bold shrink-0 ${
                                          rule.type === 'bonus' ? 'text-emerald-500' : 'text-rose-500'
                                        }`}
                                      >
                                        {rule.type === 'bonus' ? `+${rule.points}` : `-${rule.points}`}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 min-h-6">
                      {p.periodBadges.length > 0 ? (
                        p.periodBadges.map((badge, bIdx) => (
                          <span
                            key={bIdx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border shadow-2xs ${
                              badge.points > 0
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/40'
                                : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/40'
                            }`}
                            title={`${badge.name}: ${badge.points > 0 ? '+' : ''}${badge.points} XP`}
                          >
                            <span>{badge.emoji}</span>
                            <span>{badge.name}</span>
                            {badge.count > 1 && (
                              <span className="text-[9px] opacity-75 font-mono">×{badge.count}</span>
                            )}
                            <span className="font-mono text-[9px]">
                              ({badge.points > 0 ? `+${badge.points}` : badge.points})
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onRemoveBadge(p.handleRaw, badge)}
                                className="ml-0.5 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                                title="Remove badge"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No badges for this period</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: All-Time Cumulative summary */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span>All-Time:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {formatStudyDuration(p.cumulativeHours)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total XP:</span>
                    <span className="font-mono font-black text-amber-500 text-xs">
                      {p.cumulativePoints} XP
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode: Table Layout */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3.5 w-16 text-center">Rank</th>
                <th className="py-3 px-3.5">Participant</th>
                <th className="py-3 px-3.5 text-right">{filterTitleLabel} Time</th>
                <th className="py-3 px-3.5 text-right">{filterTitleLabel} XP</th>
                <th className="py-3 px-3.5 text-right">All-Time Total</th>
                <th className="py-3 px-3.5">Badges & Rules</th>
                {canEdit && <th className="py-3 px-3.5 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {participants.map((p) => {
                const isLeader = p.rank === 1;

                return (
                  <tr
                    key={p.handleRaw}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isLeader ? 'bg-amber-500/5 dark:bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-3.5 text-center">{getRankBadge(p.rank)}</td>

                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[10px] flex items-center justify-center">
                            {p.cleanHandle.slice(0, 2).toUpperCase()}
                          </div>
                          {p.isStudyingCurrently && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-slate-900" />
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {p.displayName || p.cleanHandle}
                            </span>
                            {p.isStudyingCurrently && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-xs">
                                Live
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {formatStudyDuration(p.periodHours)}
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <span
                        className={`font-mono font-bold ${
                          p.periodPoints > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : p.periodPoints < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {p.periodPoints > 0 ? `+${p.periodPoints}` : p.periodPoints} XP
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <div className="font-mono font-extrabold text-amber-500">{p.cumulativePoints} XP</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatStudyDuration(p.cumulativeHours)}
                      </div>
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.periodBadges.length > 0 ? (
                          p.periodBadges.map((badge, bIdx) => (
                            <span
                              key={bIdx}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                badge.points > 0
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40'
                                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
                              }`}
                            >
                              <span>{badge.emoji}</span>
                              <span>{badge.name}</span>
                              {badge.count > 1 && <span>×{badge.count}</span>}
                              <span>({badge.points > 0 ? `+${badge.points}` : badge.points})</span>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveBadge(p.handleRaw, badge)}
                                  className="ml-0.5 hover:text-rose-600"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No badges</span>
                        )}
                      </div>
                    </td>

                    {canEdit && (
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditMember(p.handleRaw)}
                            className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit member log"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
