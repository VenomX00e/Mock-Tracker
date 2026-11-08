import React from 'react';
import {
  Plus,
  Users,
  ShieldAlert,
  Check,
  Building2,
  Swords,
  ChevronRight,
  Image,
  Zap,
  Lock,
  User,
} from 'lucide-react';
import {
  YptChallengeScope,
  YptChallengeMode,
  YptApiGroup,
  YptApiNativeChallenge,
  YptChallenge,
} from '../../../../types/yptTypes';
import {
  fetchYptGroups,
  saveYptCredentials,
  clearYptCredentials,
} from '../../../../services/yptService';
import { CustomSelect, addDaysToYmd } from './CustomSelect';

interface ChallengeModeScopeStepProps {
  challengeMode: YptChallengeMode;
  setChallengeMode: (mode: YptChallengeMode) => void;
  scope: YptChallengeScope;
  setScope: (scope: YptChallengeScope) => void;
  setSelectedGroupIds: React.Dispatch<React.SetStateAction<number[]>>;
  availableYptGroups: YptApiGroup[];
}

export function ChallengeModeScopeStep({
  challengeMode,
  setChallengeMode,
  scope,
  setScope,
  setSelectedGroupIds,
  availableYptGroups,
}: ChallengeModeScopeStepProps) {
  return (
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
              setSelectedGroupIds((prev) => {
                if (prev.length > 0) return [Number(prev[0])];
                if (availableYptGroups.length > 0) return [Number(availableYptGroups[0].id)];
                return prev;
              });
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
  );
}

interface ChallengeBasicInfoSectionProps {
  challengeToEdit?: YptChallenge | null;
  scope: YptChallengeScope;
  isDemoGroups: boolean;
  showYptCredsForm: boolean;
  setShowYptCredsForm: (val: boolean) => void;
  yptEmailInput: string;
  setYptEmailInput: (val: string) => void;
  yptPasswordInput: string;
  setYptPasswordInput: (val: string) => void;
  yptTokenInput: string;
  setYptTokenInput: (val: string) => void;
  credsSaveMessage: string | null;
  setCredsSaveMessage: (val: string | null) => void;
  yptAuthError: string | null;
  setYptAuthError: (val: string | null) => void;
  setIsLoadingGroups: (val: boolean) => void;
  setAvailableYptGroups: React.Dispatch<React.SetStateAction<YptApiGroup[]>>;
  setIsDemoGroups: (val: boolean) => void;
  setSelectedGroupIds: React.Dispatch<React.SetStateAction<number[]>>;
  isLoadingGroups: boolean;
  availableYptGroups: YptApiGroup[];
  selectedGroupIds: number[];
  toggleGroupSelection: (groupId: number | string) => void;
  showAddCustomGroup: boolean;
  setShowAddCustomGroup: (val: boolean) => void;
  customGroupIdInput: string;
  setCustomGroupIdInput: (val: string) => void;
  customGroupTitleInput: string;
  setCustomGroupTitleInput: (val: string) => void;
  nativeChallenges: YptApiNativeChallenge[];
  selectedNativeChallengeId: number | undefined;
  setSelectedNativeChallengeId: (val: number | undefined) => void;
  title: string;
  setTitle: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  duration: string;
  setDuration: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

export function ChallengeBasicInfoSection({
  challengeToEdit,
  scope,
  isDemoGroups,
  showYptCredsForm,
  setShowYptCredsForm,
  yptEmailInput,
  setYptEmailInput,
  yptPasswordInput,
  setYptPasswordInput,
  yptTokenInput,
  setYptTokenInput,
  credsSaveMessage,
  setCredsSaveMessage,
  yptAuthError,
  setYptAuthError,
  setIsLoadingGroups,
  setAvailableYptGroups,
  setIsDemoGroups,
  setSelectedGroupIds,
  isLoadingGroups,
  availableYptGroups,
  selectedGroupIds,
  toggleGroupSelection,
  showAddCustomGroup,
  setShowAddCustomGroup,
  customGroupIdInput,
  setCustomGroupIdInput,
  customGroupTitleInput,
  setCustomGroupTitleInput,
  nativeChallenges,
  selectedNativeChallengeId,
  setSelectedNativeChallengeId,
  title,
  setTitle,
  startDate,
  setStartDate,
  duration,
  setDuration,
  endDate,
  setEndDate,
}: ChallengeBasicInfoSectionProps) {
  return (
    <>
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
                      if (!challengeToEdit && groups.length > 0) {
                        setSelectedGroupIds((prev) => (prev.length === 0 ? [Number(groups[0].id)] : prev));
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
              const isSelected = selectedGroupIds.some((id) => Number(id) === Number(g.id));
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
                    const grpTitle = customGroupTitleInput.trim() || `YPT Group ${gid}`;
                    const newGroup: YptApiGroup = { id: gid, t: grpTitle, mc: 1 };
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
    </>
  );
}
