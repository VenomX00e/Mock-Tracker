import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Palette, 
  Sliders, 
  BarChart2, 
  Sparkles, 
  Grid, 
  Zap, 
  X, 
  CheckCircle2,
  RefreshCw,
  Trash2,
  Plus,
  History,
  Eye,
  Settings,
  AlertCircle,
  ChevronDown,
  Globe,
  Lock,
  Wrench,
  Check,
  Pencil
} from 'lucide-react';
import { useVersionStore } from '../store/versionStore';
import { useUIStore } from '../store/uiStore';
import { APP_CHANGELOG, LATEST_VERSION, VersionRelease, UpdateItem } from '../config/versionConfig';
import { useAuth } from '../services/AuthContext';
import { doc, getDoc, setDoc, getDocs, collection, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

// Hardened Error Tracking
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

  const getThemeStyles = () => {
    switch (theme) {
      case 'hero-miles':
        return {
          banner: 'bg-gradient-to-tr from-[#1b0a0d] via-[#240e11] to-[#0f0406] border-[#ea3323]/30',
          titleGlow: { textShadow: '0 0 14px rgba(234, 51, 37, 0.45)' },
          titleText: 'text-[#ea3323]',
          badge: 'bg-[#ea3323]/10 border border-[#ea3323]/30 text-[#ea3323]',
          dateText: 'text-[#ea3323]',
          versionBadge: 'bg-[#ea3323]/15 text-rose-300 border border-[#ea3323]/25',
          ambientGlow: 'bg-[#ea3323]/10 dark:bg-[#ea3323]/15',
          inputTitle: 'text-rose-50 border-[#ea3323]/30 focus:border-[#ea3323]',
          inputBadge: 'bg-[#ea3323]/10 dark:bg-[#ea3323]/15 border-[#ea3323]/25 dark:border-[#ea3323]/30 text-[#ea3323] focus:ring-[#ea3323]',
          inputDate: 'text-[#ea3323] border-[#ea3323]/30 focus:border-[#ea3323]',
          inputVer: 'bg-[#ea3323]/10 text-rose-300 border-[#ea3323]/25 focus:ring-[#ea3323]',
        };
      case 'cyber':
        return {
          banner: 'bg-gradient-to-tr from-[#0b0e1a] via-[#111c3a] to-[#070b14] border-sky-500/30',
          titleGlow: { textShadow: '0 0 14px rgba(56, 189, 248, 0.45)' },
          titleText: 'text-sky-450',
          badge: 'bg-sky-500/10 border border-sky-500/30 text-sky-400',
          dateText: 'text-sky-400',
          versionBadge: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
          ambientGlow: 'bg-sky-600/10 dark:bg-sky-600/15',
          inputTitle: 'text-sky-50 border-sky-500/30 focus:border-sky-500',
          inputBadge: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/20 dark:border-sky-500/30 text-sky-400 focus:ring-sky-500',
          inputDate: 'text-sky-400 border-sky-500/30 focus:border-sky-500',
          inputVer: 'bg-sky-500/10 text-sky-300 border-sky-500/25 focus:ring-sky-500',
        };
      case 'cyber-light':
        return {
          banner: 'bg-gradient-to-tr from-sky-100 via-sky-50/70 to-sky-100 border-sky-200',
          titleGlow: { textShadow: '0 1px 2px rgba(14, 165, 233, 0.1)' },
          titleText: 'text-sky-900',
          badge: 'bg-sky-100 border border-sky-200 text-sky-700',
          dateText: 'text-sky-600',
          versionBadge: 'bg-sky-100 text-sky-700 border border-sky-200',
          ambientGlow: 'bg-sky-400/5',
          inputTitle: 'text-sky-900 border-sky-300 focus:border-sky-500',
          inputBadge: 'bg-sky-100 border-sky-200 text-sky-700 focus:ring-sky-500',
          inputDate: 'text-sky-600 border-sky-300 focus:border-sky-500',
          inputVer: 'bg-sky-100 text-sky-700 border-sky-200 focus:ring-sky-500',
        };
      case 'cyber-green':
        return {
          banner: 'bg-gradient-to-tr from-[#05140b] via-[#092815] to-[#020a05] border-emerald-500/30',
          titleGlow: { textShadow: '0 0 14px rgba(34, 197, 94, 0.45)' },
          titleText: 'text-emerald-400',
          badge: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
          dateText: 'text-emerald-500',
          versionBadge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
          ambientGlow: 'bg-emerald-600/10 dark:bg-emerald-600/15',
          inputTitle: 'text-emerald-50 border-emerald-500/30 focus:border-emerald-500',
          inputBadge: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 dark:border-emerald-500/30 text-emerald-400 focus:ring-emerald-500',
          inputDate: 'text-emerald-400 border-emerald-500/30 focus:border-emerald-500',
          inputVer: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 focus:ring-emerald-500',
        };
      case 'cyber-green-light':
        return {
          banner: 'bg-gradient-to-tr from-emerald-100 via-emerald-50/75 to-emerald-100 border-emerald-200',
          titleGlow: { textShadow: '0 1px 2px rgba(16, 185, 129, 0.1)' },
          titleText: 'text-emerald-900',
          badge: 'bg-emerald-100 border border-emerald-200 text-emerald-700',
          dateText: 'text-emerald-600',
          versionBadge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
          ambientGlow: 'bg-emerald-400/5',
          inputTitle: 'text-emerald-900 border-emerald-300 focus:border-emerald-500',
          inputBadge: 'bg-emerald-100 border-emerald-200 text-emerald-700 focus:ring-emerald-555',
          inputDate: 'text-emerald-600 border-emerald-300 focus:border-emerald-500',
          inputVer: 'bg-emerald-100 text-emerald-70 border-emerald-200 focus:ring-emerald-555',
        };
      case 'cyber-lavender':
        return {
          banner: 'bg-gradient-to-tr from-[#120b1c] via-[#1d0f30] to-[#09050d] border-purple-500/30',
          titleGlow: { textShadow: '0 0 14px rgba(168, 85, 247, 0.45)' },
          titleText: 'text-purple-400',
          badge: 'bg-purple-500/10 border border-purple-500/30 text-purple-400',
          dateText: 'text-purple-400',
          versionBadge: 'bg-purple-500/15 text-purple-300 border border-purple-500/25',
          ambientGlow: 'bg-purple-600/10 dark:bg-purple-600/15',
          inputTitle: 'text-purple-50 border-purple-500/30 focus:border-purple-500',
          inputBadge: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20 dark:border-purple-500/30 text-purple-400 focus:ring-purple-500',
          inputDate: 'text-purple-400 border-purple-500/30 focus:border-purple-500',
          inputVer: 'bg-purple-500/10 text-purple-300 border-purple-500/25 focus:ring-purple-555',
        };
      case 'cyber-lavender-light':
        return {
          banner: 'bg-gradient-to-tr from-purple-100 via-purple-50/75 to-purple-100 border-purple-200',
          titleGlow: { textShadow: '0 1px 2px rgba(168, 85, 247, 0.1)' },
          titleText: 'text-purple-900',
          badge: 'bg-purple-100 border border-purple-200 text-purple-700',
          dateText: 'text-purple-600',
          versionBadge: 'bg-purple-100 text-purple-700 border border-purple-200',
          ambientGlow: 'bg-purple-400/5',
          inputTitle: 'text-purple-900 border-purple-300 focus:border-purple-500',
          inputBadge: 'bg-purple-100 border-purple-200 text-purple-700 focus:ring-purple-500',
          inputDate: 'text-purple-600 border-purple-300 focus:border-purple-500',
          inputVer: 'bg-purple-100 text-purple-70 border-purple-200 focus:ring-purple-500',
        };
      case 'cyber-pink':
        return {
          banner: 'bg-gradient-to-tr from-[#1c0812] via-[#2c0e20] to-[#0f040a] border-pink-500/30',
          titleGlow: { textShadow: '0 0 14px rgba(236, 72, 153, 0.45)' },
          titleText: 'text-pink-400',
          badge: 'bg-pink-500/10 border border-pink-500/30 text-pink-400',
          dateText: 'text-pink-400',
          versionBadge: 'bg-pink-500/15 text-pink-300 border border-pink-500/25',
          ambientGlow: 'bg-pink-600/10 dark:bg-pink-600/15',
          inputTitle: 'text-pink-50 border-pink-500/30 focus:border-pink-500',
          inputBadge: 'bg-pink-500/10 dark:bg-pink-500/15 border-pink-500/20 dark:border-pink-500/30 text-pink-400 focus:ring-pink-500',
          inputDate: 'text-pink-400 border-pink-500/30 focus:border-pink-500',
          inputVer: 'bg-pink-500/10 text-pink-300 border-pink-500/25 focus:ring-pink-500',
        };
      case 'cyber-pink-light':
        return {
          banner: 'bg-gradient-to-tr from-pink-100 via-pink-50/75 to-pink-100 border-pink-200',
          titleGlow: { textShadow: '0 1px 2px rgba(236, 72, 153, 0.1)' },
          titleText: 'text-pink-900',
          badge: 'bg-pink-100 border border-pink-200 text-pink-700',
          dateText: 'text-pink-600',
          versionBadge: 'bg-pink-100 text-pink-700 border border-pink-200',
          ambientGlow: 'bg-pink-400/5',
          inputTitle: 'text-pink-900 border-pink-300 focus:border-pink-500',
          inputBadge: 'bg-pink-100 border-pink-200 text-pink-700 focus:ring-pink-500',
          inputDate: 'text-pink-600 border-pink-300 focus:border-pink-500',
          inputVer: 'bg-pink-100 text-pink-70 border-pink-200 focus:ring-pink-500',
        };
      case 'cyber-orange':
        return {
          banner: 'bg-gradient-to-tr from-[#1f0e08] via-[#31170d] to-[#100704] border-amber-500/30',
          titleGlow: { textShadow: '0 0 14px rgba(245, 158, 11, 0.45)' },
          titleText: 'text-amber-400',
          badge: 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
          dateText: 'text-amber-500',
          versionBadge: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
          ambientGlow: 'bg-amber-600/10 dark:bg-amber-600/15',
          inputTitle: 'text-amber-50 border-amber-500/30 focus:border-amber-500',
          inputBadge: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 dark:border-amber-500/30 text-amber-400 focus:ring-amber-500',
          inputDate: 'text-amber-450 border-amber-500/30 focus:border-[#ea3323]',
          inputVer: 'bg-amber-500/10 text-amber-300 border-amber-500/25 focus:ring-amber-500',
        };
      case 'cyber-orange-light':
        return {
          banner: 'bg-gradient-to-tr from-amber-100 via-amber-50/75 to-amber-100 border-amber-200',
          titleGlow: { textShadow: '0 1px 2px rgba(245, 158, 11, 0.1)' },
          titleText: 'text-amber-900',
          badge: 'bg-amber-100 border border-amber-200 text-amber-700',
          dateText: 'text-amber-650',
          versionBadge: 'bg-amber-100 text-amber-700 border border-amber-200',
          ambientGlow: 'bg-amber-400/5',
          inputTitle: 'text-amber-900 border-amber-300 focus:border-amber-500',
          inputBadge: 'bg-amber-100 border-amber-200 text-amber-700 focus:ring-amber-500',
          inputDate: 'text-amber-600 border-amber-300 focus:border-amber-500',
          inputVer: 'bg-amber-100 text-amber-70 border-amber-200 focus:ring-amber-500',
        };
      case 'dark':
        return {
          banner: 'bg-gradient-to-tr from-slate-950 via-[#131139] to-slate-950 border-indigo-500/25',
          titleGlow: { textShadow: '0 0 12px rgba(99, 102, 241, 0.4)' },
          titleText: 'text-white',
          badge: 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400',
          dateText: 'text-indigo-400',
          versionBadge: 'bg-slate-800 text-slate-300 border border-slate-700',
          ambientGlow: 'bg-indigo-600/10',
          inputTitle: 'text-white border-indigo-500/30 focus:border-indigo-500',
          inputBadge: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 dark:border-indigo-500/30 text-indigo-400 focus:ring-indigo-500',
          inputDate: 'text-indigo-400 border-indigo-500/30 focus:border-indigo-500',
          inputVer: 'bg-slate-800 text-slate-300 border-slate-700 focus:ring-slate-500',
        };
      case 'light':
      default:
        return {
          banner: 'bg-gradient-to-tr from-slate-200 via-slate-50 to-slate-200 border-slate-205',
          titleGlow: { textShadow: '0 1px 1px rgba(99, 102, 241, 0.05)' },
          titleText: 'text-slate-900',
          badge: 'bg-indigo-50 border border-indigo-100 text-indigo-600',
          dateText: 'text-indigo-600',
          versionBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
          ambientGlow: 'bg-indigo-600/5',
          inputTitle: 'text-slate-900 border-slate-300 focus:border-indigo-500',
          inputBadge: 'bg-indigo-50/80 border-indigo-150 text-indigo-600 focus:ring-indigo-500',
          inputDate: 'text-indigo-600 border-slate-300 focus:border-indigo-500',
          inputVer: 'bg-slate-100 text-slate-700 border-slate-200 focus:ring-indigo-500',
        };
    }
  };

  const ts = getThemeStyles();

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
    setUpdating(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setLocalVersion(latestCloudVersion);
            setUpdating(false);
            window.location.reload();
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'brain': return <Brain className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      case 'palette': return <Palette className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
      case 'sliders': return <Sliders className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
      case 'chart': return <BarChart2 className="w-5 h-5 text-pink-500 dark:text-pink-400" />;
      case 'zap': return <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
      case 'grid': return <Grid className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
      default: return <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    }
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
                <input 
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
              <input 
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
                <input 
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
                <input 
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
                {/* Features Group A */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-900 pb-1.5">
                    {isEditMode ? (
                      <input 
                        type="text"
                        className="w-full text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none py-0.5"
                        value={activeChangelogData.featuresGroupA.sectionTitle}
                        onChange={(e) => updateGroupTitle('A', e.target.value)}
                        placeholder="Group A Header"
                      />
                    ) : (
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                        {activeChangelogData.featuresGroupA.sectionTitle}
                      </h3>
                    )}
                  </div>

                  {/* Add icon dock for Admin Mode */}
                  {isEditMode && (
                    <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-2 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Insert Card with Icon:</span>
                      {['brain', 'palette', 'sliders', 'chart', 'sparkles', 'grid', 'zap'].map((ico) => (
                        <button
                          key={ico}
                          onClick={() => addItem('A', ico)}
                          type="button"
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title={`Add card with ${ico} icon`}
                        >
                          {getIcon(ico)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {activeChangelogData.featuresGroupA.items.map((item, id) => (
                      <div key={id} className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-800 transition-colors group relative items-start">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-inner">
                          {getIcon(item.iconName)}
                        </div>
                        
                        {isEditMode ? (
                          <div className="flex-1 space-y-1.5">
                            <input 
                              type="text"
                              className="w-full text-sm font-semibold border-b border-dashed border-slate-300 dark:border-slate-750 hover:border-slate-400 dark:hover:border-slate-600 bg-transparent py-0.5 focus:border-indigo-500 focus:outline-none text-slate-800 dark:text-slate-100"
                              value={item.title}
                              onChange={(e) => updateCardField('A', id, 'title', e.target.value)}
                              placeholder="New Feature / Update Card"
                            />
                            <textarea 
                              className="w-full text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent rounded p-1.5 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                              rows={2}
                              value={item.desc}
                              onChange={(e) => updateCardField('A', id, 'desc', e.target.value)}
                              placeholder="Double-click to edit feature title and descriptions."
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-0.5">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        )}

                        {isEditMode && (
                          <button
                            onClick={() => deleteItem('A', id)}
                            type="button"
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-red-500 rounded-lg transition-colors ml-2 shrink-0 self-center"
                            title="Remove card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {activeChangelogData.featuresGroupA.items.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">No items listed in this cluster. Toggle Edit mode to insert nodes.</p>
                    )}
                  </div>
                </div>

                {/* Features Group B */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-900 pb-1.5">
                    {isEditMode ? (
                      <input 
                        type="text"
                        className="w-full text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none py-0.5"
                        value={activeChangelogData.featuresGroupB.sectionTitle}
                        onChange={(e) => updateGroupTitle('B', e.target.value)}
                        placeholder="Group B Header"
                      />
                    ) : (
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        {activeChangelogData.featuresGroupB.sectionTitle}
                      </h3>
                    )}
                  </div>

                  {/* Add icon dock for Group B in Admin Mode */}
                  {isEditMode && (
                    <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-2 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Insert Card with Icon:</span>
                      {['brain', 'palette', 'sliders', 'chart', 'sparkles', 'grid', 'zap'].map((ico) => (
                        <button
                          key={ico}
                          onClick={() => addItem('B', ico)}
                          type="button"
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title={`Add card with ${ico} icon`}
                        >
                          {getIcon(ico)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {activeChangelogData.featuresGroupB.items.map((item, id) => (
                      <div key={id} className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-800 transition-colors group relative items-start">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-inner">
                          {getIcon(item.iconName)}
                        </div>
                        
                        {isEditMode ? (
                          <div className="flex-1 space-y-1.5">
                            <input 
                              type="text"
                              className="w-full text-sm font-semibold border-b border-dashed border-slate-300 dark:border-slate-750 hover:border-slate-400 dark:hover:border-slate-600 bg-transparent py-0.5 focus:border-indigo-500 focus:outline-none text-slate-800 dark:text-slate-100"
                              value={item.title}
                              onChange={(e) => updateCardField('B', id, 'title', e.target.value)}
                              placeholder="New Feature / Update Card"
                            />
                            <textarea 
                              className="w-full text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent rounded p-1.5 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                              rows={2}
                              value={item.desc}
                              onChange={(e) => updateCardField('B', id, 'desc', e.target.value)}
                              placeholder="Double-click to edit feature title and descriptions."
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-0.5">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        )}

                        {isEditMode && (
                          <button
                            onClick={() => deleteItem('B', id)}
                            type="button"
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-red-500 rounded-lg transition-colors ml-2 shrink-0 self-center"
                            title="Remove card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {activeChangelogData.featuresGroupB.items.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">No items listed in this cluster. Toggle Edit mode to insert nodes.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Historical Timeline */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 border-dashed space-y-12">
                    {allVersions
                      .filter(v => v.version.toLowerCase() !== latestCloudVersion.toLowerCase())
                      .map((historyLog) => (
                        <div key={historyLog.version} className="space-y-6">
                          <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                              {historyLog.version.toUpperCase()} - {historyLog.title}
                            </h2>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px] rounded border border-slate-200 dark:border-slate-700">
                              {historyLog.releaseDate}
                            </span>
                            {isOwner && (
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveChangelogData(historyLog);
                                    setIsEditMode(true);
                                    setShowHistory(false);
                                  }}
                                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors relative z-50 pointer-events-auto"
                                  title="Edit Update"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {deleteConfirmId === historyLog.version && (
                                  <span className="text-[10px] text-rose-500 font-medium animate-pulse">Click again to confirm</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (deleteConfirmId === historyLog.version) {
                                      handleDeleteVersion(historyLog.version);
                                      setDeleteConfirmId(null);
                                    } else {
                                      setDeleteConfirmId(historyLog.version);
                                      setTimeout(() => setDeleteConfirmId(null), 3000);
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors relative z-50 pointer-events-auto ${deleteConfirmId === historyLog.version ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-600' : 'hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'}`}
                                  title="Delete Update"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Historical Group A */}
                          {historyLog.featuresGroupA && historyLog.featuresGroupA.items.length > 0 && (
                            <div>
                              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-3 flex items-center gap-2 opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                                {historyLog.featuresGroupA.sectionTitle}
                              </h3>
                              <div className="space-y-3">
                                {historyLog.featuresGroupA.items.map((item, id) => (
                                  <div key={id} className="flex gap-4 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/40 items-start">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/50 dark:bg-slate-950/50 flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50 shadow-sm opacity-80 scale-90">
                                      {getIcon(item.iconName)}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-0.5">
                                        {item.title}
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                        {item.desc}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Historical Group B */}
                          {historyLog.featuresGroupB && historyLog.featuresGroupB.items.length > 0 && (
                            <div>
                              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 mb-3 flex items-center gap-2 opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                {historyLog.featuresGroupB.sectionTitle}
                              </h3>
                              <div className="space-y-3">
                                {historyLog.featuresGroupB.items.map((item, id) => (
                                  <div key={id} className="flex gap-4 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/40 items-start">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/50 dark:bg-slate-950/50 flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50 shadow-sm opacity-80 scale-90">
                                      {getIcon(item.iconName)}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-0.5">
                                        {item.title}
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                        {item.desc}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show History Toggle */}
            <div className="flex justify-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[13px] font-medium text-[#7d9c6e] hover:text-[#8cb07c] dark:text-[#8aa67d] dark:hover:text-[#9abc8d] transition-colors focus:outline-none flex items-center justify-center"
              >
                {showHistory ? "Hide previous changes" : "Show previous changes"}
              </button>
            </div>
          </div>

          {/* Footer controls */}
          <div className="p-6 px-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0 text-center flex flex-col items-center justify-center">
            {isEditMode ? (
              <div className="w-full flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="w-full max-w-sm py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 border border-emerald-500/20 focus:outline-none disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Publishing Build Logs...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 animate-pulse" />
                      {allVersions.some(v => v.version.toLowerCase() === activeChangelogData?.version.toLowerCase() && activeChangelogData.version.toLowerCase() !== latestCloudVersion.toLowerCase()) ? "Update Historical Draft" : "Publish Update to All Users"}
                    </>
                  )}
                </button>
                {isOwner && allVersions.some(v => v.version.toLowerCase() === activeChangelogData?.version.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (deleteConfirmId === activeChangelogData!.version) {
                        handleDeleteVersion(activeChangelogData!.version);
                        setDeleteConfirmId(null);
                      } else {
                        setDeleteConfirmId(activeChangelogData!.version);
                        setTimeout(() => setDeleteConfirmId(null), 3000);
                      }
                    }}
                    disabled={isPublishing}
                    className={`w-full max-w-sm py-2 px-6 mt-1.5 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border focus:outline-none transition-colors disabled:opacity-50 relative z-50 pointer-events-auto ${
                      deleteConfirmId === activeChangelogData!.version 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse'
                      : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 border-rose-500/20'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleteConfirmId === activeChangelogData!.version ? "Click to Confirm Deletion" : "Delete Published Version"}
                  </button>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  Only authenticated owners can commit update nodes. Rules validated.
                </div>
              </div>
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
