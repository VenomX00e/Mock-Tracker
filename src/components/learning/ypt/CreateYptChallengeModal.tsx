import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Award, Clock, Users, ShieldAlert, Sparkles, Crown, ChevronDown, Check, Building2, Swords, ChevronRight, ChevronLeft, RefreshCw, Image, Zap, Lock, User, UserCheck, CheckSquare, Square, Search } from 'lucide-react';
import { YptRuleConfig, YptTeam, YptRuleConditionType, YptChallengeScope, YptChallengeMode, YptTeamMemberRef, YptApiGroup, YptApiMember, YptApiNativeChallenge, YptChallenge } from '../../../types/yptTypes';
import { createYptChallenge, updateYptChallenge, getAllKnownYptNames, fetchYptGroups, fetchYptRoster, saveYptCredentials, clearYptCredentials } from '../../../services/yptService';
import { getYmdFromDateOrString } from '../../../utils/yptUtils';
import { useAuthCtx } from '../../../context/AppContext';
import { YptMemberPicker } from './YptMemberPicker';

interface CustomSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string | number> {
  value: T;
  onChange: (val: T) => void;
  options: CustomSelectOption<T>[];
  className?: string;
}

function CustomSelect<T extends string | number>({
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
        <div className="absolute left-0 mt-1.5 min-w-[150px] w-max max-w-[280px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
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

  // Wizard Step Control (1: Scope, 2: Groups & Rules, 3: Teams & Roster)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Scope & Group selection
  const [scope, setScope] = useState<YptChallengeScope>('inner');
  const [challengeMode, setChallengeMode] = useState<YptChallengeMode>('team');
  const [availableYptGroups, setAvailableYptGroups] = useState<YptApiGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isDemoGroups, setIsDemoGroups] = useState(false);
  const [showYptCredsForm, setShowYptCredsForm] = useState(false);
  const [yptEmailInput, setYptEmailInput] = useState(() => localStorage.getItem('ypt_email') || '');
  const [yptPasswordInput, setYptPasswordInput] = useState(() => localStorage.getItem('ypt_password') || '');
  const [yptTokenInput, setYptTokenInput] = useState(() => localStorage.getItem('ypt_token') || '');
  const [yptAuthError, setYptAuthError] = useState<string | null>(null);
  const [credsSaveMessage, setCredsSaveMessage] = useState<string | null>(null);

  // Manual Custom Group Entry
  const [showAddCustomGroup, setShowAddCustomGroup] = useState(false);
  const [customGroupIdInput, setCustomGroupIdInput] = useState('');
  const [customGroupTitleInput, setCustomGroupTitleInput] = useState('');
  const [liveRoster, setLiveRoster] = useState<YptApiMember[]>([]);
  const [nativeChallenges, setNativeChallenges] = useState<YptApiNativeChallenge[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [selectedNativeChallengeId, setSelectedNativeChallengeId] = useState<number | undefined>(undefined);

  // Solo / Individual Mode Participants Selection State
  const [selectedParticipantUds, setSelectedParticipantUds] = useState<number[]>([]);
  const [customParticipantsList, setCustomParticipantsList] = useState<YptTeamMemberRef[]>([]);
  const [customParticipantNameInput, setCustomParticipantNameInput] = useState('');
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');

  // Basic Challenge Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Rule Configurator
  const [studyIntervalValue, setStudyIntervalValue] = useState('30');
  const [studyIntervalUnit, setStudyIntervalUnit] = useState<'minutes' | 'hours'>('minutes');
  const [pointsPerInterval, setPointsPerInterval] = useState('1');

  const [penaltyThresholdValue, setPenaltyThresholdValue] = useState('3');
  const [penaltyThresholdUnit, setPenaltyThresholdUnit] = useState<'hours' | 'minutes'>('hours');
  const [penaltyPoints, setPenaltyPoints] = useState('5');

  // Continuous Session Limits (Fake Session Trap)
  const [maxContinuousHoursThreshold, setMaxContinuousHoursThreshold] = useState('4');
  const [maxContinuousPenaltyType, setMaxContinuousPenaltyType] = useState<'variable' | 'fixed'>('variable');
  const [maxContinuousPenaltyMode, setMaxContinuousPenaltyMode] = useState<'excess' | 'whole'>('excess');
  const [maxContinuousPenaltyMultiplier, setMaxContinuousPenaltyMultiplier] = useState('2');
  const [maxContinuousFixedPenalty, setMaxContinuousFixedPenalty] = useState('10');

  const [customRules, setCustomRules] = useState<
    Array<{
      id: string;
      name: string;
      emoji?: string;
      nativeChallengeId?: number;
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

  // Fetch joined YPT groups on modal load
  useEffect(() => {
    if (isOpen) {
      setIsLoadingGroups(true);
      fetchYptGroups()
        .then(({ groups, isDemo }) => {
          setAvailableYptGroups(groups);
          setIsDemoGroups(Boolean(isDemo));
          if (groups.length > 0 && selectedGroupIds.length === 0) {
            setSelectedGroupIds([groups[0].id]);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch live YPT groups:', err);
        })
        .finally(() => setIsLoadingGroups(false));

      getAllKnownYptNames().then((names) => {
        setKnownYptNames(names);
      }).catch((err) => {
        console.warn('Failed to load known YPT names:', err);
      });

      if (challengeToEdit) {
        setTitle(challengeToEdit.title || '');
        setDescription(challengeToEdit.description || '');
        setScope(challengeToEdit.scope || 'inner');
        setChallengeMode(challengeToEdit.mode || 'team');
        setSelectedGroupIds(challengeToEdit.targetGroupIds || []);
        setSelectedNativeChallengeId(challengeToEdit.nativeYptChallengeId);

        let sYmd = getTodayYmd();
        if (challengeToEdit.startDate) {
          sYmd = getYmdFromDateOrString(challengeToEdit.startDate) || getTodayYmd();
        }
        let eYmd = addDaysToYmd(sYmd, 7);
        if (challengeToEdit.endDate) {
          eYmd = getYmdFromDateOrString(challengeToEdit.endDate) || addDaysToYmd(sYmd, 7);
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
          if (r.maxContinuousHoursThreshold !== undefined && r.maxContinuousHoursThreshold !== null) {
            setMaxContinuousHoursThreshold(String(r.maxContinuousHoursThreshold));
          } else {
            setMaxContinuousHoursThreshold('4');
          }
          if (r.maxContinuousPenaltyType) {
            setMaxContinuousPenaltyType(r.maxContinuousPenaltyType);
          } else {
            setMaxContinuousPenaltyType('variable');
          }
          if (r.maxContinuousPenaltyMode) {
            setMaxContinuousPenaltyMode(r.maxContinuousPenaltyMode);
          } else {
            setMaxContinuousPenaltyMode('excess');
          }
          if (r.maxContinuousPenaltyMultiplier !== undefined && r.maxContinuousPenaltyMultiplier !== null) {
            setMaxContinuousPenaltyMultiplier(String(r.maxContinuousPenaltyMultiplier));
          } else {
            setMaxContinuousPenaltyMultiplier('2');
          }
          if (r.maxContinuousFixedPenalty !== undefined && r.maxContinuousFixedPenalty !== null) {
            setMaxContinuousFixedPenalty(String(r.maxContinuousFixedPenalty));
          } else {
            setMaxContinuousFixedPenalty('10');
          }
          if (r.customRules && r.customRules.length > 0) {
            setCustomRules(
              r.customRules.map((cr) => ({
                id: cr.id,
                name: cr.name,
                emoji: cr.emoji || '☀️',
                nativeChallengeId: cr.nativeChallengeId,
                points: String(cr.points),
                type: cr.type,
                conditionType: cr.conditionType || 'emoji_only',
                minHoursNeeded: cr.minHoursNeeded !== undefined ? String(cr.minHoursNeeded) : '10',
                scope: cr.scope || 'individual',
              }))
            );
          }
        }

        if (challengeToEdit.participants && challengeToEdit.participants.length > 0) {
          setCustomParticipantsList(challengeToEdit.participants);
          setSelectedParticipantUds(challengeToEdit.participants.map((p) => p.yptUd));
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
        setCurrentStep(2);
      } else {
        setChallengeMode('team');
        setCurrentStep(1);
      }
    } else {
      setCurrentStep(1);
    }
  }, [isOpen, challengeToEdit]);

  const reloadRosterAndChallenges = (gids = selectedGroupIds) => {
    if (gids.length > 0) {
      setIsLoadingRoster(true);
      fetchYptRoster(gids)
        .then(({ roster, nativeChallenges }) => {
          setLiveRoster(roster);
          setNativeChallenges(nativeChallenges);
          // Auto-select all live roster members if not yet selected and not editing
          if (!challengeToEdit) {
            setSelectedParticipantUds((prev) => {
              const newUds = new Set([...prev, ...roster.map((m) => m.ud)]);
              return Array.from(newUds);
            });
          }
        })
        .catch((err) => {
          console.warn('Failed to load YPT roster for groups:', err);
        })
        .finally(() => {
          setIsLoadingRoster(false);
        });
    }
  };

  // Fetch member roster whenever selected YPT group IDs change
  useEffect(() => {
    if (selectedGroupIds.length > 0) {
      reloadRosterAndChallenges(selectedGroupIds);
    }
  }, [selectedGroupIds]);

  if (!isOpen) return null;

  const toggleGroupSelection = (groupId: number) => {
    if (scope === 'inner') {
      setSelectedGroupIds([groupId]);
    } else {
      if (selectedGroupIds.includes(groupId)) {
        if (selectedGroupIds.length > 1) {
          setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId));
        }
      } else {
        setSelectedGroupIds([...selectedGroupIds, groupId]);
      }
    }
  };

  const handleAutoSplitTeams = () => {
    if (liveRoster.length === 0) return;

    if (scope === 'inter' && availableYptGroups.length >= 2) {
      // Create a team per YPT Group
      const newTeams = selectedGroupIds.map((gid, idx) => {
        const groupObj = availableYptGroups.find((g) => g.id === gid);
        const groupName = groupObj?.t || `Group ${gid}`;
        const colorPalette = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
        
        return {
          name: groupName,
          color: colorPalette[idx % colorPalette.length],
          memberUids: liveRoster.map((m) => m.n), // All members currently in live roster
          teamLeaders: [],
        };
      });

      if (newTeams.length >= 2) {
        setTeams(newTeams);
        return;
      }
    }

    // Default Inner-Group split: balance members across existing teams
    const membersToDistribute = liveRoster.map((m) => m.n);
    const numTeams = teams.length;
    const updatedTeams = teams.map((t) => ({ ...t, memberUids: [] as string[] }));

    membersToDistribute.forEach((handle, i) => {
      const teamIdx = i % numTeams;
      updatedTeams[teamIdx].memberUids.push(handle);
    });

    setTeams(updatedTeams);
  };

  // Solo / Individual mode roster helpers
  const allAvailableRoster: Array<{ ud: number; n: string; dl?: { is?: boolean; sm?: number } }> = [
    ...liveRoster.map((m) => ({ ud: m.ud, n: m.n, dl: m.dl })),
    ...customParticipantsList
      .filter((cp) => !liveRoster.some((m) => m.ud === cp.yptUd))
      .map((cp) => ({ ud: cp.yptUd, n: cp.yptHandle, dl: undefined })),
  ];

  const filteredRoster = allAvailableRoster.filter((m) => {
    if (!participantSearchQuery.trim()) return true;
    const q = participantSearchQuery.toLowerCase();
    return m.n.toLowerCase().includes(q) || String(m.ud).includes(q);
  });

  const handleToggleParticipant = (ud: number) => {
    if (selectedParticipantUds.includes(ud)) {
      setSelectedParticipantUds(selectedParticipantUds.filter((id) => id !== ud));
    } else {
      setSelectedParticipantUds([...selectedParticipantUds, ud]);
    }
  };

  const handleSelectAllParticipants = () => {
    const allUds = allAvailableRoster.map((m) => m.ud);
    setSelectedParticipantUds(allUds);
  };

  const handleDeselectAllParticipants = () => {
    setSelectedParticipantUds([]);
  };

  const handleAddCustomParticipant = () => {
    const cleanName = customParticipantNameInput.trim();
    if (!cleanName) return;

    const existing = allAvailableRoster.find(
      (m) => m.n.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      if (!selectedParticipantUds.includes(existing.ud)) {
        setSelectedParticipantUds([...selectedParticipantUds, existing.ud]);
      }
      setCustomParticipantNameInput('');
      return;
    }

    const pseudoUd = Math.floor(10000000 + Math.random() * 90000000);
    const newMember: YptTeamMemberRef = {
      yptUd: pseudoUd,
      yptHandle: cleanName,
    };
    setCustomParticipantsList((prev) => [...prev, newMember]);
    setSelectedParticipantUds((prev) => [...prev, pseudoUd]);
    setCustomParticipantNameInput('');
  };

  const PRESET_EMOJIS = ['☀️', '🌻', '📱', '🔟', '🔥', '🎯', '⏰', '🏆', '⚡', '🏞️', '📑'];

  const getConditionLabel = (rule: { conditionType?: YptRuleConditionType; minHoursNeeded?: string }) => {
    const cond = rule.conditionType || 'emoji_only';
    const hrs = rule.minHoursNeeded || '10';
    switch (cond) {
      case 'hours_only':
        return `Req: ≥${hrs}h`;
      case 'both':
        return `Req: Mission + ≥${hrs}h`;
      case 'either':
        return `Req: Mission or ≥${hrs}h`;
      case 'emoji_only':
      default:
        return `Req: Mission / Emoji`;
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
    field: 'name' | 'emoji' | 'points' | 'type' | 'conditionType' | 'minHoursNeeded' | 'scope' | 'nativeChallengeId',
    value: any
  ) => {
    setCustomRules(
      customRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSelectNativeChallengePreset = (ruleId: string, nc: YptApiNativeChallenge) => {
    setCustomRules(
      customRules.map((r) => {
        if (r.id !== ruleId) return r;
        return {
          ...r,
          name: nc.t || r.name || 'Photo Mission Bonus',
          emoji: nc.e || '📸',
          nativeChallengeId: nc.id,
          conditionType: r.conditionType || 'emoji_only',
        };
      })
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

  const handleNextStep = () => {
    setError('');
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!title.trim()) {
        setError('Please enter a challenge title.');
        return;
      }
      if (selectedGroupIds.length === 0) {
        setError('Please select at least one YPT group.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e?: React.SyntheticEvent, forceSave = false) => {
    if (e) e.preventDefault();
    setError('');

    if (!forceSave && currentStep < 3 && !challengeToEdit) {
      handleNextStep();
      return;
    }

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
      const finalStartDate = startDate || getTodayYmd();
      const finalEndDate = endDate || addDaysToYmd(finalStartDate, 7);

      const intervalVal = parseFloat(studyIntervalValue) || 30;
      const ptsInterval = parseFloat(pointsPerInterval) || 1;
      const intervalInHours = studyIntervalUnit === 'minutes' ? (intervalVal / 60) : intervalVal;
      const derivedPointsPerHour = intervalInHours > 0 ? (ptsInterval / intervalInHours) : ptsInterval;

      const penVal = parseFloat(penaltyThresholdValue) || 3;
      const penInHours = penaltyThresholdUnit === 'minutes' ? (penVal / 60) : penVal;

      const maxContThresh = parseFloat(maxContinuousHoursThreshold);
      const maxContMult = parseFloat(maxContinuousPenaltyMultiplier);
      const maxContFixed = parseFloat(maxContinuousFixedPenalty);

      const rules: YptRuleConfig = {
        pointsPerStudyHour: derivedPointsPerHour,
        studyIntervalValue: intervalVal,
        studyIntervalUnit,
        pointsPerInterval: ptsInterval,
        penaltyThresholdValue: penVal,
        penaltyThresholdUnit,
        noStudyPenaltyThresholdHours: penInHours,
        penaltyPoints: parseFloat(penaltyPoints) || 5,
        maxContinuousHoursThreshold: !isNaN(maxContThresh) ? maxContThresh : 4,
        maxContinuousPenaltyType,
        maxContinuousPenaltyMode,
        maxContinuousPenaltyMultiplier: !isNaN(maxContMult) ? maxContMult : 2,
        maxContinuousFixedPenalty: !isNaN(maxContFixed) ? maxContFixed : 10,
        customRules: customRules
          .filter((r) => r.name.trim().length > 0)
          .map((r) => {
            const ruleObj: any = {
              id: r.id,
              name: r.name.trim(),
              points: parseFloat(r.points) || 0,
              type: r.type,
              conditionType: r.conditionType || 'emoji_only',
              scope: r.scope || 'individual',
            };
            if (r.emoji && r.emoji.trim()) {
              ruleObj.emoji = r.emoji.trim();
            }
            if (r.nativeChallengeId !== undefined && r.nativeChallengeId !== null && !isNaN(Number(r.nativeChallengeId))) {
              ruleObj.nativeChallengeId = Number(r.nativeChallengeId);
            }
            if (r.conditionType && r.conditionType !== 'emoji_only') {
              ruleObj.minHoursNeeded = parseFloat(r.minHoursNeeded || '10') || 0;
            }
            return ruleObj;
          }),
      };

      let finalTeams: YptTeam[] = [];
      let finalParticipants: YptTeamMemberRef[] = [];

      if (challengeMode === 'individual') {
        const participantMap = new Map<number, YptTeamMemberRef>();
        
        // Add selected from live roster
        liveRoster.forEach((m) => {
          if (selectedParticipantUds.includes(m.ud)) {
            participantMap.set(m.ud, {
              yptUd: m.ud,
              yptHandle: m.n,
            });
          }
        });

        // Add selected from custom participants
        customParticipantsList.forEach((cp) => {
          if (selectedParticipantUds.includes(cp.yptUd)) {
            participantMap.set(cp.yptUd, cp);
          }
        });

        finalParticipants = Array.from(participantMap.values());

        if (finalParticipants.length === 0) {
          setError('Please select at least one participating member for the solo challenge.');
          setIsSubmitting(false);
          return;
        }
      } else {
        finalTeams = teams.map((t, idx) => ({
          id: t.id || `team_${idx}_${Date.now()}`,
          name: t.name.trim() || `Team ${idx + 1}`,
          color: t.color,
          memberUids: t.memberUids.map((s) => s.trim()).filter(Boolean),
          teamLeaders: (t.teamLeaders || []).map((s) => s.trim()).filter(Boolean),
          totalPoints: t.totalPoints || 0,
        }));
      }

      const challengePayload = {
        title: title.trim(),
        description: description.trim(),
        startDate: finalStartDate,
        endDate: finalEndDate,
        scope,
        mode: challengeMode,
        targetGroupIds: selectedGroupIds,
        nativeYptChallengeId: selectedNativeChallengeId,
        rules,
        teams: finalTeams,
        participants: finalParticipants,
      };

      if (challengeToEdit) {
        await updateYptChallenge(challengeToEdit.id, challengePayload);
      } else {
        await createYptChallenge({
          ...challengePayload,
          leaderUid: user.uid,
          status: 'active',
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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col z-10 my-auto"
      >
        {/* Top Banner Header with Wizard Stepper */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent dark:from-indigo-950/40 dark:via-indigo-950/10 dark:to-transparent border-b border-slate-100 dark:border-slate-800/80 shrink-0 select-none">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>
                {challengeToEdit
                  ? `STEP ${currentStep === 2 ? 1 : 2} OF 2`
                  : `STEP ${currentStep} OF 3`}
              </span>
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

          {/* Stepper Progress Bar */}
          {challengeToEdit ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 2 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 3 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 1 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 2 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 3 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>
          )}

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {challengeToEdit ? (
              currentStep === 2 ? 'Challenge Rules & Settings' : (challengeMode === 'individual' ? 'Solo Participant Selection' : 'Team Rosters & Member Assignment')
            ) : (
              currentStep === 1 ? 'Select Challenge Mode & Scope' :
              currentStep === 2 ? 'Group & Point Rules Configuration' :
              (challengeMode === 'individual' ? 'Solo Participant Roster' : 'Team Roster & Direct Member Assignment')
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {challengeToEdit ? (
              currentStep === 2 ? 'Update study intervals, threshold penalties, point rules, missions, and challenge dates.' :
              (challengeMode === 'individual' ? 'Select or remove participating members from the solo leaderboard.' : 'Reassign members across teams, designate team leaders, or update team configurations.')
            ) : (
              currentStep === 1 ? 'Choose between Team Battle or Solo Royale, and select single or multi-group scope.' :
              currentStep === 2 ? 'Select target YPT groups, linked photo challenge, dates, and point rules.' :
              (challengeMode === 'individual' ? 'Select participating members from your YPT group for the individual leaderboard.' : 'Pick members directly from live YPT group rosters or auto-balance teams.')
            )}
          </p>
        </div>

        {/* Modal Form Container */}
        <form 
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-center gap-2.5 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: MODE & SCOPE SELECTION CARDS */}
            {currentStep === 1 && (
              <div className="space-y-6 py-2">
                {/* 1. Competition Format: Team vs Solo */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    1. Competition Format (Mode) *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Team Battle Card */}
                    <div
                      onClick={() => setChallengeMode('team')}
                      className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        challengeMode === 'team'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>🧑‍🤝‍🧑 Team Battle</span>
                          {challengeMode === 'team' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Divide members into competing squads with custom team names, colors, and assigned team leaders.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Squad vs Squad</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Solo Royale Card */}
                    <div
                      onClick={() => setChallengeMode('individual')}
                      className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        challengeMode === 'individual'
                          ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 dark:border-amber-400 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <User className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>👤 Solo Royale (Individual)</span>
                          {challengeMode === 'individual' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Every member competes on an individual leaderboard. No teams needed—rank everyone by personal XP and study hours!
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <span>Individual Leaderboard</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Group Competition Scope */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    2. Group Competition Scope *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Inner-Group Card */}
                    <div
                      onClick={() => {
                        setScope('inner');
                        if (availableYptGroups.length > 0) {
                          setSelectedGroupIds([availableYptGroups[0].id]);
                        }
                      }}
                      className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        scope === 'inner'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>🏢 Inner-Group Challenge</span>
                          {scope === 'inner' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Compete within a single YPT study group. Perfect for internal guild challenges.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Single YPT Group</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Inter-Group War Card */}
                    <div
                      onClick={() => setScope('inter')}
                      className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        scope === 'inter'
                          ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-600 dark:border-purple-500 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          <Swords className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>⚔️ Inter-Group War</span>
                          {scope === 'inter' && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Pits multiple YPT study groups against each other in a Group vs. Group tournament!
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-purple-600 dark:text-purple-400">
                        <span>Multi-Group Tournament</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: GROUPS, DATES & RULES */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Fixed Scope Status Pill when editing */}
                {challengeToEdit && (
                  <div className="flex items-center justify-between p-3 px-4 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl select-none">
                    <div className="flex items-center gap-2.5">
                      {scope === 'inter' ? (
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          <Swords className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <Building2 className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {scope === 'inter' ? 'Inter-Group War Tournament' : 'Inner-Group Study Challenge'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Competition scope is permanently locked once started.
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-slate-500" /> Locked
                    </span>
                  </div>
                )}
                {/* Group Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Target YPT Group(s) *</span>
                      {isDemoGroups ? (
                        <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full font-bold">
                          Demo Mode
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live API Connected
                        </span>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowYptCredsForm(!showYptCredsForm)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{showYptCredsForm ? 'Hide Account Settings' : '🔑 Connect YPT Account'}</span>
                    </button>
                  </div>

                  {/* Inline YPT API Account Credentials Card */}
                  {showYptCredsForm && (
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-900/80 border border-indigo-500/30 rounded-2xl space-y-3 select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          🔑 Connect YPT Account (Live API Sync)
                        </span>
                        <span className="text-[10px] text-slate-500">Saved locally & encrypted</span>
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="email"
                            placeholder="YPT Account Email"
                            value={yptEmailInput}
                            onChange={(e) => setYptEmailInput(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                          />
                          <input
                            type="password"
                            placeholder="YPT Account Password"
                            value={yptPasswordInput}
                            onChange={(e) => setYptPasswordInput(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                          />
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                          <div className="relative flex justify-center text-[10px] uppercase font-bold"><span className="bg-slate-100 dark:bg-slate-900 px-2 text-slate-400">OR Direct YPT JWT Token</span></div>
                        </div>

                        <input
                          type="text"
                          placeholder="YPT JWT Access Token (Optional)"
                          value={yptTokenInput}
                          onChange={(e) => setYptTokenInput(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white font-mono"
                        />
                      </div>

                      {credsSaveMessage && (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{credsSaveMessage}</span>
                        </div>
                      )}

                      {yptAuthError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>YPT Authentication Failed</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">{yptAuthError}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              saveYptCredentials(yptEmailInput, yptPasswordInput, yptTokenInput);
                              setYptAuthError(null);
                              const isBlank = !yptEmailInput.trim() && !yptPasswordInput && !yptTokenInput.trim();
                              setCredsSaveMessage(isBlank ? 'Saved as blank (Optional / Server Env will be used)' : 'Saved locally');
                              setTimeout(() => setCredsSaveMessage(null), 3500);
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Save Settings (Keep Blank as Optional)</span>
                          </button>

                          {(yptEmailInput || yptPasswordInput || yptTokenInput) && (
                            <button
                              type="button"
                              onClick={() => {
                                setYptEmailInput('');
                                setYptPasswordInput('');
                                setYptTokenInput('');
                                clearYptCredentials();
                                setYptAuthError(null);
                                setCredsSaveMessage('Cleared & saved as blank (Optional)');
                                setTimeout(() => setCredsSaveMessage(null), 3500);
                              }}
                              className="px-2.5 py-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            >
                              Clear Fields
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            saveYptCredentials(yptEmailInput, yptPasswordInput, yptTokenInput);
                            setIsLoadingGroups(true);
                            setYptAuthError(null);
                            fetchYptGroups({ email: yptEmailInput, password: yptPasswordInput, token: yptTokenInput })
                              .then(({ groups, isDemo }) => {
                                setAvailableYptGroups(groups);
                                setIsDemoGroups(Boolean(isDemo));
                                setYptAuthError(null);
                                if (groups.length > 0 && selectedGroupIds.length === 0) {
                                  setSelectedGroupIds([groups[0].id]);
                                }
                              })
                              .catch((err) => {
                                setYptAuthError(err.message || 'YPT Authentication failed.');
                              })
                              .finally(() => setIsLoadingGroups(false));
                          }}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          <span>Connect & Fetch Live Groups</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoadingGroups ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs text-slate-400 animate-pulse">
                      Loading YPT groups from API...
                    </div>
                  ) : availableYptGroups.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs space-y-2">
                      <div>No YPT groups auto-fetched. Click <strong>🔑 Connect YPT Account</strong> to enter your YPT credentials/token, or add your YPT Group ID manually below.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {availableYptGroups.map((g) => {
                        const isSelected = selectedGroupIds.includes(g.id);
                        return (
                          <div
                            key={g.id}
                            onClick={() => toggleGroupSelection(g.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 font-bold'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="text-xs truncate max-w-[160px]">{g.t}</span>
                              <span className="text-[10px] text-slate-400">
                                ({g.jc !== undefined ? g.jc : g.mc}{g.mc && g.mc !== g.jc ? ` / ${g.mc}` : ''} members)
                              </span>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual Add Custom YPT Group Bar */}
                  <div className="pt-1">
                    {!showAddCustomGroup ? (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomGroup(true)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Custom YPT Group by ID or Name</span>
                      </button>
                    ) : (
                      <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-indigo-500" />
                          <span>Add Your YPT Group ID & Name</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="YPT Group ID (e.g. 331805)"
                            value={customGroupIdInput}
                            onChange={(e) => setCustomGroupIdInput(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Group Title (e.g. My Study Guild)"
                            value={customGroupTitleInput}
                            onChange={(e) => setCustomGroupTitleInput(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddCustomGroup(false)}
                            className="px-3 py-1 text-xs text-slate-500 font-bold hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const gid = parseInt(customGroupIdInput.trim(), 10) || Math.floor(100000 + Math.random() * 900000);
                              const title = customGroupTitleInput.trim() || `YPT Group ${gid}`;
                              const newGroup: YptApiGroup = { id: gid, t: title, mc: 1 };
                              setAvailableYptGroups((prev) => [...prev.filter((g) => g.id !== gid), newGroup]);
                              setSelectedGroupIds((prev) => Array.from(new Set([...prev, gid])));
                              setCustomGroupIdInput('');
                              setCustomGroupTitleInput('');
                              setShowAddCustomGroup(false);
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                          >
                            Add & Select Group
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional YPT Native Challenge Sync Dropdown */}
                {nativeChallenges.length > 0 && (
                  <div className="space-y-1.5 p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                    <label className="block text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" />
                      <span>Link Native YPT Photo Challenge (Optional Photo Verification)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <CustomSelect<number | string>
                        value={selectedNativeChallengeId || ''}
                        onChange={(val) => setSelectedNativeChallengeId(val ? Number(val) : undefined)}
                        options={[
                          { value: '', label: 'None (Manual / Study time only)' },
                          ...nativeChallenges.map((nc) => ({
                            value: nc.id,
                            label: `${nc.e || '📸'} ${nc.t} (ID: ${nc.id})`,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                )}

                {/* Basic Info Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Challenge Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Solo Leveling 7-Day Sprint"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium"
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
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        placeholder="Days"
                        value={duration}
                        onChange={(e) => {
                          setDuration(e.target.value);
                          if (startDate && e.target.value) {
                            setEndDate(addDaysToYmd(startDate, parseInt(e.target.value, 10)));
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Point Scoring Rules */}
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
                                    { value: 'emoji_only', label: 'Emoji Present Only' },
                                    { value: 'hours_only', label: 'Hours Met Only' },
                                    { value: 'both', label: 'Both (Emoji + Hours)' },
                                    { value: 'either', label: 'Either (Emoji or Hours)' },
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
              </div>
            )}

            {/* STEP 3 (INDIVIDUAL MODE): SOLO PARTICIPANT PICKER */}
            {currentStep === 3 && challengeMode === 'individual' && (
              <div className="space-y-5">
                {/* Header & Batch Selection Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                        Solo Competitors Roster
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedParticipantUds.length} of {allAvailableRoster.length} participants selected
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllParticipants}
                      className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors border border-amber-500/20 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllParticipants}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Search Bar & Manual Add Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={participantSearchQuery}
                      onChange={(e) => setParticipantSearchQuery(e.target.value)}
                      placeholder="Search live roster by name or ID..."
                      className="w-full pl-9.5 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customParticipantNameInput}
                      onChange={(e) => setCustomParticipantNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomParticipant();
                        }
                      }}
                      placeholder="Add custom handle..."
                      className="w-36 sm:w-44 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomParticipant}
                      className="px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Participant Checklist Grid */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {isLoadingRoster ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                      Loading group members from YPT API...
                    </div>
                  ) : filteredRoster.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      No members match your search or roster is empty.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredRoster.map((m) => {
                        const isSelected = selectedParticipantUds.includes(m.ud);
                        return (
                          <div
                            key={m.ud}
                            onClick={() => handleToggleParticipant(m.ud)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                              isSelected
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-sm'
                                : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                                  isSelected
                                    ? 'bg-amber-500 text-white'
                                    : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>

                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300 shrink-0">
                                {m.n.charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {m.n}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  #{m.ud}
                                </div>
                              </div>
                            </div>

                            {m.dl && (
                              <div className="shrink-0 text-right">
                                {m.dl.is ? (
                                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md">
                                    Studying
                                  </span>
                                ) : m.dl.sm !== undefined && m.dl.sm > 0 ? (
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {(m.dl.sm / 3600000).toFixed(1)}h
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3 (TEAM MODE): TEAMS & DIRECT MEMBER PICKER */}
            {currentStep === 3 && challengeMode === 'team' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>Teams & Live YPT Group Members ({liveRoster.length})</span>
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

                <div className="space-y-4">
                  {teams.map((t, index) => (
                    <div key={index} className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-3">
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
                          <span>Team Leaders</span>
                        </label>
                        <YptMemberPicker
                          members={t.teamLeaders || []}
                          onChange={(newLeaders) => {
                            const newTeams = [...teams];
                            newTeams[index].teamLeaders = newLeaders;
                            const updatedMembers = [...newTeams[index].memberUids];
                            newLeaders.forEach((leader) => {
                              if (!updatedMembers.some((m) => m.toLowerCase() === leader.toLowerCase())) {
                                updatedMembers.push(leader);
                              }
                            });
                            newTeams[index].memberUids = updatedMembers;
                            setTeams(newTeams);
                          }}
                          knownYptNames={knownYptNames}
                          liveRoster={liveRoster}
                          placeholder="Assign team leader..."
                          badgeStyle="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/80 shadow-xs"
                          badgeIcon={<Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                        />
                      </div>

                      {/* Team Members Selector with Live Roster Picker & Auto-Split */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          Team Members (Pick directly from live YPT roster)
                        </label>
                        <YptMemberPicker
                          members={t.memberUids}
                          onChange={(newMembers) => {
                            const newTeams = [...teams];
                            newTeams[index].memberUids = newMembers;
                            setTeams(newTeams);
                          }}
                          knownYptNames={knownYptNames}
                          liveRoster={liveRoster}
                          leaderHandles={t.teamLeaders}
                          teams={teams}
                          onAutoSplitTeams={index === 0 ? handleAutoSplitTeams : undefined}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER STEP NAVIGATION */}
          <div className="flex items-center justify-between p-4 px-6 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
            {(challengeToEdit ? currentStep > 2 : currentStep > 1) ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {challengeToEdit && currentStep < 3 && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : challengeToEdit
                    ? 'Save Changes'
                    : 'Launch YPT Challenge'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

