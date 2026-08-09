import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Award, Clock, Users, ShieldAlert, Sparkles, Crown, ChevronDown, Check } from 'lucide-react';
import { YptRuleConfig, YptTeam, YptRuleConditionType } from '../../../types/yptTypes';
import { createYptChallenge, updateYptChallenge, getAllKnownYptNames } from '../../../services/yptService';
import { useAuthCtx } from '../../../context/AppContext';
import { YptMemberPicker } from './YptMemberPicker';
import { YptChallenge } from '../../../types/yptTypes';

interface CustomSelectOption<T extends string> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: CustomSelectOption<T>[];
  className?: string;
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${className}`}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 min-w-[150px] w-max max-w-[240px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CreateYptChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  challengeToEdit?: YptChallenge | null;
}

function getTodayYmd(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToYmd(dateStr: string, days: number): string {
  if (!dateStr || isNaN(days)) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calcDaysBetweenYmd(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '';
  const sParts = startStr.split('-');
  const eParts = endStr.split('-');
  if (sParts.length !== 3 || eParts.length !== 3) return '';
  const sDate = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
  const eDate = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));
  const diffTime = eDate.getTime() - sDate.getTime();
  if (diffTime >= 0) {
    return Math.round(diffTime / (1000 * 60 * 60 * 24)).toString();
  }
  return '0';
}

export function CreateYptChallengeModal({ isOpen, onClose, onSuccess, challengeToEdit }: CreateYptChallengeModalProps) {
  const { user } = useAuthCtx();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Date & Duration System
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Rule Configurator
  const [studyIntervalValue, setStudyIntervalValue] = useState('30');
  const [studyIntervalUnit, setStudyIntervalUnit] = useState<'minutes' | 'hours'>('minutes');
  const [pointsPerInterval, setPointsPerInterval] = useState('1');

  const [penaltyThresholdValue, setPenaltyThresholdValue] = useState('3');
  const [penaltyThresholdUnit, setPenaltyThresholdUnit] = useState<'minutes' | 'hours'>('hours');
  const [penaltyPoints, setPenaltyPoints] = useState('5');

  const [customRules, setCustomRules] = useState<
    Array<{
      id: string;
      name: string;
      emoji?: string;
      points: string;
      type: 'bonus' | 'penalty';
      conditionType?: YptRuleConditionType;
      minHoursNeeded?: string;
      scope?: 'individual' | 'team_all';
    }>
  >([
    { id: 'rule_1', name: 'Morning Snap Bonus', emoji: '☀️', points: '5', type: 'bonus', conditionType: 'emoji_only', minHoursNeeded: '10', scope: 'individual' }
  ]);

  // Teams
  const [teams, setTeams] = useState<Array<{ id?: string; name: string; color: string; memberUids: string[]; teamLeaders?: string[]; totalPoints?: number }>>([
    { name: 'Alpha Striker', color: '#6366f1', memberUids: [], teamLeaders: [] },
    { name: 'Beta Victors', color: '#ec4899', memberUids: [], teamLeaders: [] },
  ]);

  const [knownYptNames, setKnownYptNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStartDateFocusOrClick = () => {
    if (!startDate) {
      const today = getTodayYmd();
      handleStartDateChange(today);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val) {
      if (duration !== '') {
        const days = parseInt(duration, 10);
        if (!isNaN(days) && days >= 0) {
          setEndDate(addDaysToYmd(val, days));
        }
      } else if (endDate) {
        setDuration(calcDaysBetweenYmd(val, endDate));
      }
    } else {
      if (duration !== '') {
        setEndDate('');
      }
    }
  };

  const handleDurationChange = (val: string) => {
    setDuration(val);
    let effectiveStartDate = startDate;
    if (!effectiveStartDate && val !== '') {
      effectiveStartDate = getTodayYmd();
      setStartDate(effectiveStartDate);
    }
    if (effectiveStartDate && val !== '') {
      const days = parseInt(val, 10);
      if (!isNaN(days) && days >= 0) {
        setEndDate(addDaysToYmd(effectiveStartDate, days));
      }
    } else if (val === '') {
      setEndDate('');
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    let effectiveStartDate = startDate;
    if (!effectiveStartDate && val) {
      effectiveStartDate = getTodayYmd();
      setStartDate(effectiveStartDate);
    }
    if (effectiveStartDate && val) {
      setDuration(calcDaysBetweenYmd(effectiveStartDate, val));
    } else if (!val) {
      setDuration('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      getAllKnownYptNames().then((names) => {
        setKnownYptNames(names);
      }).catch((err) => {
        console.warn('Failed to load known YPT names:', err);
      });

      if (challengeToEdit) {
        setTitle(challengeToEdit.title || '');
        setDescription(challengeToEdit.description || '');

        let sYmd = getTodayYmd();
        if (challengeToEdit.startDate) {
          try {
            sYmd = new Date(challengeToEdit.startDate).toISOString().split('T')[0];
          } catch (e) {
            sYmd = getTodayYmd();
          }
        }
        let eYmd = addDaysToYmd(sYmd, 7);
        if (challengeToEdit.endDate) {
          try {
            eYmd = new Date(challengeToEdit.endDate).toISOString().split('T')[0];
          } catch (e) {
            eYmd = addDaysToYmd(sYmd, 7);
          }
        }
        setStartDate(sYmd);
        setEndDate(eYmd);
        setDuration(calcDaysBetweenYmd(sYmd, eYmd) || '7');
        
        const r = challengeToEdit.rules;
        if (r) {
          setStudyIntervalValue(String(r.studyIntervalValue ?? 30));
          setStudyIntervalUnit(r.studyIntervalUnit ?? 'minutes');
          setPointsPerInterval(String(r.pointsPerInterval ?? 1));
          setPenaltyThresholdValue(String(r.penaltyThresholdValue ?? 3));
          setPenaltyThresholdUnit(r.penaltyThresholdUnit ?? 'hours');
          setPenaltyPoints(String(r.penaltyPoints ?? 5));
          if (r.customRules && r.customRules.length > 0) {
            setCustomRules(
              r.customRules.map((cr) => ({
                id: cr.id,
                name: cr.name,
                emoji: cr.emoji || '☀️',
                points: String(cr.points),
                type: cr.type,
                conditionType: cr.conditionType || 'emoji_only',
                minHoursNeeded: cr.minHoursNeeded !== undefined ? String(cr.minHoursNeeded) : '10',
                scope: cr.scope || 'individual',
              }))
            );
          } else {
            setCustomRules([]);
          }
        }

        if (challengeToEdit.teams && challengeToEdit.teams.length > 0) {
          setTeams(
            challengeToEdit.teams.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color || '#6366f1',
              memberUids: t.memberUids || [],
              teamLeaders: t.teamLeaders || [],
              totalPoints: t.totalPoints || 0,
            }))
          );
        }
      } else {
        // Reset defaults for creation - keep all boxes vacant
        setTitle('');
        setDescription('');
        setStartDate('');
        setDuration('');
        setEndDate('');
        setStudyIntervalValue('30');
        setStudyIntervalUnit('minutes');
        setPointsPerInterval('1');
        setPenaltyThresholdValue('3');
        setPenaltyThresholdUnit('hours');
        setPenaltyPoints('5');
        setCustomRules([{ id: 'rule_1', name: 'Morning Snap Bonus', emoji: '☀️', points: '5', type: 'bonus', conditionType: 'emoji_only', minHoursNeeded: '10' }]);
        setTeams([
          { name: 'Alpha Striker', color: '#6366f1', memberUids: [], teamLeaders: [] },
          { name: 'Beta Victors', color: '#ec4899', memberUids: [], teamLeaders: [] },
        ]);
      }
    }
  }, [isOpen, challengeToEdit]);

  if (!isOpen) return null;

  const PRESET_EMOJIS = ['☀️', '🌻', '📱', '🔟', '🔥', '🎯', '⏰', '🏆', '⚡', '🏞️', '📑'];

  const getConditionLabel = (rule: { conditionType?: YptRuleConditionType; minHoursNeeded?: string }) => {
    const cond = rule.conditionType || 'emoji_only';
    const hrs = rule.minHoursNeeded || '10';
    switch (cond) {
      case 'hours_only':
        return `Req: ≥${hrs}h`;
      case 'both':
        return `Req: Emoji + ≥${hrs}h`;
      case 'either':
        return `Req: Emoji or ≥${hrs}h`;
      case 'emoji_only':
      default:
        return `Req: Emoji`;
    }
  };

  const handleAddCustomRule = () => {
    setCustomRules([
      ...customRules,
      { id: `rule_${Date.now()}`, name: '', emoji: '☀️', points: '5', type: 'bonus', conditionType: 'emoji_only', minHoursNeeded: '10', scope: 'individual' }
    ]);
  };

  const handleRemoveCustomRule = (id: string) => {
    setCustomRules(customRules.filter((r) => r.id !== id));
  };

  const handleUpdateCustomRule = (
    id: string,
    field: 'name' | 'emoji' | 'points' | 'type' | 'conditionType' | 'minHoursNeeded' | 'scope',
    value: string
  ) => {
    setCustomRules(
      customRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSelectEmojiPreset = (ruleId: string, emoji: string) => {
    setCustomRules(
      customRules.map((r) => {
        if (r.id !== ruleId) return r;
        if (emoji === '🔟') {
          return {
            ...r,
            emoji: '🔟',
            name: r.name ? r.name : '10hr zone',
            conditionType: 'both',
            minHoursNeeded: '10',
            points: r.points || '1',
            type: 'bonus',
          };
        }
        return { ...r, emoji };
      })
    );
  };

  const handleAddTeam = () => {
    if (teams.length >= 6) return;
    setTeams([...teams, { name: `Team ${teams.length + 1}`, color: '#10b981', memberUids: [], teamLeaders: [] }]);
  };

  const handleRemoveTeam = (index: number) => {
    if (teams.length <= 2) {
      alert('A challenge requires at least 2 teams for comparison.');
      return;
    }
    setTeams(teams.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a challenge title.');
      return;
    }

    if (!user) {
      setError('You must be signed in to create a challenge.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalStartDate = startDate ? new Date(startDate + 'T00:00:00').toISOString() : new Date().toISOString();
      const finalEndDate = endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();

      const intervalVal = parseFloat(studyIntervalValue) || 30;
      const ptsInterval = parseFloat(pointsPerInterval) || 1;
      const intervalInHours = studyIntervalUnit === 'minutes' ? (intervalVal / 60) : intervalVal;
      const derivedPointsPerHour = intervalInHours > 0 ? (ptsInterval / intervalInHours) : ptsInterval;

      const penVal = parseFloat(penaltyThresholdValue) || 3;
      const penInHours = penaltyThresholdUnit === 'minutes' ? (penVal / 60) : penVal;

      const rules: YptRuleConfig = {
        pointsPerStudyHour: derivedPointsPerHour,
        studyIntervalValue: intervalVal,
        studyIntervalUnit,
        pointsPerInterval: ptsInterval,
        penaltyThresholdValue: penVal,
        penaltyThresholdUnit,
        noStudyPenaltyThresholdHours: penInHours,
        penaltyPoints: parseFloat(penaltyPoints) || 5,
        customRules: customRules
          .filter((r) => r.name.trim().length > 0)
          .map((r) => ({
            id: r.id,
            name: r.name.trim(),
            emoji: r.emoji?.trim() || undefined,
            points: parseFloat(r.points) || 0,
            type: r.type,
            conditionType: r.conditionType || 'emoji_only',
            minHoursNeeded: r.conditionType && r.conditionType !== 'emoji_only' ? (parseFloat(r.minHoursNeeded || '10') || 0) : undefined,
            scope: r.scope || 'individual',
          })),
      };

      const finalTeams: YptTeam[] = teams.map((t, idx) => ({
        id: t.id || `team_${idx}_${Date.now()}`,
        name: t.name.trim() || `Team ${idx + 1}`,
        color: t.color,
        memberUids: t.memberUids.map((s) => s.trim()).filter(Boolean),
        teamLeaders: (t.teamLeaders || []).map((s) => s.trim()).filter(Boolean),
        totalPoints: t.totalPoints || 0,
      }));

      if (challengeToEdit) {
        await updateYptChallenge(challengeToEdit.id, {
          title: title.trim(),
          description: description.trim(),
          startDate: finalStartDate,
          endDate: finalEndDate,
          rules,
          teams: finalTeams,
        });
      } else {
        await createYptChallenge({
          title: title.trim(),
          description: description.trim(),
          leaderUid: user.uid,
          startDate: finalStartDate,
          endDate: finalEndDate,
          status: 'active',
          rules,
          teams: finalTeams,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating YPT challenge:', err);
      setError(err.message || 'Failed to create challenge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal panel body */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col z-10 my-auto">
        {/* Top Banner Header */}
        <div className="relative p-5 sm:p-7 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent dark:from-indigo-950/40 dark:via-indigo-950/10 dark:to-transparent border-b border-slate-100 dark:border-slate-800/80 shrink-0 select-none">
          <div className="flex items-center justify-between mb-2.5">
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>YPT GROUP CHALLENGE</span>
            </span>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {challengeToEdit ? 'Edit Challenge Settings' : 'Create YPT Study Challenge'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure study targets, reward multipliers, under-study penalties, and team rosters.
          </p>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-center gap-2.5 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: CHALLENGE INFO */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Challenge Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., SBI PO 7-Day Sprint"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onFocus={handleStartDateFocusOrClick}
                    onClick={handleStartDateFocusOrClick}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium transition-all cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Days"
                    value={duration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Set goal expectations for participants..."
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium transition-all resize-none"
                />
              </div>
            </div>

            {/* SECTION 2: POINT SCORING & PENALTIES */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Point Scoring & Penalty Rules</span>
              </div>

              <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-4">
                {/* Rule 1: Study Reward */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">For every</span>
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        min="1"
                        value={studyIntervalValue}
                        onChange={(e) => setStudyIntervalValue(e.target.value)}
                        className="w-16 px-2.5 py-1.5 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                        placeholder="30"
                      />
                      <CustomSelect<'minutes' | 'hours'>
                        value={studyIntervalUnit}
                        onChange={(val) => setStudyIntervalUnit(val)}
                        options={[
                          { value: 'minutes', label: 'Minutes' },
                          { value: 'hours', label: 'Hours' },
                        ]}
                      />
                    </div>
                    <span className="font-semibold">studied → Award</span>
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={pointsPerInterval}
                        onChange={(e) => setPointsPerInterval(e.target.value)}
                        className="w-16 px-2.5 py-1.5 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                        placeholder="1"
                      />
                      <span className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                        Pts
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Rule: {studyIntervalValue || '30'} {studyIntervalUnit} study = +{pointsPerInterval || '1'} XP
                  </p>
                </div>

                <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

                {/* Rule 2: Penalty Rule */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">If study time is under</span>
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={penaltyThresholdValue}
                        onChange={(e) => setPenaltyThresholdValue(e.target.value)}
                        className="w-16 px-2.5 py-1.5 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                        placeholder="3"
                      />
                      <CustomSelect<'hours' | 'minutes'>
                        value={penaltyThresholdUnit}
                        onChange={(val) => setPenaltyThresholdUnit(val)}
                        options={[
                          { value: 'hours', label: 'Hours' },
                          { value: 'minutes', label: 'Minutes' },
                        ]}
                      />
                    </div>
                    <span className="font-semibold">→ Subtract</span>
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        min="0"
                        value={penaltyPoints}
                        onChange={(e) => setPenaltyPoints(e.target.value)}
                        className="w-16 px-2.5 py-1.5 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                        placeholder="5"
                      />
                      <span className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                        XP
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Rule: Deducts {penaltyPoints || '5'} XP if studied less than {penaltyThresholdValue || '3'} {penaltyThresholdUnit}
                  </p>
                </div>

                {/* Custom Point Rules */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Additional Point Rules & Bonuses
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCustomRule}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Point Rule
                    </button>
                  </div>

                  {customRules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No custom rules. Click + Add Point Rule to create custom bonuses or penalties.</p>
                  ) : (
                    <div className="space-y-3">
                      {customRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Emoji Input */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] font-bold text-slate-400">Emoji</span>
                              <input
                                type="text"
                                value={rule.emoji || ''}
                                onChange={(e) => handleUpdateCustomRule(rule.id, 'emoji', e.target.value)}
                                placeholder="☀️"
                                className="w-11 h-9 text-center text-base bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              />
                            </div>

                            {/* Rule Name */}
                            <input
                              type="text"
                              value={rule.name}
                              onChange={(e) => handleUpdateCustomRule(rule.id, 'name', e.target.value)}
                              placeholder="Rule Name (e.g. 10hr zone)"
                              className="flex-1 min-w-[130px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />

                            {/* Condition Type Dropdown */}
                            <CustomSelect<YptRuleConditionType>
                              value={rule.conditionType || 'emoji_only'}
                              onChange={(val) => handleUpdateCustomRule(rule.id, 'conditionType', val)}
                              options={[
                                { value: 'emoji_only', label: 'Emoji Present Only' },
                                { value: 'hours_only', label: 'Min Hours Only' },
                                { value: 'both', label: 'Emoji AND Min Hours' },
                                { value: 'either', label: 'Emoji OR Min Hours' },
                              ]}
                            />

                            {/* Conditional Min Hours Input */}
                            {rule.conditionType && rule.conditionType !== 'emoji_only' && (
                              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={rule.minHoursNeeded || '10'}
                                  onChange={(e) => handleUpdateCustomRule(rule.id, 'minHoursNeeded', e.target.value)}
                                  placeholder="10"
                                  className="w-14 px-2 py-2 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                                />
                                <span className="pr-2 text-[10px] text-slate-400 font-bold uppercase">hrs</span>
                              </div>
                            )}

                            {/* Rule Type */}
                            <CustomSelect<'bonus' | 'penalty'>
                              value={rule.type}
                              onChange={(val) => handleUpdateCustomRule(rule.id, 'type', val)}
                              options={[
                                { value: 'bonus', label: 'Bonus (+)' },
                                { value: 'penalty', label: 'Penalty (-)' },
                              ]}
                            />

                            {/* Target Scope Dropdown */}
                            <CustomSelect<'individual' | 'team_all'>
                              value={rule.scope || 'individual'}
                              onChange={(val) => handleUpdateCustomRule(rule.id, 'scope', val)}
                              options={[
                                { value: 'individual', label: '👤 Individual' },
                                { value: 'team_all', label: '👥 Whole Team (100% Met)' },
                              ]}
                            />

                            {/* Points */}
                            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={rule.points}
                                onChange={(e) => handleUpdateCustomRule(rule.id, 'points', e.target.value)}
                                placeholder="XP"
                                className="w-14 px-2 py-2 text-xs bg-transparent dark:text-white font-bold text-center focus:outline-none"
                              />
                              <span className="pr-2 text-[10px] text-slate-400 font-bold uppercase">XP</span>
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomRule(rule.id)}
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quick Emoji Selector Pills & Inline Badge Preview */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
                              <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick Picker:</span>
                              {PRESET_EMOJIS.map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={() => handleSelectEmojiPreset(rule.id, e)}
                                  className={`w-7 h-7 flex items-center justify-center text-sm rounded-lg border transition-all shrink-0 ${
                                    rule.emoji === e
                                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500 scale-105 shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                                  }`}
                                  title={`Select ${e}`}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>

                            {/* Inline Badge Preview */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-xs">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Preview:</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs shadow-xs">
                                  {rule.emoji || '✨'}
                                </span>
                                <span className="truncate max-w-[120px]">{rule.name.trim() || 'Rule Name'}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  rule.type === 'bonus'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }`}>
                                  {rule.type === 'bonus' ? '+' : '-'}{rule.points || '0'} XP
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                  {getConditionLabel(rule)}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  rule.scope === 'team_all'
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                }`}>
                                  {rule.scope === 'team_all' ? 'Req: Whole Team (100%)' : 'Req: Individual'}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: TEAM ROSTERS */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>Team Rosters</span>
                </div>
                {teams.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddTeam}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Team
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {teams.map((t, index) => (
                  <div key={index} className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) => {
                          const newTeams = [...teams];
                          newTeams[index].color = e.target.value;
                          setTeams(newTeams);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                        title="Choose Team Color"
                      />
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => {
                          const newTeams = [...teams];
                          newTeams[index].name = e.target.value;
                          setTeams(newTeams);
                        }}
                        placeholder="Team Name"
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white font-bold"
                      />
                      {teams.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(index)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                          title="Remove Team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Team Leaders Selector */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                        <span>Team Leaders (👑 Leader Permissions)</span>
                      </label>
                      <YptMemberPicker
                        members={t.teamLeaders || []}
                        onChange={(newLeaders) => {
                          const newTeams = [...teams];
                          newTeams[index].teamLeaders = newLeaders;
                          // Auto-add leaders into memberUids if not present
                          const currentMembers = newTeams[index].memberUids;
                          const updatedMembers = [...currentMembers];
                          newLeaders.forEach((leader) => {
                            if (!updatedMembers.some((m) => m.toLowerCase() === leader.toLowerCase())) {
                              updatedMembers.push(leader);
                            }
                          });
                          newTeams[index].memberUids = updatedMembers;
                          setTeams(newTeams);
                        }}
                        knownYptNames={knownYptNames}
                        placeholder="Type YPT handle to assign team leader..."
                        badgeStyle="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/80 shadow-xs"
                        badgeIcon={<Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                      />
                    </div>

                    {/* Team Members Selector */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Team Members (Type YPT handle to auto-complete)
                      </label>
                      <YptMemberPicker
                        members={t.memberUids}
                        onChange={(newMembers) => {
                          const newTeams = [...teams];
                          newTeams[index].memberUids = newMembers;
                          if (newTeams[index].teamLeaders) {
                            newTeams[index].teamLeaders = newTeams[index].teamLeaders?.filter((l) =>
                              newMembers.some((m) => m.toLowerCase() === l.toLowerCase())
                            );
                          }
                          setTeams(newTeams);
                        }}
                        knownYptNames={knownYptNames}
                        leaderHandles={t.teamLeaders}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-end gap-3 p-4 px-6 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving...'
                : challengeToEdit
                ? 'Save Changes'
                : 'Launch YPT Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
