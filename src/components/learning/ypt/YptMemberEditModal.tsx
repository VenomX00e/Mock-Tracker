import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Check, Calendar, User, Save } from 'lucide-react';
import { YptChallenge, YptCustomRule, YptDailyDaySnapshot } from '../../../types/yptTypes';
import { updateMemberInDailySnapshot } from '../../../services/yptService';
import { areYptHandlesMatching, formatStudyDuration, getYptDayYmd } from '../../../utils/yptUtils';

interface YptMemberEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: YptChallenge;
  memberHandle: string;
  initialDateYmd?: string;
  dailySnapshots: YptDailyDaySnapshot[];
  onSuccess: () => void;
}

export function YptMemberEditModal({
  isOpen,
  onClose,
  challenge,
  memberHandle,
  initialDateYmd,
  dailySnapshots,
  onSuccess,
}: YptMemberEditModalProps) {
  const cleanHandle = memberHandle.replace(/^@/, '').trim().toLowerCase();
  const displayHandle = memberHandle.replace(/^@/, '').trim();

  const todayYmd = getYptDayYmd();
  const [selectedDate, setSelectedDate] = useState<string>(initialDateYmd || todayYmd);

  const [hoursInput, setHoursInput] = useState<number>(0);
  const [minutesInput, setMinutesInput] = useState<number>(0);
  const [manualBonusXp, setManualBonusXp] = useState<number>(0);
  const [selectedRules, setSelectedRules] = useState<Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing data for member & selectedDate from dailySnapshots when date or modal state changes
  useEffect(() => {
    if (!isOpen) return;

    const targetYmd = selectedDate || initialDateYmd || todayYmd;
    setSelectedDate(targetYmd);

    const snapshot = dailySnapshots.find(
      (s) => (s.targetDateYmd || s.dateYmd) === targetYmd
    );

    if (snapshot) {
      let memberSnap = snapshot.memberSnapshots?.[cleanHandle];
      if (!memberSnap && snapshot.memberSnapshots) {
        const matchKey = Object.keys(snapshot.memberSnapshots).find((k) =>
          areYptHandlesMatching(snapshot.memberSnapshots[k].handle, memberHandle)
        );
        if (matchKey) memberSnap = snapshot.memberSnapshots[matchKey];
      }

      const memberRec = (snapshot.memberRecords || []).find((r) =>
        areYptHandlesMatching(r.yptHandle, memberHandle, r.userId)
      );

      if (memberSnap || memberRec) {
        const totalHours = memberSnap?.hoursStudied ?? memberRec?.hoursStudied ?? 0;
        const hrs = Math.floor(totalHours);
        const mins = Math.round((totalHours - hrs) * 60);
        setHoursInput(hrs);
        setMinutesInput(mins);

        const rawRules = memberSnap?.appliedRuleBreakdown || memberRec?.appliedRules || [];
        const customRulesList = rawRules
          .filter(
            (r: any) =>
              r.ruleId !== 'base_study' &&
              r.ruleId !== 'no_study_penalty' &&
              r.ruleId !== 'max_continuous_penalty' &&
              r.ruleId !== 'manual_bonus_xp'
          )
          .map((r: any) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            emoji: r.emoji || '⭐',
            points: r.points || 0,
          }));

        const manualRule = rawRules.find((r: any) => r.ruleId === 'manual_bonus_xp');
        setSelectedRules(customRulesList);
        setManualBonusXp(manualRule?.points || 0);
        return;
      }
    }

    setHoursInput(0);
    setMinutesInput(0);
    setSelectedRules([]);
    setManualBonusXp(0);
  }, [isOpen, selectedDate, initialDateYmd, memberHandle, dailySnapshots]);

  if (!isOpen) return null;

  // Rule Calculation
  const totalHoursStudied = hoursInput + minutesInput / 60;

  const rules = challenge.rules;
  const intervalVal = rules.studyIntervalValue ?? 1;
  const intervalUnit = rules.studyIntervalUnit ?? 'hours';
  const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval = rules.pointsPerInterval ?? rules.pointsPerStudyHour ?? 1;

  const baseStudyPoints = Math.floor(totalHoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal = rules.penaltyThresholdValue ?? rules.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules.penaltyThresholdUnit ?? 'hours';
  const penaltyThresholdHours = penaltyThresholdUnit === 'minutes' ? penaltyThresholdVal / 60 : penaltyThresholdVal || 3;

  const isPenalized = selectedDate < todayYmd && totalHoursStudied < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? (rules.penaltyPoints || 0) : 0;

  const rulePointsSum = selectedRules.reduce((sum, r) => sum + (r.points || 0), 0);
  const calculatedTotalXp = baseStudyPoints - penaltyDeduction + rulePointsSum + manualBonusXp;

  const toggleRule = (cr: YptCustomRule) => {
    const rulePts = cr.type === 'bonus' ? Math.abs(cr.points) : -Math.abs(cr.points);
    const existingIdx = selectedRules.findIndex(
      (r) => (r.ruleId && r.ruleId === cr.id) || r.ruleName.toLowerCase() === cr.name.toLowerCase()
    );

    if (existingIdx >= 0) {
      setSelectedRules(selectedRules.filter((_, idx) => idx !== existingIdx));
    } else {
      setSelectedRules([
        ...selectedRules,
        {
          ruleId: cr.id,
          ruleName: cr.name,
          emoji: cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱'),
          points: rulePts,
        },
      ]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      await updateMemberInDailySnapshot(challenge, memberHandle, selectedDate, {
        hoursStudied: Math.max(0, Number(totalHoursStudied.toFixed(2))),
        appliedRules: selectedRules,
        manualBonusXp,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save manual member edit:', err);
      setError(err?.message || 'Failed to save member log.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Edit Log for <span className="text-indigo-600 dark:text-indigo-400">@{displayHandle}</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Manual study hours & score rule overrides</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Target Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Target Date for Entry
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Study Duration Inputs */}
          <div className="space-y-2 p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
            <label className="block text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Study Hours & Minutes</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500">Hours</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500">Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400">Presets:</span>
              {[
                { label: '+30m', h: 0, m: 30 },
                { label: '+1h', h: 1, m: 0 },
                { label: '+2h', h: 2, m: 0 },
                { label: '+3h', h: 3, m: 0 },
                { label: '+5h', h: 5, m: 0 },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    let totalM = hoursInput * 60 + minutesInput + preset.h * 60 + preset.m;
                    setHoursInput(Math.floor(totalM / 60));
                    setMinutesInput(totalM % 60);
                  }}
                  className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setHoursInput(0);
                  setMinutesInput(0);
                }}
                className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg hover:bg-rose-500/20 transition-colors ml-auto"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Rule Badges Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Apply Challenge Bonus / Penalty Rules</span>
              <span className="text-[10px] text-slate-400 font-normal">Click to toggle</span>
            </label>

            {Array.isArray(challenge.rules.customRules) && challenge.rules.customRules.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {challenge.rules.customRules.map((cr) => {
                  const isSelected = selectedRules.some(
                    (r) => (r.ruleId && r.ruleId === cr.id) || r.ruleName.toLowerCase() === cr.name.toLowerCase()
                  );
                  return (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => toggleRule(cr)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? cr.type === 'bonus'
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/50 shadow-xs'
                            : 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/50 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span>{cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱')}</span>
                      <span>{cr.name}</span>
                      <span className="font-mono text-[10px]">
                        ({cr.type === 'bonus' ? '+' : '-'}{cr.points} XP)
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No custom rules configured for this challenge.</p>
            )}
          </div>

          {/* Manual Bonus/Penalty XP Adjustment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Manual Custom XP Adjustment (+ / -)
            </label>
            <input
              type="number"
              value={manualBonusXp}
              onChange={(e) => setManualBonusXp(parseInt(e.target.value) || 0)}
              placeholder="e.g. 5 or -5"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Score Calculation Summary */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Study Hours ({formatStudyDuration(totalHoursStudied)}):</span>
              <span>+{baseStudyPoints} XP</span>
            </div>
            {isPenalized && (
              <div className="flex justify-between text-rose-400 text-[11px]">
                <span>No-Study Penalty (&lt;{penaltyThresholdHours}h):</span>
                <span>-{penaltyDeduction} XP</span>
              </div>
            )}
            {rulePointsSum !== 0 && (
              <div className="flex justify-between text-amber-300 text-[11px]">
                <span>Applied Rule Badges:</span>
                <span>{rulePointsSum >= 0 ? `+${rulePointsSum}` : rulePointsSum} XP</span>
              </div>
            )}
            {manualBonusXp !== 0 && (
              <div className="flex justify-between text-purple-300 text-[11px]">
                <span>Manual Adjustment:</span>
                <span>{manualBonusXp >= 0 ? `+${manualBonusXp}` : manualBonusXp} XP</span>
              </div>
            )}
            <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-sm text-indigo-300">
              <span>Calculated Total Day XP:</span>
              <span>{calculatedTotalXp} XP</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Member Log'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
