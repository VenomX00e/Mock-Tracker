import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { ExamCategory } from "../types";
import { AdminCategoryDeleteModal } from "./admin/AdminCategoryDeleteModal";
import {
  Plus,
  Trash2,
  Save,
  X,
  Edit2,
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  Database,
  ArrowLeft,
} from "lucide-react";

import { OptionManagerDropdown } from './admin/OptionManagerDropdown';
import { SubjectManager } from './admin/SubjectManager';

export function AdminCategoriesTab({
  onManageSection,
  onCategorySelect,
  renderLiveMock,
  renderNotice,
  renderCountdown,
  renderChallenge,
  renderPracticeSets,
}: {
  onManageSection?: (section: string, categoryId: string) => void;
  onCategorySelect?: (categoryId: string | null) => void;
  renderLiveMock?: () => React.ReactNode;
  renderNotice?: () => React.ReactNode;
  renderCountdown?: () => React.ReactNode;
  renderChallenge?: () => React.ReactNode;
  renderPracticeSets?: () => React.ReactNode;
}) {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false); // Used to determine if we are creating a *new* category
  const [subTab, setSubTab] = useState<
    "details" | "liveMock" | "notice" | "countdown" | "challenge" | "practiceSets"
  >("details");

  // Local state for the currently selected/edited category
  const [workingCat, setWorkingCat] = useState<Partial<ExamCategory>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "categories")));
      const cats: ExamCategory[] = [];
      let hasBanking = false;
      snap.forEach((d) => {
        if (d.id === "banking") hasBanking = true;
        cats.push({ id: d.id, ...d.data() } as ExamCategory);
      });
      if (!hasBanking) {
        const DefaultBanking = {
          id: "banking",
          name: "Banking",
          exams: [
            "SBI",
            "IBPS",
            "RRB",
            "LIC",
            "NICL",
            "NIACL",
            "RBI",
            "NABARD",
            "CGL",
          ],
          roles: ["PO", "Clerk", "AO", "AAO", "Assistant"],
          phases: ["Prelims", "Mains"],
          scopes: ["Full", "Sectional"],
          platforms: [
            "Oliveboard",
            "Practice Mock",
            "Smartkeeda",
            "Testbook",
            "Guidely",
            "Yes Mock",
            "Adda",
            "Learning niti",
          ],
          subjects: [
            { id: "bank_quant", name: "Quant" },
            { id: "bank_reasoning", name: "Reasoning" },
            { id: "bank_english", name: "English" },
            { id: "bank_ga", name: "GA" },
            { id: "bank_computer", name: "Computer" },
          ],
        };
        cats.push(DefaultBanking);
      }
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSelect = (cat: ExamCategory) => {
    setSelectedId(cat.id);
    setIsEditing(false);
    onCategorySelect?.(cat.id);
    setWorkingCat({
      id: cat.id,
      name: cat.name,
      subjectPrefix: cat.subjectPrefix || "",
      exams: cat.exams || [],
      roles: cat.roles || [],
      phases: cat.phases || [],
      scopes: cat.scopes || [],
      platforms: cat.platforms || [],
      subjects: cat.subjects || [],
    });
  };

  const handleCreateNew = () => {
    setSelectedId("");
    setIsEditing(true);
    setSubTab("details");
    onCategorySelect?.(null);
    setWorkingCat({
      name: "",
      subjectPrefix: "",
      exams: [],
      roles: [],
      phases: [],
      scopes: [],
      platforms: [],
      subjects: [],
    });
  };

  const cancelEditing = () => {
    if (selectedId === "") {
      setSelectedId(null);
      setIsEditing(false);
    } else {
      const cat = categories.find((c) => c.id === selectedId);
      if (cat) {
        handleSelect(cat);
      } else {
        setSelectedId(null);
        setIsEditing(false);
      }
    }
  };

  const handleSave = async () => {
    if (!workingCat.name?.trim()) return;
    try {
      const id =
        selectedId || workingCat.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      const defaultPrefix =
        id === "banking" ? "bank_" : id === "ssc" ? "ssc_" : id + "_";
      const prefix = workingCat.subjectPrefix || defaultPrefix;
      const processedSubjects = (workingCat.subjects || []).map((s) => {
        let sId = s.id;
        if (!sId.startsWith(prefix)) {
          sId = prefix + sId.replace(/^(bank_|ssc_|[a-z0-9]+_)/, "");
        }
        return { ...s, id: sId };
      });

      const payload = {
        name: workingCat.name.trim(),
        subjectPrefix: prefix,
        exams: workingCat.exams || [],
        roles: workingCat.roles || [],
        phases: workingCat.phases || [],
        scopes: workingCat.scopes || [],
        platforms: workingCat.platforms || [],
        subjects: processedSubjects,
      };

      const cleanPayload = JSON.parse(JSON.stringify(payload));

      await setDoc(doc(db, "categories", id), cleanPayload);
      await fetchCategories();

      const updatedCat = { id, ...payload };
      handleSelect(updatedCat as ExamCategory);
    } catch (e) {
      console.error(e);
      alert("Failed to save category");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id === "banking") {
      alert("Cannot delete default banking category");
      return;
    }

    setDeleteStep(1);
    setDeleteConfirmId(id);
    setDeleteConfirmInput("");
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const catToDelete = categories.find((c) => c.id === deleteConfirmId);
    if (!catToDelete) {
      setDeleteConfirmId(null);
      return;
    }
    const confirmText = `delete ${catToDelete.name.toLowerCase()}`;
    if (deleteConfirmInput.toLowerCase() !== confirmText) {
      alert("Confirmation text does not match.");
      return;
    }
    try {
      // Also delete related global data (system documents like notices, countdowns, liveMocks and challenges)
      const { collection, collectionGroup, query, where, getDocs, writeBatch } = await import('firebase/firestore');
      
      const systemQ = query(collection(db, 'system'), where('categoryId', '==', deleteConfirmId));
      const systemSnap = await getDocs(systemQ);
      
      const challengeQ = query(collection(db, 'challenges'), where('categoryId', '==', deleteConfirmId));
      const challengeSnap = await getDocs(challengeQ);

      const mocksQ = query(collectionGroup(db, 'mocks'), where('categoryId', '==', deleteConfirmId));
      const mocksSnap = await getDocs(mocksQ);
      
      // Note: we could chunk batches if > 500 but normally this is fine for this app
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const queueDelete = (ref: any) => {
        currentBatch.delete(ref);
        opCount++;
        if (opCount === 500) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      systemSnap.forEach(snap => queueDelete(snap.ref));
      challengeSnap.forEach(snap => queueDelete(snap.ref));
      mocksSnap.forEach(snap => queueDelete(snap.ref));

      if (opCount > 0) batches.push(currentBatch);

      await Promise.all(batches.map(b => b.commit()));

      await deleteDoc(doc(db, "categories", deleteConfirmId));
      if (selectedId === deleteConfirmId) {
        setSelectedId(null);
        setIsEditing(false);
      }
      setDeleteConfirmId(null);
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const selectedCategory = categories.find((c) => c.id === selectedId);

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-white dark:bg-slate-900 md:rounded-r-2xl overflow-hidden">
      {/* Left Navigation */}
      <div className={`w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col shrink-0 ${selectedId !== null ? 'hidden md:flex' : 'flex-1 md:h-full'}`}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">
            Exam Categories
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : (
            <>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelect(cat)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex justify-between items-center group ${
                    selectedId === cat.id
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[10px] font-mono opacity-60">
                      id: {cat.id}
                    </span>
                  </div>
                  {selectedId === cat.id ? (
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  ) : (
                    cat.id !== "banking" && (
                      <Trash2
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                        onClick={(e) => handleDelete(cat.id, e)}
                      />
                    )
                  )}
                </button>
              ))}

              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  onClick={handleCreateNew}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-dashed transition-colors ${
                    selectedId === ""
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Content */}
      <div className={`flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 md:p-8 bg-white dark:bg-slate-900 custom-scrollbar ${selectedId === null ? 'hidden md:block' : 'block'}`}>
        {selectedId === null ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 pb-12">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex gap-2 items-center justify-center mb-4">
              <Edit2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Select a category
            </p>
            <p className="text-sm mt-1 max-w-sm">
              Choose an exam category from the left sidebar to view its details
              or create a new one.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <button 
              onClick={() => setSelectedId(null)} 
              className="md:hidden flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4 font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Categories
            </button>
            {selectedId !== "" && (
              <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/50 w-full mb-6 overflow-x-auto custom-scrollbar shadow-sm">
                <button
                  onClick={() => setSubTab("details")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "details" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "details" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Category Details</span>
                </button>
                <button
                  onClick={() => setSubTab("liveMock")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "liveMock" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "liveMock" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Live Mocks</span>
                </button>
                <button
                  onClick={() => setSubTab("notice")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "notice" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "notice" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Notices</span>
                </button>
                <button
                  onClick={() => setSubTab("countdown")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "countdown" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "countdown" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Countdowns</span>
                </button>
                <button
                  onClick={() => setSubTab("challenge")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "challenge" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "challenge" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Challenges</span>
                </button>
                <button
                  onClick={() => setSubTab("practiceSets")}
                  className={`shrink-0 md:flex-1 relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 whitespace-nowrap bg-transparent border-none outline-none ${subTab === "practiceSets" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  {subTab === "practiceSets" && (
                    <motion.div layoutId="adminCategoryTab" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-lg border border-current -z-10" />
                  )}
                  <span className="relative z-10">Practice Sets</span>
                </button>
              </div>
            )}

            {subTab === "details" || selectedId === "" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex flex-col xl:flex-row justify-between items-start pb-6 border-b border-slate-100 dark:border-slate-800 gap-4 xl:gap-8">
                  <div className="w-full xl:flex-1 max-w-full xl:max-w-md">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="text"
                      value={workingCat.name || ""}
                      onChange={(e) =>
                        setWorkingCat({ ...workingCat, name: e.target.value })
                      }
                      className="w-full text-2xl font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                      placeholder="Category Name"
                      autoFocus={selectedId === ""}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
                      {selectedId !== "" && (
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 break-all">
                          ID: {workingCat.id}
                        </p>
                      )}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                          ID Starter
                        </label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                          type="text"
                          value={workingCat.subjectPrefix || ""}
                          onChange={(e) =>
                            setWorkingCat({
                              ...workingCat,
                              subjectPrefix: e.target.value,
                            })
                          }
                          placeholder={
                            selectedId
                              ? selectedId === "banking"
                                ? "bank_"
                                : selectedId === "ssc"
                                  ? "ssc_"
                                  : selectedId + "_"
                              : workingCat.name
                                ? `${workingCat.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}_`
                                : "prefix_"
                          }
                          className="flex-1 min-w-0 px-2 py-1.5 w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto mt-4 xl:mt-0 xl:shrink-0">
                    {selectedId &&
                      selectedId !== "" &&
                      selectedId !== "banking" && (
                        <button
                          onClick={(e) => handleDelete(selectedId, e)}
                          title="Delete Category"
                          className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2.5 text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-800 rounded-xl transition-colors w-full sm:w-auto shrink-0"
                        >
                          <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                          <span className="sm:hidden">Delete Category</span>
                        </button>
                      )}
                    <button
                      onClick={cancelEditing}
                      className="px-5 py-2.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl transition-colors w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!workingCat.name?.trim()}
                      className="px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto"
                    >
                      <Save className="w-4 h-4" /> Save Options
                    </button>
                  </div>
                </div>

                {selectedId && selectedId !== "" && (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar"></div>
                )}

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden pointer-events-auto">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-4 px-6 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="ml-3 text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                      Dropdown Options Manager <span className="hidden sm:inline">(Add Mock Score Layout)</span>
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Exam Header
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <OptionManagerDropdown
                            title="Exam"
                            options={workingCat.exams || []}
                            onChange={(opts) =>
                              setWorkingCat({ ...workingCat, exams: opts })
                            }
                          />
                          <OptionManagerDropdown
                            title="Role"
                            options={workingCat.roles || []}
                            align="right"
                            onChange={(opts) =>
                              setWorkingCat({ ...workingCat, roles: opts })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 md:col-span-2 flex flex-col justify-end">
                        <div className="grid grid-cols-2 gap-3">
                          <OptionManagerDropdown
                            title="Phase"
                            options={workingCat.phases || []}
                            onChange={(opts) =>
                              setWorkingCat({ ...workingCat, phases: opts })
                            }
                          />
                          <div className="relative pointer-events-none opacity-50">
                            <div className="w-full text-left px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl font-medium flex justify-between items-center text-slate-700 dark:text-slate-200">
                              <span>Scope (Fixed)</span>
                              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 col-span-2 md:col-span-1 opacity-50 pointer-events-none">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Mock Name
                        </label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                          type="text"
                          disabled
                          placeholder="Mock Name"
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl"
                          autoCorrect="off" spellCheck={false}     />
                      </div>
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Platform
                        </label>
                        <OptionManagerDropdown
                          title="Platform"
                          options={workingCat.platforms || []}
                          onChange={(opts) =>
                            setWorkingCat({ ...workingCat, platforms: opts })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 col-span-1 opacity-50 pointer-events-none">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Date & Time
                        </label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                          type="datetime-local"
                          disabled
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl"
                          autoCorrect="off" spellCheck={false}     />
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 opacity-50 pointer-events-none">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 inline-flex items-center">
                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                        Overall Performance
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Score
                          </label>
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                            type="text"
                            disabled
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                            autoCorrect="off" spellCheck={false}     />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Percentile
                          </label>
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                            type="text"
                            disabled
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                            autoCorrect="off" spellCheck={false}     />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Accuracy %
                          </label>
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                            type="text"
                            disabled
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                            autoCorrect="off" spellCheck={false}     />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center">
                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                        Sectional breakdown
                      </h3>
                      <SubjectManager
                        subjects={workingCat.subjects || []}
                        onChange={(subs) =>
                          setWorkingCat({ ...workingCat, subjects: subs })
                        }
                        availablePhases={workingCat.phases || []}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {subTab === "liveMock" && selectedId !== "" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderLiveMock?.()}
              </div>
            )}
            {subTab === "notice" && selectedId !== "" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderNotice?.()}
              </div>
            )}
            {subTab === "countdown" && selectedId !== "" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderCountdown?.()}
              </div>
            )}
            {subTab === "challenge" && selectedId !== "" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderChallenge?.()}
              </div>
            )}
            {subTab === "practiceSets" && selectedId !== "" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderPracticeSets?.()}
              </div>
            )}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <AdminCategoryDeleteModal
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          categories={categories}
          deleteStep={deleteStep}
          setDeleteStep={setDeleteStep}
          deleteConfirmInput={deleteConfirmInput}
          setDeleteConfirmInput={setDeleteConfirmInput}
          confirmDelete={confirmDelete}
        />
      )}
    </div>
  );
}
