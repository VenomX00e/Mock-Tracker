import React from "react";
import { Radio, Save, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";
import { EXAMS, ROLES, PHASES, PLATFORMS, SCOPES } from "../../lib/constants";

interface AdminLiveMocksTabProps {
  isCustomExam: boolean;
  setIsCustomExam: (val: boolean) => void;
  isCustomRole: boolean;
  setIsCustomRole: (val: boolean) => void;
  isCustomPhase: boolean;
  setIsCustomPhase: (val: boolean) => void;
  isCustomPlatform: boolean;
  setIsCustomPlatform: (val: boolean) => void;
  editingLiveMockId: string | null;
  setEditingLiveMockId: (val: string | null) => void;
  liveMockData: any;
  setLiveMockData: (val: any) => void;
  isProcessingImage: boolean;
  savingAnnouncement: boolean;
  saveLiveMock: () => void;
  handleEditLiveMock: (m: any, setAdminCategoryScope: (id: string | null) => void) => void;
  deleteLiveMock: (id: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  adminCategoryScope: string | null;
  setAdminCategoryScope: (id: string | null) => void;
  liveMocks: any[];
  isOwner: boolean;
}

export function AdminLiveMocksTab({
  isCustomExam, setIsCustomExam,
  isCustomRole, setIsCustomRole,
  isCustomPhase, setIsCustomPhase,
  isCustomPlatform, setIsCustomPlatform,
  editingLiveMockId, setEditingLiveMockId,
  liveMockData, setLiveMockData,
  isProcessingImage,
  savingAnnouncement,
  saveLiveMock,
  handleEditLiveMock,
  deleteLiveMock,
  handleFileChange,
  adminCategoryScope,
  setAdminCategoryScope,
  liveMocks,
  isOwner
}: AdminLiveMocksTabProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 whitespace-nowrap">
          <Radio className="w-5 h-5" /> Host a Live Mock
        </h3>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="adminFileUpload"
              onChange={handleFileChange}
              autoCorrect="off" spellCheck={false}     />
            <label
              htmlFor="adminFileUpload"
              className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${isProcessingImage ? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"}`}
            >
              {isProcessingImage ? "Analyzing..." : "Auto-fill from image"}
            </label>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-1.5 xl:col-span-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Exam Header
              </label>
              <div className="grid grid-cols-2 gap-3">
                {!isCustomExam ? (
                  <CustomDropdown
                    value={liveMockData.examType || ""}
                    placeholder="Exam"
                    options={EXAMS}
                    allowCustom
                    onChange={(val) => {
                      if (val === "Other") {
                        setIsCustomExam(true);
                        setLiveMockData((p: any) => ({ ...p, examType: "" }));
                      } else {
                        setLiveMockData((p: any) => ({ ...p, examType: val }));
                      }
                    }}
                  />
                ) : (
                  <div className="relative">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="search"
                      value={liveMockData.examType}
                      onChange={(e) =>
                        setLiveMockData((p: any) => ({ ...p, examType: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm"
                      placeholder="Custom Exam"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomExam(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!isCustomRole ? (
                  <CustomDropdown
                    value={liveMockData.examRole || ""}
                    placeholder="Role"
                    options={ROLES}
                    allowCustom
                    onChange={(val) => {
                      if (val === "Other") {
                        setIsCustomRole(true);
                        setLiveMockData((p: any) => ({ ...p, examRole: "" }));
                      } else {
                        setLiveMockData((p: any) => ({ ...p, examRole: val }));
                      }
                    }}
                  />
                ) : (
                  <div className="relative">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="search"
                      value={liveMockData.examRole}
                      onChange={(e) =>
                        setLiveMockData((p: any) => ({ ...p, examRole: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm"
                      placeholder="Custom Role"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomRole(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 xl:col-span-1 flex flex-col justify-end">
              <div className="grid grid-cols-2 gap-3">
                {!isCustomPhase ? (
                  <CustomDropdown
                    value={liveMockData.examPhase || ""}
                    placeholder="Phase"
                    options={PHASES}
                    allowCustom
                    onChange={(val) => {
                      if (val === "Other") {
                        setIsCustomPhase(true);
                        setLiveMockData((p: any) => ({ ...p, examPhase: "" }));
                      } else {
                        setLiveMockData((p: any) => ({ ...p, examPhase: val }));
                      }
                    }}
                  />
                ) : (
                  <div className="relative">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="search"
                      value={liveMockData.examPhase}
                      onChange={(e) =>
                        setLiveMockData((p: any) => ({
                          ...p,
                          examPhase: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm"
                      placeholder="Custom Phase"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomPhase(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <CustomDropdown
                  value={liveMockData.examScope || ""}
                  placeholder="Scope"
                  options={SCOPES}
                  onChange={(val) =>
                    setLiveMockData((p: any) => ({ ...p, examScope: val }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mock Name
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="search"
                value={liveMockData.mockName}
                onChange={(e) =>
                  setLiveMockData((p: any) => ({ ...p, mockName: e.target.value }))
                }
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="e.g. Test 1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Platform
              </label>
              {!isCustomPlatform ? (
                <CustomDropdown
                  value={liveMockData.platform || ""}
                  placeholder="Platform"
                  options={PLATFORMS}
                  allowCustom
                  onChange={(val) => {
                    if (val === "Other") {
                      setIsCustomPlatform(true);
                      setLiveMockData((p: any) => ({ ...p, platform: "" }));
                    } else {
                      setLiveMockData((p: any) => ({ ...p, platform: val }));
                    }
                  }}
                />
              ) : (
                <div className="relative">
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                    type="search"
                    value={liveMockData.platform}
                    onChange={(e) =>
                      setLiveMockData((p: any) => ({ ...p, platform: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Custom Platform"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomPlatform(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Date & Time
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="datetime-local"
                value={liveMockData.date}
                onChange={(e) =>
                  setLiveMockData((p: any) => ({ ...p, date: e.target.value }))
                }
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveLiveMock}
              disabled={savingAnnouncement}
              className="mt-4 flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingAnnouncement ? "Publishing..." : editingLiveMockId ? "Update Live Mock" : "Publish Live Mock"}
            </button>
            {editingLiveMockId && (
              <button
                onClick={() => {
                  setEditingLiveMockId(null);
                  setLiveMockData({
                    examType: "",
                    examRole: "",
                    examPhase: "Prelims",
                    examScope: "Full",
                    mockName: "",
                    platform: "",
                    date: "",
                  });
                  setIsCustomExam(false);
                  setIsCustomRole(false);
                  setIsCustomPhase(false);
                  setIsCustomPlatform(false);
                }}
                className="mt-4 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {(adminCategoryScope
            ? liveMocks.filter((m) => m.categoryId === adminCategoryScope || (!m.categoryId && adminCategoryScope === 'banking'))
            : liveMocks
          ).length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
                {adminCategoryScope
                  ? `Live Mocks for ${adminCategoryScope}`
                  : "Active Live Mocks"}
              </h4>
              <ul className="space-y-3">
                {(adminCategoryScope
                  ? liveMocks.filter((m) => m.categoryId === adminCategoryScope || (!m.categoryId && adminCategoryScope === 'banking'))
                  : liveMocks
                ).map((m) => (
                  <li
                    key={m.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {m.title}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {m.examType} {m.examRole} • {m.platform}
                      </p>
                      {isOwner && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                          ID: {m.id}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleEditLiveMock(m, setAdminCategoryScope)}
                        className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteLiveMock(m.id)}
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
