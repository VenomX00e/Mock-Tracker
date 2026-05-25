import React from "react";
import { Timer, Save, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";

interface AdminCountdownsTabProps {
  countdownTitle: string;
  setCountdownTitle: (val: string) => void;
  countdownDate: string;
  setCountdownDate: (val: string) => void;
  countdownNote: string;
  setCountdownNote: (val: string) => void;
  countdownColor: string;
  setCountdownColor: (val: string) => void;
  editingCountdownId: string | null;
  setEditingCountdownId: (val: string | null) => void;
  savingCountdown: boolean;
  saveCountdown: () => void;
  handleEditCountdown: (c: any) => void;
  deleteCountdown: (id: string) => void;
  adminCategoryScope: string | null;
  countdowns: any[];
  isOwner: boolean;
}

export function AdminCountdownsTab({
  countdownTitle, setCountdownTitle,
  countdownDate, setCountdownDate,
  countdownNote, setCountdownNote,
  countdownColor, setCountdownColor,
  editingCountdownId, setEditingCountdownId,
  savingCountdown, saveCountdown,
  handleEditCountdown, deleteCountdown,
  adminCategoryScope, countdowns, isOwner
}: AdminCountdownsTabProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap">
          <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          Manage Countdowns
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Exam / Event Name
            </label>
            <input
              type="search"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="x-dummy"
              spellCheck="false"
              value={countdownTitle}
              onChange={(e) => setCountdownTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
              placeholder="e.g. IBPS PO Prelims"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={countdownDate}
              onChange={(e) => setCountdownDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Short Note (Optional)
            </label>
            <input
              type="search"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="x-dummy"
              spellCheck="false"
              value={countdownNote}
              onChange={(e) => setCountdownNote(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="e.g. Admit cards out soon!"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Theme Color
            </label>
            <CustomDropdown
              value={
                countdownColor === "green"
                  ? "Green"
                  : countdownColor === "light-green"
                    ? "Light Green"
                    : countdownColor === "orange"
                      ? "Orange"
                      : countdownColor === "light-red"
                        ? "Light Red"
                        : countdownColor === "red"
                          ? "Red"
                          : "Green"
              }
              options={["Green", "Light Green", "Orange", "Light Red", "Red"]}
              placeholder="Select Theme Color"
              onChange={(val) => {
                const mapped =
                  val === "Light Green"
                    ? "light-green"
                    : val === "Light Red"
                      ? "light-red"
                      : val.toLowerCase();
                setCountdownColor(mapped);
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveCountdown}
              disabled={savingCountdown}
              className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingCountdown
                ? "Saving..."
                : editingCountdownId
                  ? "Update Countdown"
                  : "Save Countdown"}
            </button>
            {editingCountdownId && (
              <button
                onClick={() => {
                  setEditingCountdownId(null);
                  setCountdownTitle("");
                  setCountdownDate("");
                  setCountdownNote("");
                }}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {(adminCategoryScope
          ? countdowns.filter((c) => c.categoryId === adminCategoryScope)
          : countdowns.filter((c) => !c.categoryId)
        ).length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {adminCategoryScope
                ? `Countdowns for ${adminCategoryScope}`
                : "Active Countdowns"}
            </h4>
            <ul className="space-y-3">
              {(adminCategoryScope
                ? countdowns.filter((c) => c.categoryId === adminCategoryScope)
                : countdowns.filter((c) => !c.categoryId)
              ).map((c) => (
                <li
                  key={c.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {c.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(c.date).toLocaleString()}{" "}
                      {c.note && `- ${c.note}`}
                    </p>
                    {isOwner && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                        ID: {c.id}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleEditCountdown(c)}
                      className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCountdown(c.id)}
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
  );
}
