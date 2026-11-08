import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2,
  RefreshCw,
  Plus,
  Eye,
  Wrench,
} from 'lucide-react';
import { useVersionStore } from '../store/versionStore';
import { useUIStore } from '../store/uiStore';
import { APP_CHANGELOG, VersionRelease, UpdateItem } from '../config/versionConfig';
import { useAuth } from '../services/AuthContext';
import { doc, getDoc, setDoc, getDocs, collection, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  OperationType,
  handleFirestoreError,
  getChangelogThemeStyles,
} from './changelog/changelogThemeStyles';
import {
  ChangelogFeatureGroupSection,
  ChangelogAdminFooter,
} from './changelog/ChangelogAdminEditor';
import { ChangelogHistoryTimeline } from './changelog/ChangelogHistoryTimeline';

export default function UpdateChangelogModal() {
  const { 
    currentLocalVersion, 
    latestCloudVersion,
    isUpdateModalOpen, 
    setUpdateModalOpen, 
    setLocalVersion 
  } = useVersionStore();

  const { user } = useAuth();
  const isOwner = user?.email === 'mrityunjoyk29@gmail.com';
  const { theme } = useUIStore();

  const ts = getChangelogThemeStyles(theme);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>(latestCloudVersion);
  const [showHistory, setShowHistory] = useState(false);
  const [activeChangelogData, setActiveChangelogData] = useState<VersionRelease | null>(null);
  const [allVersions, setAllVersions] = useState<VersionRelease[]>([]);
  
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUpdateModalOpen) {
        setUpdateModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpdateModalOpen, setUpdateModalOpen]);

  // Keep selectedVersion synchronized when closed or dynamically upgraded
  useEffect(() => {
    if (!isEditMode) {
      setSelectedVersion(latestCloudVersion);
    }
  }, [latestCloudVersion, isEditMode]);

  const fetchVersionsIndex = async () => {
    try {
      const updatesCol = collection(db, 'app_updates');
      const q = query(updatesCol, orderBy('createdAt', 'desc'));
      const querySnap = await getDocs(q);
      const docsList: VersionRelease[] = [];
      querySnap.forEach((d) => {
        const item = d.data();
        if (item.version) {
          docsList.push(item as VersionRelease);
        }
      });
      setAllVersions(docsList);
    } catch (err) {
      console.warn("Could not retrieve historical updates list:", err);
    }
  };

  useEffect(() => {
    if (isUpdateModalOpen) {
      fetchVersionsIndex();
    }
  }, [isUpdateModalOpen]);

  // Handle document fetching and dynamic fallback
  useEffect(() => {
    if (!isUpdateModalOpen) return;

    setIsLoadingDoc(true);
    const loadVersionDoc = async () => {
      const verKey = selectedVersion.toLowerCase();
      try {
        const docRef = doc(db, 'app_updates', verKey);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetched = docSnap.data() as VersionRelease;
          setActiveChangelogData({
            version: fetched.version || selectedVersion.toUpperCase(),
            releaseDate: fetched.releaseDate || 'MAY 8, 2026',
            title: fetched.title || 'Quality of Life Update',
            badgeText: fetched.badgeText || 'PREMIUM UPDATE',
            featuresGroupA: fetched.featuresGroupA || { sectionTitle: 'Features', items: [] },
            featuresGroupB: fetched.featuresGroupB || { sectionTitle: 'Polish', items: [] }
          });
        } else {
          // Fallback static files
          const staticRelease = APP_CHANGELOG[selectedVersion.toUpperCase()] || APP_CHANGELOG[selectedVersion];
          if (staticRelease) {
            setActiveChangelogData(JSON.parse(JSON.stringify(staticRelease)));
          } else {
            // Placeholder template
            setActiveChangelogData({
              version: selectedVersion.toUpperCase(),
              releaseDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
              title: "",
              badgeText: "UPDATE",
              featuresGroupA: {
                sectionTitle: "",
                items: []
              },
              featuresGroupB: {
                sectionTitle: "",
                items: []
              }
            });
          }
        }
      } catch (err) {
        console.error("Error loading version schema:", err);
        const staticRelease = APP_CHANGELOG[selectedVersion.toUpperCase()] || APP_CHANGELOG[selectedVersion] || APP_CHANGELOG["v5.0"];
        setActiveChangelogData(JSON.parse(JSON.stringify(staticRelease)));
      } finally {
        setIsLoadingDoc(false);
      }
    };

    loadVersionDoc();
  }, [selectedVersion, isUpdateModalOpen]);

  if (!isUpdateModalOpen || !activeChangelogData) return null;

  const isUpToDate = currentLocalVersion.toLowerCase() === latestCloudVersion.toLowerCase();

  const handleUpdate = () => {
    if (updating) return;
    setUpdating(true);
    setProgress(0);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(async () => {
          setLocalVersion(latestCloudVersion);
          setUpdating(false);
          
          // 1. Unregister all service workers
          if ('serviceWorker' in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                await registration.unregister();
              }
            } catch (e) {
              console.error('Failed to unregister SW:', e);
            }
          }
          
          // 2. Clear all cache-storage to ensure fresh files
          if ('caches' in window) {
            try {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map(key => caches.delete(key)));
            } catch (e) {
              console.error('Failed to clear caches:', e);
            }
          }

          // 3. Force hard reload (appends cache-bust if possible)
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('_t', Date.now().toString());
            window.location.href = url.toString();
          } catch(e) {
            window.location.reload();
          }
        }, 300);
      } else {
        setProgress(currentProgress);
      }
    }, 100);
  };

  // Editable card handlers
  const updateGroupTitle = (group: 'A' | 'B', title: string) => {
    setActiveChangelogData(prev => {
      if (!prev) return null;
      if (group === 'A') {
        return { ...prev, featuresGroupA: { ...prev.featuresGroupA, sectionTitle: title } };
      } else {
        return { ...prev, featuresGroupB: { ...prev.featuresGroupB, sectionTitle: title } };
      }
    });
  };

  const addItem = (group: 'A' | 'B', iconName: any) => {
    const newItem: UpdateItem = {
      title: "",
      desc: "",
      iconName
    };
    setActiveChangelogData(prev => {
      if (!prev) return null;
      if (group === 'A') {
        return {
          ...prev,
          featuresGroupA: { ...prev.featuresGroupA, items: [...prev.featuresGroupA.items, newItem] }
        };
      } else {
        return {
          ...prev,
          featuresGroupB: { ...prev.featuresGroupB, items: [...prev.featuresGroupB.items, newItem] }
        };
      }
    });
  };

  const deleteItem = (group: 'A' | 'B', index: number) => {
    setActiveChangelogData(prev => {
      if (!prev) return null;
      if (group === 'A') {
        const filtered = prev.featuresGroupA.items.filter((_, idx) => idx !== index);
        return { ...prev, featuresGroupA: { ...prev.featuresGroupA, items: filtered } };
      } else {
        const filtered = prev.featuresGroupB.items.filter((_, idx) => idx !== index);
        return { ...prev, featuresGroupB: { ...prev.featuresGroupB, items: filtered } };
      }
    });
  };

  const updateCardField = (group: 'A' | 'B', index: number, field: keyof UpdateItem, val: string) => {
    setActiveChangelogData(prev => {
      if (!prev) return null;
      if (group === 'A') {
        const copy = [...prev.featuresGroupA.items];
        copy[index] = { ...copy[index], [field]: val };
        return { ...prev, featuresGroupA: { ...prev.featuresGroupA, items: copy } };
      } else {
        const copy = [...prev.featuresGroupB.items];
        copy[index] = { ...copy[index], [field]: val };
        return { ...prev, featuresGroupB: { ...prev.featuresGroupB, items: copy } };
      }
    });
  };

  const handlePublish = async () => {
    if (!activeChangelogData) return;
    const rawVersion = activeChangelogData.version.trim();
    if (!rawVersion) {
      alert("Please provide a valid version string (e.g. V5.1)");
      return;
    }

    setIsPublishing(true);
    const verId = rawVersion.toUpperCase();
    const verKey = rawVersion.toLowerCase();
    
    // Check if this is an older version being edited
    const isExistingOld = allVersions.some(v => v.version.toLowerCase() === verKey && verKey !== latestCloudVersion.toLowerCase());

    const payload = {
      ...activeChangelogData,
      version: verId,
      createdAt: (activeChangelogData as any).createdAt || new Date().toISOString()
    };

    try {
      // 1. Save main update record
      const docRef = doc(db, 'app_updates', verKey);
      await setDoc(docRef, payload);

      // 2. Save pointer to latest pointer ONLY if not editing an older version
      if (!isExistingOld) {
        const pointerRef = doc(db, 'metadata', 'release');
        await setDoc(pointerRef, { latestVersion: verId });

        setSelectedVersion(verId);
        setLocalVersion(verId); // Sync own local storage immediately
      }
      
      setIsEditMode(false);
      await fetchVersionsIndex();

      alert(isExistingOld ? `Draft for ${verId} updated successfully!` : `Version ${verId} published successfully! Pulsating unread badge is now lit for all client environments.`);
    } catch (err) {
      console.error("Failed to commit release details:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `app_updates/${verKey}`);
      } catch (jsonErr: any) {
        alert(`Write Rejected: ${jsonErr.message}`);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const verKey = versionId.toLowerCase();
      
      // 1. Delete from database
      const docRef = doc(db, 'app_updates', verKey);
      await deleteDoc(docRef);

      // 2. Local State Cleanup
      const updatedVersions = allVersions.filter(v => v.version.toLowerCase() !== verKey);
      setAllVersions(updatedVersions);

      // 3. Pointer Rollback (Crucial)
      if (verKey === latestCloudVersion.toLowerCase()) {
        const remainingLatest = updatedVersions.length > 0 ? updatedVersions[0].version : 'v1.0.0';
        const pointerRef = doc(db, 'metadata', 'release');
        await setDoc(pointerRef, { latestVersion: remainingLatest });
      }

      alert(`Version ${versionId} deleted successfully!`);

      // 4. Force UI refresh
      if (selectedVersion.toLowerCase() === verKey) {
        if (updatedVersions.length > 0) {
          setSelectedVersion(updatedVersions[0].version);
        }
      }
    } catch (err) {
      console.error("Failed to delete release details:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `app_updates/${versionId.toLowerCase()}`);
      } catch (jsonErr: any) {
        alert(`Delete Rejected: ${jsonErr.message}`);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !updating && !isPublishing && setUpdateModalOpen(false)}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal panel body */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col"
        >
          {/* Top Banner (custom styling) */}
          <div className={`relative p-6 px-8 ${ts.banner} shrink-0 select-none`}>
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              {isEditMode ? (
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                  type="text"
                  className={`px-3 py-1 ${ts.inputBadge} font-semibold text-[10px] uppercase tracking-widest rounded-full focus:outline-none focus:ring-1 max-w-[140px]`}
                  value={activeChangelogData.badgeText}
                  onChange={(e) => setActiveChangelogData(prev => prev ? ({ ...prev, badgeText: e.target.value }) : null)}
                  placeholder="BADGE TEXT"
                />
              ) : (
                <span className={`px-3 py-1 ${ts.badge} font-semibold text-[10px] uppercase tracking-widest rounded-full`}>
                  {activeChangelogData.badgeText}
                </span>
              )}
              
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    {/* Add New Update Button */}
                    <button
                      onClick={() => {
                        setIsEditMode(true);
                        const nextVerNum = parseInt(latestCloudVersion.replace(/[^0-9]/g, '')) + 1 || 2;
                        setActiveChangelogData({
                          version: `V${nextVerNum}.0`,
                          releaseDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
                          title: "",
                          badgeText: "UPDATE",
                          featuresGroupA: { sectionTitle: "", items: [] },
                          featuresGroupB: { sectionTitle: "", items: [] }
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none transition-all bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 dark:hover:bg-emerald-500/20 hover:bg-emerald-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add New Update
                    </button>
                    <button
                      onClick={() => setIsEditMode(prev => !prev)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none transition-all ${
                        isEditMode 
                          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-450 hover:bg-rose-500/20' 
                          : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-450 dark:hover:bg-indigo-500/20 hover:bg-indigo-500/20'
                      }`}
                    >
                      {isEditMode ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Exit Edit Mode
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3.5 h-3.5" />
                          Admin Builder
                        </>
                      )}
                    </button>
                  </>
                )}

                {!updating && !isPublishing && (
                  <button 
                    onClick={() => setUpdateModalOpen(false)}
                    className="rounded-full p-1.5 hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Title & subtitle */}
            {isEditMode ? (
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                type="text"
                className={`w-full text-2xl font-black ${ts.inputTitle} tracking-tight leading-none mb-1 bg-transparent border-b border-dashed hover:border-slate-400 dark:hover:border-slate-600 focus:outline-none py-1`}
                value={activeChangelogData.title}
                onChange={(e) => setActiveChangelogData(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                placeholder="Update Heading"
              />
            ) : (
              <h2 className={`text-2xl font-black ${ts.titleText} tracking-tight leading-none mb-1`} style={ts.titleGlow}>
                {activeChangelogData.title}
              </h2>
            )}

            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
              {isEditMode ? (
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                  type="text"
                  className={`text-xs font-semibold ${ts.inputDate} bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 focus:outline-none py-0.5 max-w-[100px]`}
                  value={activeChangelogData.releaseDate}
                  onChange={(e) => setActiveChangelogData(prev => prev ? ({ ...prev, releaseDate: e.target.value }) : null)}
                  placeholder="RELEASE DATE"
                />
              ) : (
                <span className={ts.dateText}>{activeChangelogData.releaseDate}</span>
              )}
              <span>•</span>
              {isEditMode ? (
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                  type="text"
                  className={`px-2 py-0.5 ${ts.inputVer} font-mono text-[10px] rounded focus:outline-none focus:ring-1 max-w-[60px]`}
                  value={activeChangelogData.version}
                  onChange={(e) => {
                    const originalVer = e.target.value;
                    setActiveChangelogData(prev => prev ? ({ ...prev, version: originalVer }) : null);
                  }}
                  placeholder="VERSION"
                />
              ) : (
                <span className={`px-2 py-0.5 ${ts.versionBadge} font-mono text-[10px] rounded`}>
                  {activeChangelogData.version}
                </span>
              )}
            </div>

            {/* Ambient decoration */}
            <div className={`absolute right-12 bottom-0 w-32 h-32 ${ts.ambientGlow} rounded-full blur-[35px] pointer-events-none`} />
          </div>

          {/* Scrollable update list */}
          <div className="flex-1 overflow-y-auto p-6 px-8 space-y-6 custom-scrollbar max-h-[48vh]">
            {isLoadingDoc ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500">Retrieving cloud log...</span>
              </div>
            ) : (
              <>
                <ChangelogFeatureGroupSection
                  groupKey="A"
                  sectionTitle={activeChangelogData.featuresGroupA.sectionTitle}
                  items={activeChangelogData.featuresGroupA.items}
                  isEditMode={isEditMode}
                  onUpdateGroupTitle={updateGroupTitle}
                  onAddItem={addItem}
                  onDeleteItem={deleteItem}
                  onUpdateCardField={updateCardField}
                />

                <ChangelogFeatureGroupSection
                  groupKey="B"
                  sectionTitle={activeChangelogData.featuresGroupB.sectionTitle}
                  items={activeChangelogData.featuresGroupB.items}
                  isEditMode={isEditMode}
                  onUpdateGroupTitle={updateGroupTitle}
                  onAddItem={addItem}
                  onDeleteItem={deleteItem}
                  onUpdateCardField={updateCardField}
                />
              </>
            )}

            <ChangelogHistoryTimeline
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              allVersions={allVersions}
              latestCloudVersion={latestCloudVersion}
              isOwner={isOwner}
              deleteConfirmId={deleteConfirmId}
              setDeleteConfirmId={setDeleteConfirmId}
              onEditHistoricalVersion={(historyLog) => {
                setActiveChangelogData(historyLog);
                setIsEditMode(true);
                setShowHistory(false);
              }}
              onDeleteVersion={handleDeleteVersion}
            />
          </div>

          {/* Footer controls */}
          <div className="p-6 px-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0 text-center flex flex-col items-center justify-center">
            {isEditMode ? (
              <ChangelogAdminFooter
                activeChangelogData={activeChangelogData}
                allVersions={allVersions}
                latestCloudVersion={latestCloudVersion}
                isOwner={isOwner}
                isPublishing={isPublishing}
                deleteConfirmId={deleteConfirmId}
                setDeleteConfirmId={setDeleteConfirmId}
                onPublish={handlePublish}
                onDeleteVersion={handleDeleteVersion}
              />
            ) : updating ? (
              <div className="w-full max-w-sm">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-650 dark:text-indigo-400" />
                    Patching container updates...
                  </span>
                  <span className="font-mono text-indigo-650 dark:text-indigo-400">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] dark:shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>
            ) : isUpToDate ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Your platform is fully updated to {currentLocalVersion.toUpperCase()}
                </div>
                <button
                  onClick={() => setUpdateModalOpen(false)}
                  className="mt-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 focus:outline-none underline underline-offset-4"
                >
                  Close changelog overview
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-2">
                <button
                  onClick={handleUpdate}
                  className="w-full max-w-sm py-3 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.98] transition-all text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/10 dark:shadow-indigo-500/20 flex items-center justify-center gap-2 border border-indigo-500/20 dark:border-indigo-400/20 focus:outline-none"
                >
                  <RefreshCw className="w-4 h-4 text-white" />
                  Apply Update (To {latestCloudVersion.toUpperCase()})
                </button>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-normal max-w-[340px]">
                  Applying updates keeps client caches warm and updates local system-stores to use {latestCloudVersion.toUpperCase()} presets.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

