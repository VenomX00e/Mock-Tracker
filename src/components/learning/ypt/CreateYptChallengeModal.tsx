import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Award, ShieldAlert, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  YptRuleConfig,
  YptTeam,
  YptRuleConditionType,
  YptChallengeScope,
  YptChallengeMode,
  YptTeamMemberRef,
  YptApiGroup,
  YptApiMember,
  YptApiNativeChallenge,
  YptChallenge,
} from '../../../types/yptTypes';
import {
  createYptChallenge,
  updateYptChallenge,
  getAllKnownYptNames,
  fetchYptGroups,
  fetchYptRoster,
} from '../../../services/yptService';
import { getYmdFromDateOrString } from '../../../utils/yptUtils';
import { useAuthCtx } from '../../../context/AppContext';
import { getTodayYmd, addDaysToYmd, calcDaysBetweenYmd } from './create-challenge/CustomSelect';
import { ChallengeModeScopeStep, ChallengeBasicInfoSection } from './create-challenge/ChallengeBasicInfoSection';
import { ChallengeRulesBuilderSection, CustomRuleFormItem } from './create-challenge/ChallengeRulesBuilderSection';
import { ChallengeTeamsBuilderSection, TeamDraftItem } from './create-challenge/ChallengeTeamsBuilderSection';

