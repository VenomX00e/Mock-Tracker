import React from "react";
import { AlertCircle, Save, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";

interface AdminNoticesTabProps {
  noticeTitle: string;
  setNoticeTitle: (val: string) => void;
  noticeDescription: string;
  setNoticeDescription: (val: string) => void;
  noticeLink: string;
  setNoticeLink: (val: string) => void;
  noticeDate: string;
  setNoticeDate: (val: string) => void;
  noticeUrgency: string;
  setNoticeUrgency: (val: string) => void;
  noticeTags: string;
  setNoticeTags: (val: string) => void;
  noticeEditableBy: "admin" | "users";
  setNoticeEditableBy: React.Dispatch<React.SetStateAction<"admin" | "users">>;
  editingNoticeId: string | null;
  setEditingNoticeId: (val: string | null) => void;
  savingNotice: boolean;
  saveNotice: () => void;
  handleEditNotice: (n: any) => void;
  deleteNotice: (id: string) => void;
  adminCategoryScope: string | null;
  notices: any[];
  isOwner: boolean;
}

export function AdminNoticesTab({
  noticeTitle, setNoticeTitle,
  noticeDescription, setNoticeDescription,
  noticeLink, setNoticeLink,
  noticeDate, setNoticeDate,
  noticeUrgency, setNoticeUrgency,
  noticeTags, setNoticeTags,
  noticeEditableBy, setNoticeEditableBy,
  editingNoticeId, setEditingNoticeId,
  savingNotice, saveNotice,
  handleEditNotice, deleteNotice,
  adminCategoryScope, notices, isOwner
}: AdminNoticesTabProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap">
          <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          Broadcast Notice
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="search"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="e.g. Server Maintenance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description (Markdown supported)
            </label>
            <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              rows={4}
              value={noticeDescription}
              onChange={(e) => setNoticeDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Type notice details here... Use **bold**, *italic*, [links](https://...), and #hashtags within text."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Urgency (Optional)
              </label>
              <CustomDropdown
                value={
                  noticeUrgency === "info"
                    ? "Info (Blue)"
                    : noticeUrgency === "warning"
                      ? "Warning (Yellow)"
                      : noticeUrgency === "error"
                        ? "Urgent (Red)"
                        : "None (Default)"
                }
                options={[
                  "None (Default)",
                  "Info (Blue)",
                  "Warning (Yellow)",
                  "Urgent (Red)",
                ]}
                onChange={(val) => {
                  if (val === "Info (Blue)") setNoticeUrgency("info");
                  else if (val === "Warning (Yellow)")
                    setNoticeUrgency("warning");
                  else if (val === "Urgent (Red)") setNoticeUrgency("error");
                  else setNoticeUrgency("");
                }}
                placeholder="Select Urgency"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Global Tags (comma separated)
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="text"
                value={noticeTags}
                onChange={(e) => setNoticeTags(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="e.g. maintenance, update"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Action Link (Optional)
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="url"
              value={noticeLink}
              onChange={(e) => setNoticeLink(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Live Until (Optional)
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="datetime-local"
              value={noticeDate}
              onChange={(e) => setNoticeDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl mt-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Users can edit
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Allow users to edit this notice from the home screen
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setNoticeEditableBy((prev) =>
                  prev === "admin" ? "users" : "admin",
                )
              }
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-0 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${noticeEditableBy === "users" ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"} `}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-100 ease-in-out ${noticeEditableBy === "users" ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveNotice}
              disabled={savingNotice}
              className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingNotice ? "Publishing..." : editingNoticeId ? "Update Notice" : "Publish Notice"}
            </button>
            {editingNoticeId && (
              <button
                onClick={() => {
                  setEditingNoticeId(null);
                  setNoticeTitle("");
                  setNoticeDescription("");
                  setNoticeLink("");
                  setNoticeDate("");
                  setNoticeUrgency("");
                  setNoticeTags("");
                  setNoticeEditableBy("admin");
                }}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {(adminCategoryScope
          ? notices.filter((n) => n.categoryId === adminCategoryScope || (!n.categoryId && adminCategoryScope === 'banking'))
          : notices
        ).length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {adminCategoryScope
                ? `Notices for ${adminCategoryScope}`
                : "Active Notices"}
            </h4>
            <ul className="space-y-3">
              {(adminCategoryScope
                ? notices.filter((n) => n.categoryId === adminCategoryScope || (!n.categoryId && adminCategoryScope === 'banking'))
                : notices
              ).map((n) => (
                <li
                  key={n.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {n.title}
                    </p>
                    {n.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                        {n.description}
                      </p>
                    )}
                    {isOwner && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                        ID: {n.id}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleEditNotice(n)}
                      className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNotice(n.id)}
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
