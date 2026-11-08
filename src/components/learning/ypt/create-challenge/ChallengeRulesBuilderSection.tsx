import React from 'react';
import { Plus, Trash2, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { YptRuleConditionType, YptApiNativeChallenge } from '../../../../types/yptTypes';
import { CustomSelect } from './CustomSelect';

const PRESET_EMOJIS = ['☀️', '🌻', '📱', '🔟', '🔥', '🎯', '⏰', '🏆', '⚡', '🏞️', '📑'];

export interface CustomRuleFormItem {
  id: string;
  name: string;
  emoji?: string;
  nativeChallengeId?: number;
  points: string;
  type: 'bonus' | 'penalty';
  conditionType?: YptRuleConditionType;
  minHoursNeeded?: string;
  scope?: 'individual' | 'team_all';
}

interface ChallengeRulesBuilderSectionProps {
  studyIntervalValue: string;
  setStudyIntervalValue: (val: string) => void;
  studyIntervalUnit: 'minutes' | 'hours';
  setStudyIntervalUnit: (val: 'minutes' | 'hours') => void;
  pointsPerInterval: string;
  setPointsPerInterval: (val: string) => void;
  penaltyThresholdValue: string;
  setPenaltyThresholdValue: (val: string) => void;
  penaltyThresholdUnit: 'hours' | 'minutes';
  setPenaltyThresholdUnit: (val: 'hours' | 'minutes') => void;
  penaltyPoints: string;
  setPenaltyPoints: (val: string) => void;
  maxContinuousHoursThreshold: string;
  setMaxContinuousHoursThreshold: (val: string) => void;
  maxContinuousPenaltyType: 'variable' | 'fixed';
  setMaxContinuousPenaltyType: (val: 'variable' | 'fixed') => void;
  maxContinuousPenaltyMode: 'excess' | 'whole';
  setMaxContinuousPenaltyMode: (val: 'excess' | 'whole') => void;
  maxContinuousPenaltyMultiplier: string;
  setMaxContinuousPenaltyMultiplier: (val: string) => void;
  maxContinuousFixedPenalty: string;
  setMaxContinuousFixedPenalty: (val: string) => void;
  customRules: CustomRuleFormItem[];
  handleAddCustomRule: () => void;
  handleRemoveCustomRule: (id: string) => void;
  handleUpdateCustomRule: (
    id: string,
    field: 'name' | 'emoji' | 'points' | 'type' | 'conditionType' | 'minHoursNeeded' | 'scope' | 'nativeChallengeId',
    value: any
  ) => void;
  handleSelectNativeChallengePreset: (ruleId: string, nc: YptApiNativeChallenge) => void;
  handleSelectEmojiPreset: (ruleId: string, emoji: string) => void;
  nativeChallenges: YptApiNativeChallenge[];
  isLoadingRoster: boolean;
  reloadRosterAndChallenges: () => void;
}

export function ChallengeRulesBuilderSection({
  studyIntervalValue,
  setStudyIntervalValue,
  studyIntervalUnit,
  setStudyIntervalUnit,
  pointsPerInterval,
  setPointsPerInterval,
  penaltyThresholdValue,
  setPenaltyThresholdValue,
  penaltyThresholdUnit,
  setPenaltyThresholdUnit,
  penaltyPoints,
  setPenaltyPoints,
  maxContinuousHoursThreshold,
  setMaxContinuousHoursThreshold,
  maxContinuousPenaltyType,
  setMaxContinuousPenaltyType,
  maxContinuousPenaltyMode,
  setMaxContinuousPenaltyMode,
  maxContinuousPenaltyMultiplier,
  setMaxContinuousPenaltyMultiplier,
  maxContinuousFixedPenalty,
  setMaxContinuousFixedPenalty,
  customRules,
  handleAddCustomRule,
  handleRemoveCustomRule,
  handleUpdateCustomRule,
  handleSelectNativeChallengePreset,
  handleSelectEmojiPreset,
  nativeChallenges,
  isLoadingRoster,
  reloadRosterAndChallenges,
}: ChallengeRulesBuilderSectionProps) {
  const getConditionLabel = (rule: { conditionType?: YptRuleConditionType; minHoursNeeded?: string; nativeChallengeId?: number; name?: string }) => {
    const cond = rule.conditionType || 'emoji_only';
    const hrs = rule.minHoursNeeded || '10';
    const hasId = Boolean(rule.nativeChallengeId);
    const linkedNative = hasId ? nativeChallenges.find((nc) => nc.id === rule.nativeChallengeId) : undefined;
    const challengeName = linkedNative?.t || (rule.name ? rule.name.trim() : '') || (hasId ? `Challenge #${rule.nativeChallengeId}` : 'Emoji');
    const idLabel = challengeName;
    switch (cond) {
      case 'hours_only':
        return `Req: ≥${hrs}h`;
      case 'both':
        return `Req: ${idLabel} + ≥${hrs}h`;
      case 'either':
        return `Req: ${idLabel} or ≥${hrs}h`;
      case 'emoji_only':
      default:
        return hasId ? `Req: ${idLabel}` : `Req: Emoji`;
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span>Point Scoring & Penalty Rules</span>
      </div>

      <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span>Every</span>
          <input
            type="number"
            value={studyIntervalValue}
            onChange={(e) => setStudyIntervalValue(e.target.value)}
            className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
          />
          <CustomSelect<'minutes' | 'hours'>
            value={studyIntervalUnit}
            onChange={(val) => setStudyIntervalUnit(val)}
            options={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'hours', label: 'Hours' },
            ]}
          />
          <span>studied → Award</span>
          <input
            type="number"
            value={pointsPerInterval}
            onChange={(e) => setPointsPerInterval(e.target.value)}
            className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
          />
          <span>XP</span>
        </div>

        <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span>Under</span>
          <input
            type="number"
            value={penaltyThresholdValue}
            onChange={(e) => setPenaltyThresholdValue(e.target.value)}
            className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
          />
          <CustomSelect<'hours' | 'minutes'>
            value={penaltyThresholdUnit}
            onChange={(val) => setPenaltyThresholdUnit(val)}
            options={[
              { value: 'hours', label: 'Hours' },
              { value: 'minutes', label: 'Minutes' },
            ]}
          />
          <span>→ Subtract</span>
          <input
            type="number"
            value={penaltyPoints}
            onChange={(e) => setPenaltyPoints(e.target.value)}
            className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
          />
          <span>XP</span>
        </div>

        <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

        {/* Continuous Session Limits (Anti-Cheat Trap) */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span>Over</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={maxContinuousHoursThreshold}
            onChange={(e) => setMaxContinuousHoursThreshold(e.target.value)}
            className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
          />
          <span>Hours</span>
          <CustomSelect<'variable' | 'fixed'>
            value={maxContinuousPenaltyType}
            onChange={(val) => setMaxContinuousPenaltyType(val)}
            options={[
              { value: 'variable', label: 'Variable' },
              { value: 'fixed', label: 'Fixed' },
            ]}
          />
          {maxContinuousPenaltyType === 'variable' ? (
            <>
              <CustomSelect<'excess' | 'whole'>
                value={maxContinuousPenaltyMode}
                onChange={(val) => setMaxContinuousPenaltyMode(val)}
                options={[
                  { value: 'excess', label: 'Excess Only' },
                  { value: 'whole', label: 'Entire Session' },
                ]}
              />
              <span>→ Deduct</span>
              <input
                type="number"
                min="1"
                step="0.5"
                value={maxContinuousPenaltyMultiplier}
                onChange={(e) => setMaxContinuousPenaltyMultiplier(e.target.value)}
                className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
              />
              <span>x XP</span>
            </>
          ) : (
            <>
              <span>→ Deduct flat</span>
              <input
                type="number"
                min="1"
                step="1"
                value={maxContinuousFixedPenalty}
                onChange={(e) => setMaxContinuousFixedPenalty(e.target.value)}
                className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
              />
              <span>XP</span>
            </>
          )}
        </div>
      </div>

      {/* ADDITIONAL POINT RULES & BONUSES */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span>Additional Point Rules & Bonuses</span>
          </div>
          <button
            type="button"
            onClick={handleAddCustomRule}
            className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Point Rule
          </button>
        </div>

        {customRules.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No additional bonus/penalty rules configured. Click <span className="font-bold text-indigo-500">+ Add Point Rule</span> to reward active YPT photo challenges or study goals.
          </div>
        ) : (
          <div className="space-y-3">
            {customRules.map((rule) => {
              const linkedNativeChallenge = nativeChallenges.find((nc) => nc.id === rule.nativeChallengeId);
              const challengeDisplayName = linkedNativeChallenge?.t || (rule.name ? rule.name.trim() : '') || (rule.nativeChallengeId ? `Challenge #${rule.nativeChallengeId}` : 'Challenge');

              return (
                <div
                  key={rule.id}
                  className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-3"
                >
                  {/* Row 1: Emoji, Name, Condition, Type */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Emoji</span>
                    <input
                      type="text"
                      value={rule.emoji || '☀️'}
                      onChange={(e) => handleUpdateCustomRule(rule.id, 'emoji', e.target.value)}
                      className="w-10 h-8 text-center text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                      title="Rule Icon / Emoji"
                    />

                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => handleUpdateCustomRule(rule.id, 'name', e.target.value)}
                      placeholder="e.g. Morning Snap Bonus"
                      className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white font-medium"
                    />

                    <CustomSelect<YptRuleConditionType>
                      value={rule.conditionType || 'emoji_only'}
                      onChange={(val) => handleUpdateCustomRule(rule.id, 'conditionType', val)}
                      options={[
                        { value: 'emoji_only', label: rule.nativeChallengeId ? `🎯 ${challengeDisplayName} Only` : 'Emoji Present Only' },
                        { value: 'hours_only', label: 'Hours Met Only' },
                        { value: 'both', label: rule.nativeChallengeId ? `Both (${challengeDisplayName} + Hours)` : 'Both (Emoji + Hours)' },
                        { value: 'either', label: rule.nativeChallengeId ? `Either (${challengeDisplayName} or Hours)` : 'Either (Emoji or Hours)' },
                      ]}
                    />

                    <CustomSelect<'bonus' | 'penalty'>
                      value={rule.type}
                      onChange={(val) => handleUpdateCustomRule(rule.id, 'type', val)}
                      options={[
                        { value: 'bonus', label: 'Bonus (+)' },
                        { value: 'penalty', label: 'Penalty (-)' },
                      ]}
                    />
                  </div>

                  {/* Row 2: Scope, Min Hours (if applicable), Points, Delete */}
                  <div className="flex flex-wrap items-center gap-2">
                    <CustomSelect<'individual' | 'team_all'>
                      value={rule.scope || 'individual'}
                      onChange={(val) => handleUpdateCustomRule(rule.id, 'scope', val)}
                      options={[
                        { value: 'individual', label: '👤 Individual' },
                        { value: 'team_all', label: '👥 Team (All Members)' },
                      ]}
                    />

                    {(rule.conditionType === 'hours_only' || rule.conditionType === 'both' || rule.conditionType === 'either') && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg">
                        <span>Req: ≥</span>
                        <input
                          type="number"
                          value={rule.minHoursNeeded || '10'}
                          onChange={(e) => handleUpdateCustomRule(rule.id, 'minHoursNeeded', e.target.value)}
                          className="w-10 text-center font-bold bg-transparent text-slate-900 dark:text-white"
                        />
                        <span>hrs</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="number"
                        value={rule.points}
                        onChange={(e) => handleUpdateCustomRule(rule.id, 'points', e.target.value)}
                        className="w-14 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
                      />
                      <span className="font-bold text-slate-500">XP</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomRule(rule.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer ml-auto sm:ml-0"
                      title="Remove Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Row 3: Quick Picker (Active YPT Native Challenges) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span>Quick Pick from Active YPT Challenges:</span>
                        {isLoadingRoster && (
                          <span className="text-[10px] font-normal text-indigo-500 animate-pulse">
                            (Fetching missions from group...)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => reloadRosterAndChallenges()}
                        disabled={isLoadingRoster}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-indigo-500 cursor-pointer disabled:opacity-50"
                        title="Refresh YPT Missions"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingRoster ? 'animate-spin text-indigo-500' : ''}`} />
                      </button>
                    </div>
                    {nativeChallenges.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {nativeChallenges.map((nc) => {
                          const isSelected = rule.nativeChallengeId === nc.id || (rule.name === nc.t && rule.emoji === nc.e);
                          return (
                            <button
                              key={nc.id}
                              type="button"
                              onClick={() => handleSelectNativeChallengePreset(rule.id, nc)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600'
                              }`}
                            >
                              <span>{nc.e || '📸'}</span>
                              <span>{nc.t}</span>
                              {nc.id ? <span className="text-[10px] opacity-70">#{nc.id}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PRESET_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleSelectEmojiPreset(rule.id, em)}
                            className={`w-7 h-7 flex items-center justify-center text-sm rounded-lg border transition-colors cursor-pointer ${
                              rule.emoji === em
                                ? 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500 shadow-xs'
                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                        <span className="text-[10px] text-slate-400 italic ml-1">
                          {isLoadingRoster
                            ? '(Fetching live missions from group...)'
                            : '(No live missions found in group, using standard presets)'}
                        </span>
                      </div>
                    )}

                    {/* Linked Challenge ID Display & Input */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {rule.nativeChallengeId ? '🎯 Linked Challenge:' : 'Link YPT Challenge ID:'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {rule.nativeChallengeId && (linkedNativeChallenge?.t || rule.name) && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                            <span>{rule.emoji || linkedNativeChallenge?.e || '📸'}</span>
                            <span>{linkedNativeChallenge?.t || rule.name}</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-mono">#</span>
                        <input
                          type="number"
                          value={rule.nativeChallengeId || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            handleUpdateCustomRule(rule.id, 'nativeChallengeId', val);
                          }}
                          placeholder="e.g. 347458"
                          className="w-24 px-2 py-0.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-indigo-600 dark:text-indigo-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                        {rule.nativeChallengeId && (
                          <button
                            type="button"
                            onClick={() => handleUpdateCustomRule(rule.id, 'nativeChallengeId', undefined)}
                            className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer px-1 py-0.5 rounded"
                            title="Clear linked Challenge ID"
                          >
                            ✕ Clear ID
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {rule.nativeChallengeId
                          ? `(ID #${rule.nativeChallengeId} — strictly tracked by YPT challenge ID)`
                          : '(Optional: pick from above or enter ID for strict challenge tracking)'}
                      </span>
                    </div>
                  </div>

                  {/* Row 4: Live Preview Pill */}
                  <div className="flex items-center gap-2 text-xs pt-1">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                      PREVIEW:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <span>{rule.emoji || '☀️'}</span>
                        <span>{rule.name || 'Untitled Rule'}</span>
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          rule.type === 'bonus'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {rule.type === 'bonus' ? `+${rule.points || 0} XP` : `-${rule.points || 0} XP`}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {getConditionLabel(rule)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {rule.scope === 'team_all' ? 'Req: Team All' : 'Req: Individual'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