interface CreateYptChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  challengeToEdit?: YptChallenge | null;
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

  const [customRules, setCustomRules] = useState<CustomRuleFormItem[]>([
    { id: 'rule_1', name: 'Morning Snap Bonus', emoji: '☀️', points: '5', type: 'bonus', conditionType: 'emoji_only', minHoursNeeded: '10', scope: 'individual' }
  ]);

  // Teams
  const [teams, setTeams] = useState<TeamDraftItem[]>([
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
          setAvailableYptGroups((prev) => {
            const map = new Map<number, YptApiGroup>();
            groups.forEach((g) => map.set(Number(g.id), g));
            prev.forEach((g) => {
              if (!map.has(Number(g.id))) map.set(Number(g.id), g);
            });
            return Array.from(map.values());
          });
          setIsDemoGroups(Boolean(isDemo));
          if (!challengeToEdit && groups.length > 0) {
            setSelectedGroupIds((prev) => (prev.length === 0 ? [Number(groups[0].id)] : prev));
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

        // Robust extraction from all possible group ID properties (targetGroupIds, groupIds, yptGroupId, groups)
        const legacyGroupIds = [
          ...(challengeToEdit.targetGroupIds || []),
          ...((challengeToEdit as any).groupIds || []),
          ...((challengeToEdit as any).yptGroupId ? [(challengeToEdit as any).yptGroupId] : []),
          ...(((challengeToEdit as any).groups || []).map((g: any) => g.id || g.gid || g)),
        ]
          .map((id: any) => Number(id))
          .filter((id: number) => !isNaN(id) && id > 0);

        const resolvedGroupIds = Array.from(new Set(legacyGroupIds));
        setSelectedGroupIds(resolvedGroupIds);

        // Pre-populate availableYptGroups if challenge has group titles stored
        if ((challengeToEdit as any).groups && Array.isArray((challengeToEdit as any).groups)) {
          const chGroups: YptApiGroup[] = (challengeToEdit as any).groups.map((cg: any) => ({
            id: Number(cg.id || cg.gid),
            t: cg.title || cg.name || cg.t || `Group ${cg.id}`,
            jc: 0,
            mc: 0,
          })).filter((g: any) => !isNaN(g.id) && g.id > 0);
          if (chGroups.length > 0) {
            setAvailableYptGroups((prev) => {
              const existingIds = new Set(prev.map((g) => Number(g.id)));
              const toAdd = chGroups.filter((cg) => !existingIds.has(cg.id));
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
          }
        }

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

  const toggleGroupSelection = (groupId: number | string) => {
    const numericGid = Number(groupId);
    if (isNaN(numericGid) || numericGid <= 0) return;
    if (scope === 'inner') {
      setSelectedGroupIds([numericGid]);
    } else {
      setSelectedGroupIds((prev) => {
        const exists = prev.some((id) => Number(id) === numericGid);
        if (exists) {
          if (prev.length > 1) {
            return prev.filter((id) => Number(id) !== numericGid);
          }
          return prev;
        } else {
          return [...prev, numericGid];
        }
      });
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
        groupIds: selectedGroupIds,
        yptGroupId: selectedGroupIds[0] || null,
        groups: selectedGroupIds.map((gid) => {
          const matched = availableYptGroups.find((g) => Number(g.id) === Number(gid));
          return { id: Number(gid), title: matched?.t || `Group ${gid}`, name: matched?.t || `Group ${gid}` };
        }),
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
              <ChallengeModeScopeStep
                challengeMode={challengeMode}
                setChallengeMode={setChallengeMode}
                scope={scope}
                setScope={setScope}
                setSelectedGroupIds={setSelectedGroupIds}
                availableYptGroups={availableYptGroups}
              />
            )}

            {/* STEP 2: GROUPS, DATES & RULES */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <ChallengeBasicInfoSection
                  challengeToEdit={challengeToEdit}
                  scope={scope}
                  isDemoGroups={isDemoGroups}
                  showYptCredsForm={showYptCredsForm}
                  setShowYptCredsForm={setShowYptCredsForm}
                  yptEmailInput={yptEmailInput}
                  setYptEmailInput={setYptEmailInput}
                  yptPasswordInput={yptPasswordInput}
                  setYptPasswordInput={setYptPasswordInput}
                  yptTokenInput={yptTokenInput}
                  setYptTokenInput={setYptTokenInput}
                  credsSaveMessage={credsSaveMessage}
                  setCredsSaveMessage={setCredsSaveMessage}
                  yptAuthError={yptAuthError}
                  setYptAuthError={setYptAuthError}
                  setIsLoadingGroups={setIsLoadingGroups}
                  setAvailableYptGroups={setAvailableYptGroups}
                  setIsDemoGroups={setIsDemoGroups}
                  setSelectedGroupIds={setSelectedGroupIds}
                  isLoadingGroups={isLoadingGroups}
                  availableYptGroups={availableYptGroups}
                  selectedGroupIds={selectedGroupIds}
                  toggleGroupSelection={toggleGroupSelection}
                  showAddCustomGroup={showAddCustomGroup}
                  setShowAddCustomGroup={setShowAddCustomGroup}
                  customGroupIdInput={customGroupIdInput}
                  setCustomGroupIdInput={setCustomGroupIdInput}
                  customGroupTitleInput={customGroupTitleInput}
                  setCustomGroupTitleInput={setCustomGroupTitleInput}
                  nativeChallenges={nativeChallenges}
                  selectedNativeChallengeId={selectedNativeChallengeId}
                  setSelectedNativeChallengeId={setSelectedNativeChallengeId}
                  title={title}
                  setTitle={setTitle}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  duration={duration}
                  setDuration={setDuration}
                  endDate={endDate}
                  setEndDate={setEndDate}
                />

                <ChallengeRulesBuilderSection
                  studyIntervalValue={studyIntervalValue}
                  setStudyIntervalValue={setStudyIntervalValue}
                  studyIntervalUnit={studyIntervalUnit}
                  setStudyIntervalUnit={setStudyIntervalUnit}
                  pointsPerInterval={pointsPerInterval}
                  setPointsPerInterval={setPointsPerInterval}
                  penaltyThresholdValue={penaltyThresholdValue}
                  setPenaltyThresholdValue={setPenaltyThresholdValue}
                  penaltyThresholdUnit={penaltyThresholdUnit}
                  setPenaltyThresholdUnit={setPenaltyThresholdUnit}
                  penaltyPoints={penaltyPoints}
                  setPenaltyPoints={setPenaltyPoints}
                  maxContinuousHoursThreshold={maxContinuousHoursThreshold}
                  setMaxContinuousHoursThreshold={setMaxContinuousHoursThreshold}
                  maxContinuousPenaltyType={maxContinuousPenaltyType}
                  setMaxContinuousPenaltyType={setMaxContinuousPenaltyType}
                  maxContinuousPenaltyMode={maxContinuousPenaltyMode}
                  setMaxContinuousPenaltyMode={setMaxContinuousPenaltyMode}
                  maxContinuousPenaltyMultiplier={maxContinuousPenaltyMultiplier}
                  setMaxContinuousPenaltyMultiplier={setMaxContinuousPenaltyMultiplier}
                  maxContinuousFixedPenalty={maxContinuousFixedPenalty}
                  setMaxContinuousFixedPenalty={setMaxContinuousFixedPenalty}
                  customRules={customRules}
                  handleAddCustomRule={handleAddCustomRule}
                  handleRemoveCustomRule={handleRemoveCustomRule}
                  handleUpdateCustomRule={handleUpdateCustomRule}
                  handleSelectNativeChallengePreset={handleSelectNativeChallengePreset}
                  handleSelectEmojiPreset={handleSelectEmojiPreset}
                  nativeChallenges={nativeChallenges}
                  isLoadingRoster={isLoadingRoster}
                  reloadRosterAndChallenges={reloadRosterAndChallenges}
                />
              </div>
            )}

            {/* STEP 3: SOLO OR TEAM ROSTER PICKER */}
            {currentStep === 3 && (
              <ChallengeTeamsBuilderSection
                challengeMode={challengeMode}
                selectedParticipantUds={selectedParticipantUds}
                allAvailableRoster={allAvailableRoster}
                filteredRoster={filteredRoster}
                handleSelectAllParticipants={handleSelectAllParticipants}
                handleDeselectAllParticipants={handleDeselectAllParticipants}
                participantSearchQuery={participantSearchQuery}
                setParticipantSearchQuery={setParticipantSearchQuery}
                customParticipantNameInput={customParticipantNameInput}
                setCustomParticipantNameInput={setCustomParticipantNameInput}
                handleAddCustomParticipant={handleAddCustomParticipant}
                isLoadingRoster={isLoadingRoster}
                handleToggleParticipant={handleToggleParticipant}
                liveRoster={liveRoster}
                teams={teams}
                setTeams={setTeams}
                handleAddTeam={handleAddTeam}
                handleRemoveTeam={handleRemoveTeam}
                knownYptNames={knownYptNames}
                handleAutoSplitTeams={handleAutoSplitTeams}
              />
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
