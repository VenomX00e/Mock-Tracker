import React from 'react';
import {
  Plus,
  Trash2,
  Users,
  Crown,
  Check,
  RefreshCw,
  User,
  Search,
} from 'lucide-react';
import { YptChallengeMode, YptApiMember } from '../../../../types/yptTypes';
import { YptMemberPicker } from '../YptMemberPicker';

export interface TeamDraftItem {
  id?: string;
  name: string;
  color: string;
  memberUids: string[];
  teamLeaders?: string[];
  totalPoints?: number;
}

interface ChallengeTeamsBuilderSectionProps {
  challengeMode: YptChallengeMode;
  selectedParticipantUds: number[];
  allAvailableRoster: Array<{ ud: number; n: string; dl?: { is?: boolean; sm?: number } }>;
  filteredRoster: Array<{ ud: number; n: string; dl?: { is?: boolean; sm?: number } }>;
  handleSelectAllParticipants: () => void;
  handleDeselectAllParticipants: () => void;
  participantSearchQuery: string;
  setParticipantSearchQuery: (val: string) => void;
  customParticipantNameInput: string;
  setCustomParticipantNameInput: (val: string) => void;
  handleAddCustomParticipant: () => void;
  isLoadingRoster: boolean;
  handleToggleParticipant: (ud: number) => void;
  liveRoster: YptApiMember[];
  teams: TeamDraftItem[];
  setTeams: React.Dispatch<React.SetStateAction<TeamDraftItem[]>>;
  handleAddTeam: () => void;
  handleRemoveTeam: (index: number) => void;
  knownYptNames: string[];
  handleAutoSplitTeams: () => void;
}

export function ChallengeTeamsBuilderSection({
  challengeMode,
  selectedParticipantUds,
  allAvailableRoster,
  filteredRoster,
  handleSelectAllParticipants,
  handleDeselectAllParticipants,
  participantSearchQuery,
  setParticipantSearchQuery,
  customParticipantNameInput,
  setCustomParticipantNameInput,
  handleAddCustomParticipant,
  isLoadingRoster,
  handleToggleParticipant,
  liveRoster,
  teams,
  setTeams,
  handleAddTeam,
  handleRemoveTeam,
  knownYptNames,
  handleAutoSplitTeams,
}: ChallengeTeamsBuilderSectionProps) {
  if (challengeMode === 'individual') {
    return (
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
    );
  }

  return (
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
  );
}
