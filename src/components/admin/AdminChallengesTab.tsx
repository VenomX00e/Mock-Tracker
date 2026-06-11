import React from "react";
import { Timer, Save, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";

interface AdminChallengesTabProps {
  challengeTitle: string;
  setChallengeTitle: (val: string) => void;
  challengeDescription: string;
  setChallengeDescription: (val: string) => void;
  challengeType: string;
  setChallengeType: (val: string) => void;
  challengeStartDate: string;
  setChallengeStartDate: (val: string) => void;
  challengeEndDate: string;
  setChallengeEndDate: (val: string) => void;
  challengeDuration: string;
  setChallengeDuration: (val: string) => void;
  challengeTasks: { id: string; text: string }[];
  setChallengeTasks: (val: { id: string; text: string }[]) => void;
  challengeTodoFrequency: "oneTime" | "daily";
  setChallengeTodoFrequency: React.Dispatch<React.SetStateAction<"oneTime" | "daily">>;
  editingChallengeId: string | null;
  setEditingChallengeId: (val: string | null) => void;
  savingChallenge: boolean;
  saveChallenge: () => void;
  handleEditChallenge: (c: any) => void;
  deleteChallenge: (id: string) => void;
  adminCategoryScope: string | null;
  challenges: any[];
  isOwner: boolean;
}

export function AdminChallengesTab({
  challengeTitle, setChallengeTitle,
  challengeDescription, setChallengeDescription,
  challengeType, setChallengeType,
  challengeStartDate, setChallengeStartDate,
  challengeEndDate, setChallengeEndDate,
  challengeDuration, setChallengeDuration,
  challengeTasks, setChallengeTasks,
  challengeTodoFrequency, setChallengeTodoFrequency,
  editingChallengeId, setEditingChallengeId,
  savingChallenge, saveChallenge,
  handleEditChallenge, deleteChallenge,
  adminCategoryScope, challenges, isOwner
}: AdminChallengesTabProps) {
  
  const visibleChallenges = challenges.filter(c => {
    if (!isOwner && c.visibility === 'personal') return false;
    if (adminCategoryScope) {
      return c.categoryId === adminCategoryScope;
    }
    return !c.categoryId;
  });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap">
          <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          Manage Challenges
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Challenge Title
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="search"
              value={challengeTitle}
              onChange={(e) => setChallengeTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              placeholder="e.g. 50 Days Mock Challenge"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              rows={3}
              value={challengeDescription}
              onChange={(e) => setChallengeDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              placeholder="e.g. Can you maintain a mock streak for 50 days?"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Challenge Type
              </label>
              <CustomDropdown
                value={
                  challengeType === "streak"
                    ? "Check-in"
                    : challengeType === "uploadMock"
                      ? "Upload Mock"
                      : "To-Do"
                }
                options={["Check-in", "Upload Mock", "To-Do"]}
                onChange={(val) =>
                  setChallengeType(
                    val === "Check-in"
                      ? "streak"
                      : val === "Upload Mock"
                        ? "uploadMock"
                        : "todo",
                  )
                }
                placeholder="Select Type"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="date"
                value={challengeStartDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setChallengeStartDate(newStart);
                  if (newStart && challengeDuration) {
                    const d = new Date(newStart);
                    d.setDate(d.getDate() + parseInt(challengeDuration));
                    setChallengeEndDate(d.toISOString().split("T")[0]);
                  } else if (newStart && challengeEndDate) {
                    const start = new Date(newStart).getTime();
                    const end = new Date(challengeEndDate).getTime();
                    if (end > start) {
                      setChallengeDuration(
                        Math.ceil(
                          (end - start) / (1000 * 60 * 60 * 24),
                        ).toString(),
                      );
                    }
                  }
                }}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration (Days)
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="number"
                placeholder="Days"
                value={challengeDuration}
                onChange={(e) => {
                  const newDuration = e.target.value;
                  setChallengeDuration(newDuration);
                  if (newDuration && challengeStartDate) {
                    const d = new Date(challengeStartDate);
                    d.setDate(d.getDate() + parseInt(newDuration));
                    setChallengeEndDate(d.toISOString().split("T")[0]);
                  }
                }}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="date"
                value={challengeEndDate}
                onChange={(e) => {
                  const newEnd = e.target.value;
                  setChallengeEndDate(newEnd);
                  if (newEnd && challengeStartDate) {
                    const start = new Date(challengeStartDate).getTime();
                    const end = new Date(newEnd).getTime();
                    if (end > start) {
                      setChallengeDuration(
                        Math.ceil(
                          (end - start) / (1000 * 60 * 60 * 24),
                        ).toString(),
                      );
                    }
                  }
                }}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              />
            </div>
          </div>
          
          <div className="space-y-4 mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Challenge Tasks{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    (Optional)
                  </span>
                </label>
                {challengeTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setChallengeTodoFrequency((prev) =>
                        prev === "oneTime" ? "daily" : "oneTime",
                      )
                    }
                    className="py-1 px-2.5 text-[10px] font-bold rounded overflow-hidden bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                    title={
                      challengeTodoFrequency === "daily"
                        ? "Tasks reset every day"
                        : "Tasks are completed once"
                    }
                  >
                    {challengeTodoFrequency === "daily"
                      ? "↻ DAILY RESET"
                      : "✓ ONE-TIME COMPLETON"}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {challengeTasks.map((t, idx) => (
                  <div key={t.id} className="flex gap-2">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="text"
                      value={t.text}
                      onChange={(e) => {
                        const newTasks = [...challengeTasks];
                        newTasks[idx].text = e.target.value;
                        setChallengeTasks(newTasks);
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm bg-slate-50 dark:bg-slate-900/50 dark:text-slate-200"
                      placeholder="Task description..."
                    />
                    <button
                      onClick={() =>
                        setChallengeTasks(
                          challengeTasks.filter((item) => item.id !== t.id),
                        )
                      }
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setChallengeTasks([
                    ...challengeTasks,
                    { id: Math.random().toString(36).substring(2, 9), text: "" },
                  ])
                }
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2 flex items-center gap-1"
              >
                + Add Task
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveChallenge}
              disabled={savingChallenge}
              className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingChallenge ? "Saving..." : editingChallengeId ? "Update Challenge" : "Save Challenge"}
            </button>
            {editingChallengeId && (
              <button
                onClick={() => {
                  setEditingChallengeId(null);
                  setChallengeTitle("");
                  setChallengeDescription("");
                  setChallengeType("streak");
                  setChallengeStartDate("");
                  setChallengeEndDate("");
                  setChallengeDuration("");
                  setChallengeTasks([]);
                  setChallengeTodoFrequency("daily");
                }}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {visibleChallenges.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
                {adminCategoryScope
                  ? `Challenges for ${adminCategoryScope}`
                  : "Active Challenges"}
              </h4>
              <ul className="space-y-3">
                {visibleChallenges.map((c) => (
                  <li
                    key={c.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex flex-col md:flex-row gap-4 md:items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {c.title}
                        <span className="text-[10px] uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                          {c.challengeType === "uploadMock"
                            ? "Mock"
                            : c.challengeType === "todo"
                              ? "Tasks"
                              : "Streak"}
                        </span>
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {c.startDate?.split("T")[0]} to {c.endDate?.split("T")[0]}
                      </p>
                      {isOwner && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                          ID: {c.id}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleEditChallenge(c)}
                        className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteChallenge(c.id)}
                        className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
