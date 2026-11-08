import React from 'react';
import { Trophy, ChevronLeft, ChevronRight, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { YptChallenge } from '../../../../types/yptTypes';
import { formatStudyDuration } from '../../../../utils/yptUtils';
import { CalculatedTeam } from './challengeStandingsCalculator';

interface YptTeamStandingsViewProps {
  challenge: YptChallenge;
  rankedTeams: CalculatedTeam[];
  activeTotalPointsAllTeams: number;
  teamViewMode: 'grid' | 'swipe';
  carouselRef: React.RefObject<HTMLDivElement | null>;
  scrollCarousel: (direction: 'left' | 'right') => void;
  dateFilter: 'date' | 'allTime';
  selectedFilterDateYmd: string;
  todayYmd: string;
  filterTitleLabel: string;
  filterPeriodLabel: string;
  globalTopScorerHandle: string | null;
  expandedTeamBreakdownId: string | null;
  setExpandedTeamBreakdownId: (id: string | null) => void;
  canEditMember: (teamIdOrHandle: string, memberHandle?: string) => boolean;
  setEditingMemberHandle: (handle: string | null) => void;
  quickRulePopoverMember: string | null;
  setQuickRulePopoverMember: (handle: string | null) => void;
  handleApplyQuickRule: (
    memberHandleRaw: string,
    ruleToApply: { id?: string; name: string; emoji: string; points: number }
  ) => void;
}

export function YptTeamStandingsView({
  challenge,
  rankedTeams,
  activeTotalPointsAllTeams,
  teamViewMode,
  carouselRef,
  scrollCarousel,
  dateFilter,
  selectedFilterDateYmd,
  todayYmd,
  filterTitleLabel,
  filterPeriodLabel,
  globalTopScorerHandle,
  expandedTeamBreakdownId,
  setExpandedTeamBreakdownId,
  canEditMember,
  setEditingMemberHandle,
  quickRulePopoverMember,
  setQuickRulePopoverMember,
  handleApplyQuickRule,
}: YptTeamStandingsViewProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Optional Navigation controls for Swipe mode */}
      {teamViewMode === 'swipe' && rankedTeams.length > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-0.5">
          <span className="text-[11px] font-semibold flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span>↔️</span> Swipe horizontally to view all {rankedTeams.length} teams
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollCarousel('left')}
              className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
              title="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel('right')}
              className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
              title="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Side-by-side Teams Grid OR Horizontal Swipe Carousel */}
      <div
        ref={teamViewMode === 'swipe' ? carouselRef : undefined}
        className={
          teamViewMode === 'swipe'
            ? 'flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 touch-pan-x scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-transparent'
            : 'grid grid-cols-1 md:grid-cols-2 gap-5'
        }
      >
        {rankedTeams.map((team, teamIdx) => {
          const teamPeriodGain = team.teamPeriodGain;
          const teamPeriodHours = team.teamPeriodHours;
          const teamScoreForBar = dateFilter === 'allTime' ? team.totalPoints : team.teamPeriodGain;
          const pct =
            activeTotalPointsAllTeams > 0
              ? Math.min(100, Math.round((teamScoreForBar / activeTotalPointsAllTeams) * 100))
              : 0;

          const teamWideCustomRules = (challenge.rules?.customRules || []).filter((cr) => cr.scope === 'team_all');
          const unlockedTeamWideRules = teamWideCustomRules.filter((cr) => {
            return team.calculatedMembers.some((m) =>
              m.periodBadges.some((b) => (b.name === cr.name || b.emoji === cr.emoji) && b.points !== 0)
            );
          });

          // Aggregate team points breakdown by emoji / custom rules
          const teamEmojiBreakdownMap = new Map<
            string,
            { emoji: string; name: string; totalPoints: number; count: number; isTeamAll?: boolean }
          >();
          let totalEmojiPoints = 0;

          team.calculatedMembers.forEach((m) => {
            m.periodBadges.forEach((b) => {
              const key = b.name || b.emoji;
              const pts = (b.points || 0) * (b.count || 1);
              totalEmojiPoints += pts;

              const existing = teamEmojiBreakdownMap.get(key);
              if (existing) {
                existing.count += b.count || 1;
                existing.totalPoints += pts;
              } else {
                teamEmojiBreakdownMap.set(key, {
                  emoji: b.emoji || '✨',
                  name: b.name || 'Rule',
                  totalPoints: pts,
                  count: b.count || 1,
                  isTeamAll: Boolean(b.isTeamAll),
                });
              }
            });
          });

          const teamEmojiList = Array.from(teamEmojiBreakdownMap.values());
          const activeTeamScore = dateFilter === 'allTime' ? team.totalPoints : team.teamPeriodGain;
          const baseStudyPoints = Math.max(0, activeTeamScore - totalEmojiPoints);
          const teamKey = team.id || team.name;
          const isBreakdownExpanded = expandedTeamBreakdownId === teamKey;

          return (
            <div
              key={team.id}
              className={`bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 sm:p-4 space-y-3 flex flex-col justify-between ${
                teamViewMode === 'swipe'
                  ? 'w-[85vw] sm:w-[420px] md:w-[480px] lg:w-[520px] shrink-0 shadow-md'
                  : ''
              }`}
            >
              <div className="space-y-3">
                {/* Team Header Card: Name, Rank, Member Count, Period Gain & Total Score */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-start gap-2">
                    <span
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shrink-0 shadow-2xs mt-0.5"
                      style={{ backgroundColor: team.color || '#6366f1' }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{team.name}</h4>
                        <span
                          className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                            teamIdx === 0
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {teamIdx === 0 ? '👑 #1 Lead' : `#${teamIdx + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-slate-400 mt-0.5 flex-wrap">
                        <span>{team.calculatedMembers.length} Members</span>
                        <span>•</span>
                        <span>
                          {filterTitleLabel}:{' '}
                          <strong
                            className="text-[10px] sm:text-[11px] font-bold font-mono"
                            style={{ color: team.color || '#6366f1' }}
                          >
                            {formatStudyDuration(teamPeriodHours)}
                          </strong>
                        </span>
                      </div>
                      {unlockedTeamWideRules.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          {unlockedTeamWideRules.map((tr, trIdx) => (
                            <span
                              key={trIdx}
                              className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-2xs"
                            >
                              <span>✨ Team Unlocked</span>
                              <span className="font-semibold">
                                ({tr.emoji} {tr.name}: {tr.type === 'bonus' ? '+' : '-'}
                                {tr.points} XP Team Bonus)
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tap target for Team Points Breakdown */}
                  <button
                    type="button"
                    onClick={() => setExpandedTeamBreakdownId(isBreakdownExpanded ? null : teamKey)}
                    className="text-right shrink-0 p-1.5 -m-1.5 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500/30 border border-transparent hover:border-indigo-500/30"
                    title="Tap to toggle Points Collection breakdown"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono block group-hover:underline">
                        {team.totalPoints} XP
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-indigo-500 transition-transform ${
                          isBreakdownExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    <div className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      +{teamPeriodGain} XP {filterPeriodLabel}
                    </div>
                  </button>
                </div>

                {/* Team Score Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: team.color || '#6366f1',
                    }}
                  />
                </div>

                {/* Expanded Team Points Collection Breakdown Box */}
                {isBreakdownExpanded && (
                  <div className="p-3.5 bg-gradient-to-b from-indigo-50/90 to-white dark:from-indigo-950/40 dark:to-slate-900/90 border border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl space-y-3 shadow-md text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-indigo-200/50 dark:border-indigo-800/50 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-extrabold text-slate-900 dark:text-white text-xs">
                            {team.name} Points Collection
                          </h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {filterTitleLabel} Breakdown
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedTeamBreakdownId(null)}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg hover:bg-indigo-500/20"
                      >
                        Close ✕
                      </button>
                    </div>

                    {/* Stat Cards: Study Time & Points */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-medium block">⏱️ Team Study Hours</span>
                        <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                          {formatStudyDuration(teamPeriodHours)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-medium block">⭐ Points Collected</span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                          +{teamPeriodGain} XP
                        </span>
                      </div>
                    </div>

                    {/* Points Gains Through Emojis & Base Study */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Points Source</span>
                        <span>XP Earned</span>
                      </div>

                      {/* Base Study Hours XP */}
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">⏱️</span>
                          <div className="truncate">
                            <span className="font-bold text-slate-800 dark:text-slate-100 block">
                              Base Study Duration
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {formatStudyDuration(teamPeriodHours)} studied
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs shrink-0">
                          +{baseStudyPoints} XP
                        </span>
                      </div>

                      {/* Emoji & Rules breakdown */}
                      {teamEmojiList.length > 0 ? (
                        teamEmojiList.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{item.emoji}</span>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                                  {item.isTeamAll && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                                      👥 Team Rule
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  Collected {item.count} time{item.count > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`font-mono font-extrabold text-xs shrink-0 ${
                                item.totalPoints >= 0 ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {item.totalPoints >= 0 ? `+${item.totalPoints}` : item.totalPoints} XP
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-center text-[10px] text-slate-400 italic bg-white dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          No extra emoji rule bonuses collected in this period.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vertical Member Cards List */}
                <div className="space-y-2 pt-1">
                  {team.calculatedMembers.map((member, idx) => {
                    const isGlobalMvp = globalTopScorerHandle && globalTopScorerHandle === member.handleRaw;
                    const isTeamMvp = team.teamMvpHandle && team.teamMvpHandle === member.handleRaw;
                    const isTeamSilver =
                      team.teamSilverHandle && team.teamSilverHandle === member.handleRaw && !isGlobalMvp;
                    const isAssignedLeader = team.teamLeaders?.some(
                      (l) => l.toLowerCase().replace(/^@/, '').trim() === member.cleanHandle
                    );
                    const canEditThisMember = canEditMember(team.id || team.name, member.handleRaw);

                    return (
                      <div
                        key={idx}
                        className={`p-2 sm:p-2.5 rounded-xl border space-y-1.5 flex flex-col justify-between transition-all ${
                          isGlobalMvp
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-400/80 dark:border-amber-500/80 shadow-xs shadow-amber-500/10 ring-1 ring-amber-400/30'
                            : isTeamMvp
                            ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/40 dark:border-amber-500/40'
                            : isTeamSilver
                            ? 'bg-slate-200/40 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700/80'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="min-w-0 space-y-0.5">
                            {(isAssignedLeader || isGlobalMvp || isTeamMvp || isTeamSilver) && (
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap mb-1 pl-5 sm:pl-6">
                                {isAssignedLeader && (
                                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold shrink-0 flex items-center gap-0.5 border border-amber-500/40">
                                    👑 Team Leader
                                  </span>
                                )}
                                {isGlobalMvp ? (
                                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shrink-0 flex items-center gap-0.5 border border-amber-500/30">
                                    👑 MVP
                                  </span>
                                ) : isTeamMvp ? (
                                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shrink-0 flex items-center gap-0.5 border border-amber-500/20">
                                    👑 Team MVP
                                  </span>
                                ) : isTeamSilver ? (
                                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold shrink-0 flex items-center gap-0.5 border border-slate-300 dark:border-slate-600">
                                    🥈 2nd Contributor
                                  </span>
                                ) : null}
                              </div>
                            )}

                            <div className="font-bold text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 truncate flex items-center gap-1 sm:gap-1.5 flex-wrap">
                              <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 font-mono shrink-0">
                                #{idx + 1}
                              </span>
                              <span
                                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
                                style={{ backgroundColor: team.color || '#6366f1' }}
                              />
                              <span className="truncate">@{member.handleRaw.replace(/^@/, '')}</span>

                              {/* Live "Now Studying" Indicator (Only for Today / Live Tab) */}
                              {dateFilter === 'date' &&
                                selectedFilterDateYmd === todayYmd &&
                                member.isStudyingCurrently && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-500/20 shrink-0"
                                    title="Currently studying on YPT"
                                  >
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                                    <span>Studying</span>
                                  </span>
                                )}

                              {canEditThisMember && (
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberHandle(member.handleRaw)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shrink-0"
                                  title={`Edit log & rules for @${member.handleRaw.replace(/^@/, '')}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-500 pl-3 sm:pl-5 flex-wrap">
                              <span>
                                {filterTitleLabel}:{' '}
                                <strong
                                  className="text-[11px] sm:text-xs font-bold font-mono"
                                  style={{ color: team.color || '#6366f1' }}
                                >
                                  {formatStudyDuration(member.periodHours)}
                                </strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>
                                Total:{' '}
                                <strong className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-mono">
                                  {formatStudyDuration(member.cumulativeHours)}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end text-right shrink-0 font-mono space-y-0.5">
                            <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 block">
                              Total: {member.cumulativePoints} XP
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                              {member.periodPoints >= 0 ? `+${member.periodPoints}` : member.periodPoints} XP{' '}
                              {filterPeriodLabel}
                            </span>
                          </div>
                        </div>

                        {/* Earned Badges & Quick Rule Actions */}
                        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          {member.periodBadges.map((badge, bIdx) => {
                            const isPenalty = badge.points < 0;
                            return (
                              <span
                                key={bIdx}
                                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold shadow-2xs transition-all ${
                                  badge.isTeamAll
                                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                    : isPenalty
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                                }`}
                                title={
                                  badge.isTeamAll
                                    ? `👥 Whole Team Bonus: ${badge.name} (${badge.points >= 0 ? '+' : ''}${badge.points} XP)`
                                    : `${badge.name} (${badge.points >= 0 ? '+' : ''}${badge.points} XP)`
                                }
                              >
                                {badge.isTeamAll && <span className="text-[10px]">👥</span>}
                                <span className="text-[10px] sm:text-xs">{badge.emoji}</span>
                                <span
                                  className={`font-mono ${
                                    badge.isTeamAll
                                      ? 'text-purple-600 dark:text-purple-400 font-extrabold'
                                      : isPenalty
                                      ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {badge.points >= 0 ? `+${badge.points}` : badge.points}
                                </span>
                              </span>
                            );
                          })}

                          {canEditThisMember && (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickRulePopoverMember(
                                    quickRulePopoverMember === member.handleRaw ? null : member.handleRaw
                                  )
                                }
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-[9px] font-extrabold cursor-pointer transition-colors"
                                title="Add Quick Emoji Rule Badge"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Rule</span>
                              </button>

                              {/* Quick Rule Popover */}
                              {quickRulePopoverMember === member.handleRaw && (
                                <div className="absolute left-0 bottom-full mb-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 min-w-[200px] max-w-[260px] space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                                  <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                                    <span>Apply Rule Emoji</span>
                                    <button
                                      onClick={() => setQuickRulePopoverMember(null)}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApplyQuickRule(member.handleRaw, {
                                          name: 'Morning Snap Bonus',
                                          emoji: '☀️',
                                          points: challenge.rules.morningSnapBonus || 5,
                                        })
                                      }
                                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                    >
                                      <span>☀️ Morning Snap</span>
                                      <span className="font-mono text-emerald-600">
                                        +{challenge.rules.morningSnapBonus || 5} XP
                                      </span>
                                    </button>
                                    {Array.isArray(challenge.rules.customRules) &&
                                      challenge.rules.customRules.map((cr) => (
                                        <button
                                          key={cr.id}
                                          type="button"
                                          onClick={() =>
                                            handleApplyQuickRule(member.handleRaw, {
                                              id: cr.id,
                                              name: cr.name,
                                              emoji: cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱'),
                                              points:
                                                cr.type === 'bonus'
                                                  ? Math.abs(cr.points)
                                                  : -Math.abs(cr.points),
                                            })
                                          }
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                          <span>
                                            {cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱')} {cr.name}
                                          </span>
                                          <span
                                            className={`font-mono ${
                                              cr.type === 'bonus' ? 'text-emerald-600' : 'text-rose-500'
                                            }`}
                                          >
                                            {cr.type === 'bonus' ? '+' : '-'}
                                            {cr.points} XP
                                          </span>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {member.periodBadges.length === 0 && !canEditThisMember && (
                            <div className="text-[9px] sm:text-[10px] text-slate-400 italic pt-0.5 pl-3 sm:pl-5">
                              No badges earned in this period
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
