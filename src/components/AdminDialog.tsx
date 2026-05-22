import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, getDocs, doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { calculateStats } from "../hooks/useMocks";
import { UserProfile } from "../types";
import {
  Shield,
  UserX,
  UserCheck,
  MessageSquareOff,
  MessageSquare,
  AlertCircle,
  Save,
  X,
  Radio,
  FileText,
  Users,
  Calendar,
  Timer,
  Trash2,
  Settings,
  ArrowLeft,
  Search,
} from "lucide-react";
import { CustomDropdown } from "./CustomDropdown";
import { EXAMS, ROLES, PHASES, SCOPES, PLATFORMS } from "../lib/constants";
import { parseMockAnnouncementImage } from "../services/geminiService";
import { getErrorMessage } from "../lib/errorUtils";
import { AdminCategoriesTab } from "./AdminCategoriesTab";
import AdminQuotesTab from "./admin/AdminQuotesTab";
import { AdminMigrationTool } from "./AdminMigrationTool";

import { ExamCategory } from "../types";

interface AdminDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  isOwner?: boolean;
  adminPermissions?: any;
  initialTab?:
    | "users"
    | "liveMock"
    | "notice"
    | "countdown"
    | "challenge"
    | "settings"
    | "quotes"
    | "categories"
    | "admins";
  editNoticeData?: any;
  editCountdownData?: any;
  asPage?: boolean;
  categories: ExamCategory[];
  currentCategory?: string | null;
}

import { useAuth } from "../services/AuthContext";

export default function AdminDialog({
  isOpen,
  onClose,
  isOwner,
  adminPermissions,
  initialTab = "users",
  editNoticeData = null,
  editCountdownData = null,
  asPage = false,
  categories,
  currentCategory = null,
}: AdminDialogProps) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "users"
    | "liveMock"
    | "notice"
    | "countdown"
    | "challenge"
    | "settings"
    | "categories"
    | "admins"
    | "quotes"
  >(initialTab as any);
  const [adminCategoryScope, setAdminCategoryScope] = useState<string | null>(
    !isOwner && currentCategory ? currentCategory : null,
  );
  const isForcedCategory = !isOwner && currentCategory !== null;

  // Challenge inputs
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeType, setChallengeType] = useState("streak");
  const [challengeStartDate, setChallengeStartDate] = useState("");
  const [challengeEndDate, setChallengeEndDate] = useState("");
  const [challengeDuration, setChallengeDuration] = useState("");
  const [challengeTasks, setChallengeTasks] = useState<
    { id: string; text: string }[]
  >([]);
  const [challengeTodoFrequency, setChallengeTodoFrequency] = useState<
    "oneTime" | "daily"
  >("daily");
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(
    null,
  );

  const [bannedUsers, setBannedUsers] = useState<UserProfile[]>([]);
  const [mutedUsers, setMutedUsers] = useState<UserProfile[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<UserProfile[]>([]);
  const [allFirebaseUsers, setAllFirebaseUsers] = useState<UserProfile[]>([]);
  const [userFilter, setUserFilter] = useState<"active" | "all" | "admins">(
    "active",
  );
  const [adminManagementCategoryFilter, setAdminManagementCategoryFilter] =
    useState<string | "all">("all");
  const [loading, setLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Live mock & notice inputs
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeDescription, setNoticeDescription] = useState("");
  const [noticeLink, setNoticeLink] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeUrgency, setNoticeUrgency] = useState("");
  const [noticeTags, setNoticeTags] = useState("");
  const [noticeEditableBy, setNoticeEditableBy] = useState<"admin" | "users">(
    "admin",
  );
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  // Countdown inputs
  const [countdownTitle, setCountdownTitle] = useState("");
  const [countdownDate, setCountdownDate] = useState("");
  const [countdownNote, setCountdownNote] = useState("");
  const [countdownColor, setCountdownColor] = useState("green");
  const [editingCountdownId, setEditingCountdownId] = useState<string | null>(
    null,
  );

  // Custom states for Live Mock
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [editingLiveMockId, setEditingLiveMockId] = useState<string | null>(
    null,
  );

  const [liveMockData, setLiveMockData] = useState({
    examType: "",
    examRole: "",
    examPhase: "Prelims",
    examScope: "Full",
    mockName: "",
    platform: "",
    date: "",
  });

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
    if (editNoticeData && initialTab === "notice") {
      setEditingNoticeId(editNoticeData.id);
      setNoticeTitle(editNoticeData.title || "");
      setNoticeDescription(editNoticeData.description || "");
      setNoticeLink(editNoticeData.link || "");
      setNoticeDate(editNoticeData.date || "");
      setNoticeUrgency(editNoticeData.urgency || "");
      setNoticeTags(
        Array.isArray(editNoticeData.tags)
          ? editNoticeData.tags.join(", ")
          : editNoticeData.tags || "",
      );
      setNoticeEditableBy(editNoticeData.editableBy || "admin");
      if (editNoticeData.categoryId)
        setAdminCategoryScope(editNoticeData.categoryId);
    } else if (editCountdownData && initialTab === "countdown") {
      setEditingCountdownId(editCountdownData.id);
      setCountdownTitle(editCountdownData.title || "");
      setCountdownDate(editCountdownData.date || "");
      setCountdownNote(editCountdownData.note || "");
      setCountdownColor(editCountdownData.color || "green");
      if (editCountdownData.categoryId)
        setAdminCategoryScope(editCountdownData.categoryId);
    }
  }, [initialTab, editNoticeData, editCountdownData, isOpen]);

  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const adminListRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        adminListRef.current &&
        !adminListRef.current.contains(event.target as Node)
      ) {
        setExpandedAdminId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialTab !== undefined) {
        setActiveTab(initialTab as any);
      }
      fetchUsers();
      fetchAnnouncement();
    }
  }, [isOpen, initialTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"));
      const snap = await getDocs(q);
      const allUsers = snap.docs
        .map((d) => d.data() as UserProfile)
        .sort((a, b) => {
          const getMs = (val: any) => {
            if (!val) return 0;
            if (typeof val === "number") return val;
            if (val.toMillis) return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            return new Date(val).getTime() || 0;
          };
          const t1 = getMs(a.lastActiveAt);
          const t2 = getMs(b.lastActiveAt);
          return t2 - t1;
        });
      setBannedUsers(allUsers.filter((u) => u.isBanned));
      setMutedUsers(allUsers.filter((u) => u.isMuted && !u.isBanned));
      setAllAppUsers(
        allUsers.filter(
          (u) =>
            !u.isBanned &&
            !u.isMuted &&
            u.totalTests > 0 &&
            u.userId !== currentUser?.uid,
        ),
      );
      setAllFirebaseUsers(allUsers);
    } catch (error) {
      console.error("Error fetching users", error);
    }
    setLoading(false);
  };

  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [telegramLink, setTelegramLink] = useState("");
  const [telegramText, setTelegramText] = useState("Contact us");
  const [muteDurationDays, setMuteDurationDays] = useState<number | string>(7);

  const fetchAnnouncement = async () => {
    try {
      const snap = await getDocs(query(collection(db, "system")));
      const chalSnap = await getDocs(query(collection(db, "challenges")));
      const tempMocks: any[] = [];
      const tempNotices: any[] = [];
      const tempCountdowns: any[] = [];
      const tempChallenges: any[] = [];

      snap.forEach((d) => {
        const data = d.data();
        if (d.id === "settings") {
          setTelegramLink(data.telegramLink || "");
          setTelegramText(data.telegramText || "Contact us");
          setMuteDurationDays(data.muteDurationDays || 7);
        } else if (data.type === "notice") {
          tempNotices.push({ id: d.id, ...data });
        } else if (data.type === "liveMock") {
          tempMocks.push({ id: d.id, ...data });
        } else if (data.type === "countdown") {
          tempCountdowns.push({ id: d.id, ...data });
        }
      });

      chalSnap.forEach((d) => {
        tempChallenges.push({ id: d.id, ...d.data() });
      });

      setLiveMocks(tempMocks);
      setNotices(tempNotices);
      setCountdowns(tempCountdowns);
      setChallenges(tempChallenges);
    } catch (error) {
      console.error(error);
    }
  };

  const saveSettings = async (
    silent: boolean | React.FocusEvent<HTMLInputElement> = false,
  ) => {
    const isSilent = typeof silent === "boolean" ? silent : true;
    setSavingAnnouncement(true);
    try {
      await setDoc(
        doc(db, "system", "settings"),
        {
          type: "settings",
          telegramLink,
          telegramText,
          muteDurationDays: Number(muteDurationDays) || 1,
        },
        { merge: true },
      );
      if (!isSilent) alert("Settings saved successfully");
    } catch (error) {
      console.error(error);
      if (!isSilent) alert("Failed to save settings");
    }
    setSavingAnnouncement(false);
  };

  const getPrefix = (categoryId: string | null) => {
    if (!categoryId) return "";
    const currentCat = categories.find((c) => c.id === categoryId);
    const prefix = currentCat?.subjectPrefix || categoryId;
    return prefix.replace(/_$/, "").toUpperCase();
  };

  const saveNotice = async () => {
    setSavingAnnouncement(true);
    try {
      if (!noticeTitle) {
        alert("Notice title is required");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingNoticeId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_NOTICE_${Date.now()}`
          : `notice_${Date.now()}`);
      await setDoc(
        doc(db, "system", newId),
        {
          type: "notice",
          title: noticeTitle,
          categoryId: adminCategoryScope || null,
          description: noticeDescription,
          link: noticeLink,
          date: noticeDate,
          urgency: noticeUrgency,
          tags: noticeTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          editableBy: noticeEditableBy,
          updatedAt: new Date().toISOString(),
        },
        { merge: !!editingNoticeId },
      );
      alert(
        editingNoticeId
          ? "Notice updated successfully"
          : "Notice saved successfully",
      );
      setEditingNoticeId(null);
      setNoticeTitle("");
      setNoticeDescription("");
      setNoticeLink("");
      setNoticeDate("");
      setNoticeUrgency("");
      setNoticeTags("");
      setNoticeEditableBy("admin");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving notice", error);
      alert("Failed to save notice");
    }
    setSavingAnnouncement(false);
  };

  const handleEditNotice = (n: any) => {
    setEditingNoticeId(n.id);
    setNoticeTitle(n.title || "");
    setNoticeDescription(n.description || "");
    setNoticeLink(n.link || "");
    setNoticeDate(n.date || "");
    setNoticeUrgency(n.urgency || "info");
    setNoticeTags(Array.isArray(n.tags) ? n.tags.join(", ") : "");
    setNoticeEditableBy(n.editableBy || "admin");
  };

  const saveLiveMock = async () => {
    setSavingAnnouncement(true);
    try {
      if (!liveMockData.mockName || !liveMockData.examType) {
        alert("Mock Name and Exam Type are required.");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingLiveMockId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_LIVEMOCK_${Date.now()}`
          : `liveMock_${Date.now()}`);
      await setDoc(
        doc(db, "system", newId),
        {
          type: "liveMock",
          ...liveMockData,
          categoryId: adminCategoryScope || null,
          title: `Live: ${liveMockData.mockName}`,
          description: `Join the community in taking the ${liveMockData.examType} ${liveMockData.examRole} ${liveMockData.examPhase} mock on ${liveMockData.platform || "any platform"}.`,
          link: "",
          updatedAt: new Date().toISOString(),
        },
        { merge: !!editingLiveMockId },
      );
      alert(
        editingLiveMockId
          ? "Live Mock updated successfully"
          : "Live Mock saved successfully",
      );
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
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving live mock", error);
      alert("Failed to save live mock");
    }
    setSavingAnnouncement(false);
  };

  const handleEditLiveMock = (m: any) => {
    setEditingLiveMockId(m.id);
    if (!EXAMS.includes(m.examType)) setIsCustomExam(true);
    else setIsCustomExam(false);
    if (!ROLES.includes(m.examRole)) setIsCustomRole(true);
    else setIsCustomRole(false);
    if (!PHASES.includes(m.examPhase)) setIsCustomPhase(true);
    else setIsCustomPhase(false);
    if (!PLATFORMS.includes(m.platform)) setIsCustomPlatform(true);
    else setIsCustomPlatform(false);

    setLiveMockData({
      examType: m.examType || "",
      examRole: m.examRole || "",
      examPhase: m.examPhase || "Prelims",
      examScope: m.examScope || "Full",
      mockName: m.mockName || "",
      platform: m.platform || "",
      date: m.date || "",
    });
    if (m.categoryId) setAdminCategoryScope(m.categoryId);
  };

  const deleteLiveMock = async (id: string) => {
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete live mock");
    }
  };

  const saveChallenge = async () => {
    setSavingAnnouncement(true);
    try {
      if (!challengeTitle || !challengeStartDate || !challengeEndDate) {
        alert("Challenge title, start date and end date are required");
        setSavingAnnouncement(false);
        return;
      }
      const start = new Date(challengeStartDate).getTime();
      const end = new Date(challengeEndDate).getTime();
      if (end <= start) {
        alert("End date must be after start date");
        setSavingAnnouncement(false);
        return;
      }
      const durationDays = challengeDuration
        ? parseInt(challengeDuration)
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const newId =
        editingChallengeId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_CHALLENGE_${Date.now()}`
          : `challenge_${Date.now()}`);
      const cleanTasks = challengeTasks
        .map((t) => ({ ...t, text: t.text.trim() }))
        .filter((t) => t.text.length > 0);
      const payload: any = {
        title: challengeTitle,
        categoryId: adminCategoryScope || null,
        description: challengeDescription || "",
        challengeType: challengeType,
        todoFrequency: challengeTodoFrequency,
        durationDays: durationDays,
        startDate: challengeStartDate,
        endDate: challengeEndDate,
        status: "active",
        tasks: cleanTasks,
        updatedAt: new Date().toISOString(),
      };
      if (!editingChallengeId) {
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(doc(db, "challenges", newId), payload, {
        merge: !!editingChallengeId,
      });
      alert(
        editingChallengeId
          ? "Challenge updated successfully"
          : "Challenge saved successfully",
      );
      setEditingChallengeId(null);
      setChallengeTitle("");
      setChallengeDescription("");
      setChallengeType("streak");
      setChallengeStartDate("");
      setChallengeEndDate("");
      setChallengeDuration("");
      setChallengeTasks([]);
      setChallengeTodoFrequency("daily");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving challenge", error);
      alert("Failed to save challenge");
    }
    setSavingAnnouncement(false);
  };

  const handleEditChallenge = (c: any) => {
    setEditingChallengeId(c.id);
    setChallengeTitle(c.title || "");
    setChallengeDescription(c.description || "");
    setChallengeType(c.challengeType || "streak");
    setChallengeStartDate(c.startDate?.split("T")[0] || "");
    setChallengeEndDate(c.endDate?.split("T")[0] || "");
    setChallengeDuration(c.durationDays ? c.durationDays.toString() : "");
    setChallengeTasks(c.tasks || []);
    setChallengeTodoFrequency(c.todoFrequency || "daily");
    if (c.categoryId) setAdminCategoryScope(c.categoryId);
  };

  const approveChallenge = async (challengeId: string) => {
    try {
      await setDoc(
        doc(db, "challenges", challengeId),
        { approvalStatus: "approved" },
        { merge: true },
      );
      fetchAnnouncement();
    } catch (error) {
      console.error(error);
      alert("Failed to approve challenge");
    }
  };

  const rejectChallenge = async (challengeId: string) => {
    try {
      await setDoc(
        doc(db, "challenges", challengeId),
        { approvalStatus: "rejected" },
        { merge: true },
      );
      fetchAnnouncement();
    } catch (error) {
      console.error(error);
      alert("Failed to reject challenge");
    }
  };

  const deleteChallenge = async (id: string) => {
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "challenges", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete challenge");
    }
  };

  const saveCountdown = async () => {
    setSavingAnnouncement(true);
    try {
      if (!countdownTitle || !countdownDate) {
        alert("Countdown title and date are required");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingCountdownId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_COUNTDOWN_${Date.now()}`
          : `countdown_${Date.now()}`);
      const payload: any = {
        type: "countdown",
        title: countdownTitle,
        categoryId: adminCategoryScope || null,
        date: countdownDate,
        note: countdownNote || "",
        color: countdownColor,
        updatedAt: new Date().toISOString(),
      };
      if (!editingCountdownId) {
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(doc(db, "system", newId), payload, {
        merge: !!editingCountdownId,
      });
      alert(
        editingCountdownId
          ? "Countdown updated successfully"
          : "Countdown saved successfully",
      );
      setEditingCountdownId(null);
      setCountdownTitle("");
      setCountdownDate("");
      setCountdownNote("");
      setCountdownColor("green");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving countdown", error);
      alert("Failed to save countdown");
    }
    setSavingAnnouncement(false);
  };

  const handleEditCountdown = (c: any) => {
    setEditingCountdownId(c.id);
    setCountdownTitle(c.title || "");
    setCountdownDate(c.date || "");
    setCountdownNote(c.note || "");
    setCountdownColor(c.color || "green");
  };

  const deleteCountdown = async (id: string) => {
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete countdown");
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete notice");
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await setDoc(doc(db, "users", userId), { role }, { merge: true });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePermission = async (
    user: UserProfile,
    permission: string,
  ) => {
    try {
      const perms = user.permissions || {};
      const newPerms = {
        ...perms,
        [permission]: !perms[permission as keyof typeof perms],
      };
      await setDoc(
        doc(db, "users", user.userId),
        { permissions: newPerms },
        { merge: true },
      );
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateUserStatus = async (
    userId: string,
    updates: Partial<UserProfile>,
  ) => {
    try {
      await setDoc(doc(db, "users", userId), updates, { merge: true });
      fetchUsers();
    } catch (e) {
      console.error("Failed to update user", e);
    }
  };

  const [recalculatingUserIds, setRecalculatingUserIds] = useState<Set<string>>(new Set());

  const handleRecalculateStats = async (userId: string) => {
    try {
      setRecalculatingUserIds(prev => new Set(prev).add(userId));
      const q = query(collection(db, "users", userId, "mocks"));
      const snap = await getDocs(q);
      const mocks: any[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.isDeleted) {
          mocks.push({ ...data, id: doc.id });
        }
      });
      mocks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const calculatedStats = calculateStats(mocks);
      const stats30D = calculateStats(mocks, 30);
      const stats7D = calculateStats(mocks, 7);
      
      const categoryStats: Record<string, any> = {};
      const uniqueCats = new Set(mocks.map(m => m.categoryId || 'banking'));
      uniqueCats.forEach(cat => {
        const catMocks = mocks.filter(m => (m.categoryId || 'banking') === cat);
        categoryStats[cat] = {
           allTime: calculateStats(catMocks),
           stats30D: calculateStats(catMocks, 30),
           stats7D: calculateStats(catMocks, 7)
        };
      });

      const payload = {
        userId,
        ...calculatedStats,
        stats30D,
        stats7D,
        categoryStats,
        updatedAt: serverTimestamp()
      };

      try {
        await updateDoc(doc(db, "users", userId), payload);
      } catch (e: any) {
        if (e.code === 'not-found') {
          await setDoc(doc(db, "users", userId), payload);
        } else {
          throw e;
        }
      }

      alert("User stats recalculated successfully.");
      fetchUsers();
    } catch (error) {
      console.error("Error recalculating stats", error);
      alert("Failed to recalculate stats.");
    } finally {
      setRecalculatingUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessingImage(true);

    try {
      const imagesPayload: { base64: string; mimeType: string }[] = [];
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result?.toString().split(",")[1];
            if (result) resolve(result);
            else reject(new Error("Failed to read file"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imagesPayload.push({ base64: base64Data, mimeType: file.type });
      }

      if (imagesPayload.length > 0) {
        const extractedData = await parseMockAnnouncementImage(imagesPayload);

        if (extractedData.examType && !EXAMS.includes(extractedData.examType))
          setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole))
          setIsCustomRole(true);
        if (
          extractedData.examPhase &&
          !PHASES.includes(extractedData.examPhase)
        )
          setIsCustomPhase(true);
        if (
          extractedData.platform &&
          !PLATFORMS.includes(extractedData.platform)
        )
          setIsCustomPlatform(true);

        setLiveMockData((prev: any) => ({
          ...prev,
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope,
        }));
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsProcessingImage(false);
      e.target.value = "";
    }
  };

  const renderLiveMockContent = () => (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 whitespace-nowrap">
          <Radio className="w-5 h-5" /> Host a Live Mock
        </h3>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="adminFileUpload"
              onChange={handleFileChange}
            />
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
                    setLiveMockData((p) => ({ ...p, examType: "" }));
                  } else {
                    setLiveMockData((p) => ({ ...p, examType: val }));
                  }
                }}
              />
            ) : (
              <div className="relative">
                <input
                  type="search"
                  value={liveMockData.examType}
                  onChange={(e) =>
                    setLiveMockData((p) => ({ ...p, examType: e.target.value }))
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
                    setLiveMockData((p) => ({ ...p, examRole: "" }));
                  } else {
                    setLiveMockData((p) => ({ ...p, examRole: val }));
                  }
                }}
              />
            ) : (
              <div className="relative">
                <input
                  type="search"
                  value={liveMockData.examRole}
                  onChange={(e) =>
                    setLiveMockData((p) => ({ ...p, examRole: e.target.value }))
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
                    setLiveMockData((p) => ({ ...p, examPhase: "" }));
                  } else {
                    setLiveMockData((p) => ({ ...p, examPhase: val }));
                  }
                }}
              />
            ) : (
              <div className="relative">
                <input
                  type="search"
                  value={liveMockData.examPhase}
                  onChange={(e) =>
                    setLiveMockData((p) => ({
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
                setLiveMockData((p) => ({ ...p, examScope: val }))
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
          <input
            type="search"
            value={liveMockData.mockName}
            onChange={(e) =>
              setLiveMockData((p) => ({ ...p, mockName: e.target.value }))
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
                  setLiveMockData((p) => ({ ...p, platform: "" }));
                } else {
                  setLiveMockData((p) => ({ ...p, platform: val }));
                }
              }}
            />
          ) : (
            <div className="relative">
              <input
                type="search"
                value={liveMockData.platform}
                onChange={(e) =>
                  setLiveMockData((p) => ({ ...p, platform: e.target.value }))
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
          <input
            type="datetime-local"
            value={liveMockData.date}
            onChange={(e) =>
              setLiveMockData((p) => ({ ...p, date: e.target.value }))
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
        ? liveMocks.filter((m) => m.categoryId === adminCategoryScope)
        : liveMocks.filter((m) => !m.categoryId)
      ).length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
            {adminCategoryScope
              ? `Live Mocks for ${adminCategoryScope}`
              : "Active Live Mocks"}
          </h4>
          <ul className="space-y-3">
            {(adminCategoryScope
              ? liveMocks.filter((m) => m.categoryId === adminCategoryScope)
              : liveMocks.filter((m) => !m.categoryId)
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
                    onClick={() => handleEditLiveMock(m)}
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

  const renderNoticeContent = () => (
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
          <input
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
          <textarea
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
            <input
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
          <input
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
          <input
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
            disabled={savingAnnouncement}
            className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />{" "}
            {savingAnnouncement ? "Publishing..." : editingNoticeId ? "Update Notice" : "Publish Notice"}
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
        ? notices.filter((n) => n.categoryId === adminCategoryScope)
        : notices.filter((n) => !n.categoryId)
      ).length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
            {adminCategoryScope
              ? `Notices for ${adminCategoryScope}`
              : "Active Notices"}
          </h4>
          <ul className="space-y-3">
            {(adminCategoryScope
              ? notices.filter((n) => n.categoryId === adminCategoryScope)
              : notices.filter((n) => !n.categoryId)
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

  const renderCountdownContent = () => (
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
            disabled={savingAnnouncement}
            className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />{" "}
            {savingAnnouncement
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

  const renderChallengeContent = () => (
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
          <input
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
          <textarea
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
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Date
            </label>
            <input
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
              Duration
            </label>
            <input
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
            <input
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
        {/* Challenge Tasks configuration for all types */}
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
                    challengeTodoFrequency === "oneTime"
                      ? "Check each task only once."
                      : "Tasks renew daily."
                  }
                >
                  {challengeTodoFrequency === "oneTime" ? "Once" : "Daily"}
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {challengeTasks.map((t, idx) => (
                <div key={t.id} className="flex items-center gap-2">
                  <input
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
                    <Trash2 className="w-4 h-4" />
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
            disabled={savingAnnouncement}
            className="flex-1 justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />{" "}
            {savingAnnouncement ? "Saving..." : editingChallengeId ? "Update Challenge" : "Save Challenge"}
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
      </div>

      {(adminCategoryScope
        ? challenges.filter((c) => c.categoryId === adminCategoryScope)
        : challenges.filter((c) => !c.categoryId)
      ).length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
            {adminCategoryScope
              ? `Challenges for ${adminCategoryScope}`
              : "Active Challenges"}
          </h4>
          <ul className="space-y-3">
            {(adminCategoryScope
              ? challenges.filter((c) => c.categoryId === adminCategoryScope)
              : challenges.filter((c) => !c.categoryId)
            ).map((c) => (
              <li
                key={c.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {c.title}
                    {c.approvalStatus === "pending" && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        Pending
                      </span>
                    )}
                    {c.approvalStatus === "rejected" && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        Rejected
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {c.durationDays} Days • {c.challengeType}
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
  );

  const content = (
    <div className={`flex flex-col w-full flex-1 min-h-0 ${asPage ? "" : ""}`}>
      <div
        className={`bg-white dark:bg-slate-900 ${asPage ? "flex-1 min-h-0 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 w-full" : "mx-auto rounded-2xl w-full max-w-4xl shadow-2xl h-[85vh] border border-slate-200 dark:border-slate-800"} overflow-hidden flex flex-col`}
      >
        {/* Top Header Tabs if Owner */}
        {asPage && isOwner && (
          <div className="flex gap-2 px-4 pt-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => {
                setActiveTab("users");
                setAdminCategoryScope(
                  isForcedCategory ? currentCategory || null : null,
                );
              }}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-t-xl transition-colors duration-200 z-10 border-t border-x ${
                activeTab !== "categories" && !adminCategoryScope
                  ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-b-white dark:border-b-slate-900 -mb-[1px]"
                  : "text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Owner Panel</span>
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-t-xl transition-colors duration-200 z-10 border-t border-x ${
                activeTab === "categories" || adminCategoryScope
                  ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-b-white dark:border-b-slate-900 -mb-[1px]"
                  : "text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Exam Categories</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-col md:flex-row overflow-hidden flex-1 relative">
          {/* Sidebar Nav */}
          {activeTab !== "categories" && (
            <div
              className={`w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0 ${asPage ? "" : ""}`}
            >
            <div className="hidden md:flex p-6 border-b border-slate-100 dark:border-slate-800 items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isOwner ? "Owner" : "Admin panel"}
              </h2>
            </div>
            <div className="p-3 flex flex-row overflow-x-auto overflow-y-hidden md:overflow-y-auto custom-scrollbar md:flex-col gap-2 md:gap-0 md:space-y-1 md:flex-1">
              {adminCategoryScope && isOwner && !isForcedCategory && (
                <div className="flex-shrink-0 md:mb-6 md:space-y-1 flex items-center">
                  <button
                    onClick={() => {
                      setActiveTab("categories");
                    }}
                    className="whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to{" "}
                    {adminCategoryScope}
                  </button>
                </div>
              )}
              <div
                className={`flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-1 md:mb-6 ${adminCategoryScope && isOwner ? "opacity-50 pointer-events-none" : ""}`}
              >
                {isOwner && (
                  <h3 className="hidden md:block px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Owner Panel
                  </h3>
                )}

                {isOwner && (
                  <button
                    onClick={() => {
                      setActiveTab("admins");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "admins" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Shield className="w-4 h-4" /> Admins
                  </button>
                )}

                {(isOwner || adminPermissions?.canManageUsers) && (
                  <button
                    onClick={() => {
                      setActiveTab("users");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "users" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Users className="w-4 h-4" /> Users
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageLiveMocks && (
                  <button
                    onClick={() => {
                      setActiveTab("liveMock");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "liveMock" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Radio className="w-4 h-4" /> Live Mock
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageNotices && (
                  <button
                    onClick={() => {
                      setActiveTab("notice");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "notice" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <FileText className="w-4 h-4" /> Notice
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageCountdowns && (
                  <button
                    onClick={() => {
                      setActiveTab("countdown");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "countdown" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Timer className="w-4 h-4" /> Countdowns
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageChallenges && (
                  <button
                    onClick={() => {
                      setActiveTab("challenge");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "challenge" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Timer className="w-4 h-4" /> Challenges
                  </button>
                )}
                {(isOwner || adminPermissions?.canManageSettings) && (
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "settings" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                )}
                {(isOwner || adminPermissions?.canManageQuotes) && (
                  <button
                    onClick={() => {
                      setActiveTab("quotes");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "quotes" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <FileText className="w-4 h-4" /> Quotes
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-slate-900">
          {!asPage && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors z-[100] shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {(!activeTab || (activeTab as any) === "") && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 p-6">
              <Shield className="w-12 h-12 mb-4 opacity-50" />
              <p>You don't have any admin permissions yet.</p>
              <p className="text-sm mt-1">
                Please ask the owner to assign you permissions.
              </p>
            </div>
          )}

          {activeTab === "admins" && isOwner && (
            <div className="flex flex-col h-full w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  Admin Management
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search admins..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-[160px]"
                    />
                  </div>
                  {categories.length > 0 && (
                    <CustomDropdown
                      value={
                        adminManagementCategoryFilter === "all"
                          ? "All Categories"
                          : categories.find(
                              (c) => c.id === adminManagementCategoryFilter,
                            )?.name || "All Categories"
                      }
                      options={[
                        "All Categories",
                        ...categories.map((c) => c.name),
                      ]}
                      onChange={(val) => {
                        if (val === "All Categories") {
                          setAdminManagementCategoryFilter("all");
                        } else {
                          const catId = categories.find(
                            (c) => c.name === val,
                          )?.id;
                          setAdminManagementCategoryFilter(catId || "all");
                        }
                      }}
                      placeholder="All Categories"
                      buttonClassName="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-medium flex items-center justify-between min-w-[140px]"
                      optionClassName="px-2.5 py-1.5 text-xs"
                      menuDirection="bottom"
                    />
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="max-w-4xl w-full mx-auto">
                  {loading ? (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                      Loading users...
                    </div>
                  ) : (
                <div className="space-y-4">
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                    {[...allFirebaseUsers]
                      .filter((u) => u.role === "admin")
                      .filter(
                        (u) =>
                          adminManagementCategoryFilter === "all" ||
                          (u as any).adminCategories?.includes(
                            adminManagementCategoryFilter,
                          ),
                      )
                      .filter(
                        (u) =>
                          adminSearch.trim() === "" ||
                          u.email
                            ?.toLowerCase()
                            .includes(adminSearch.toLowerCase()) ||
                          (u as any).displayName
                            ?.toLowerCase()
                            .includes(adminSearch.toLowerCase()),
                      )
                      .sort((a, b) => {
                        const search = adminSearch.toLowerCase().trim();
                        const nameA = (
                          (a as any).displayName ||
                          a.email ||
                          ""
                        ).toLowerCase();
                        const nameB = (
                          (b as any).displayName ||
                          b.email ||
                          ""
                        ).toLowerCase();
                        if (search) {
                          const aStarts = nameA.startsWith(search) ? 1 : 0;
                          const bStarts = nameB.startsWith(search) ? 1 : 0;
                          if (aStarts !== bStarts) return bStarts - aStarts;
                          return nameA.localeCompare(nameB);
                        }

                        const getMs = (val: any) => {
                          if (!val) return 0;
                          if (typeof val === "number") return val;
                          if (val.toMillis) return val.toMillis();
                          if (val.seconds) return val.seconds * 1000;
                          return new Date(val).getTime() || 0;
                        };

                        const aJoined = getMs((a as any).createdAt);
                        const bJoined = getMs((b as any).createdAt);
                        if (aJoined !== bJoined) return bJoined - aJoined;

                        const aActive = getMs(a.lastActiveAt);
                        const bActive = getMs(b.lastActiveAt);
                        return bActive - aActive;
                      })
                      .slice(0, 100).map((user) => (
                        <li
                          key={user.userId}
                          ref={
                            expandedAdminId === user.userId
                              ? adminListRef
                              : null
                          }
                          className={`p-3 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg ${user.role === "admin" ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""}`}
                          onClick={(e) => {
                            if (
                              user.role === "admin" &&
                              expandedAdminId !== user.userId
                            ) {
                              setExpandedAdminId(user.userId);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  user.photoURL ||
                                  `https://ui-avatars.com/api/?name=${user.displayName}`
                                }
                                className="w-8 h-8 rounded-full object-cover"
                                alt=""
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {user.displayName}
                                </p>
                                {isOwner && (
                                  <>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {user.email || user.userId}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Last active:{" "}
                                      {user.lastActiveAt
                                        ? new Date(
                                            user.lastActiveAt,
                                          ).toLocaleString()
                                        : "N/A"}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isOwner && user.email !== "mrityunjoyk29@gmail.com" && (
                                <CustomDropdown
                                  value={
                                    user.role === "admin" ? "Admin" : "User"
                                  }
                                  options={["User", "Admin"]}
                                  onChange={(val) =>
                                    handleUpdateUserRole(
                                      user.userId,
                                      val.toLowerCase(),
                                    )
                                  }
                                  placeholder="Role"
                                  buttonClassName="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold h-[26px] flex items-center justify-between"
                                  optionClassName="px-2 py-1 text-[11px]"
                                  className="w-[85px]"
                                />
                              )}
                              {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRecalculateStats(user.userId);
                                }}
                                disabled={recalculatingUserIds.has(user.userId)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                                  recalculatingUserIds.has(user.userId)
                                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-400"
                                }`}
                              >
                                {recalculatingUserIds.has(user.userId) ? "Updating..." : "Update"}
                              </button>
                              )}
                              {user.email !== "mrityunjoyk29@gmail.com" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateUserStatus(user.userId, {
                                    isMuted: true,
                                    mutedAt: new Date().getTime(),
                                  });
                                }}
                                className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/50 dark:hover:text-amber-400 rounded-md transition-colors flex items-center gap-1"
                              >
                                Mute
                              </button>
                              )}
                              {isOwner && user.email !== "mrityunjoyk29@gmail.com" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateUserStatus(user.userId, {
                                      isBanned: true,
                                    });
                                  }}
                                  className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-md transition-colors flex items-center gap-1"
                                >
                                  Ban
                                </button>
                              )}
                            </div>
                          </div>
                          {isOwner &&
                            user.role === "admin" &&
                            expandedAdminId === user.userId && (
                              <div
                                className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full animate-in slide-in-from-top-2 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                                  Admin Permissions
                                </p>
                                <div className="flex flex-wrap gap-1.5 w-full">
                                  {[
                                    "canManageUsers",
                                    "canManageNotices",
                                    "canManageChallenges",
                                    "canManageLiveMocks",
                                    "canManageCountdowns",
                                    "canManageSettings",
                                    "canManageQuotes",
                                  ].map((perm) => (
                                    <label
                                      key={perm}
                                      className={`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none ${!!(user.permissions as any)?.[perm] ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          !!(user.permissions as any)?.[perm]
                                        }
                                        onChange={() =>
                                          handleTogglePermission(user, perm)
                                        }
                                        className="sr-only"
                                      />
                                      {perm.replace("canManage", "")}
                                    </label>
                                  ))}
                                </div>
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 mt-4">
                                  Category Permissions
                                </p>
                                <div className="flex flex-wrap gap-1.5 w-full">
                                  {categories.map((cat) => {
                                    const isSelected = (
                                      user as any
                                    ).adminCategories?.includes(cat.id);
                                    return (
                                      <label
                                        key={cat.id}
                                        className={`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none ${isSelected ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          checked={!!isSelected}
                                          onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const currentCats =
                                              (user as any).adminCategories ||
                                              [];
                                            const newCats = checked
                                              ? [...currentCats, cat.id]
                                              : currentCats.filter(
                                                  (id) => id !== cat.id,
                                                );
                                            const { doc, setDoc } =
                                              await import("firebase/firestore");
                                            const { db } =
                                              await import("../services/firebase");
                                            await setDoc(
                                              doc(db, "users", user.userId),
                                              { adminCategories: newCats },
                                              { merge: true },
                                            );
                                            setAllFirebaseUsers((prev) =>
                                              prev.map((u) =>
                                                u.userId === user.userId
                                                  ? {
                                                      ...u,
                                                      adminCategories: newCats,
                                                    }
                                                  : u,
                                              ),
                                            );
                                          }}
                                        />
                                        {cat.name}
                                      </label>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                  If no categories are selected, to them admin
                                  panel is not visible in any category.
                                </p>
                              </div>
                            )}
                        </li>
                      ))}
                  </ul>
                  {allFirebaseUsers
                    .filter((u) => u.role === "admin")
                    .filter(
                      (u) =>
                        adminManagementCategoryFilter === "all" ||
                        (u as any).adminCategories?.includes(
                          adminManagementCategoryFilter,
                        ),
                    )
                    .filter(
                      (u) =>
                        adminSearch.trim() === "" ||
                        u.email
                          ?.toLowerCase()
                          .includes(adminSearch.toLowerCase()) ||
                        (u as any).displayName
                          ?.toLowerCase()
                          .includes(adminSearch.toLowerCase()),
                    ).length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      No admins found. Add admins from the User Management tab
                      first.
                    </p>
                  )}
                </div>
              )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" &&
            (isOwner || adminPermissions?.canManageUsers) && (
              <div className="flex flex-col h-full w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    User Management
                  </h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-[200px]"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="max-w-4xl w-full mx-auto space-y-6">
                    {loading ? (
                      <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                        Loading users...
                      </div>
                    ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <button
                          onClick={() => setUserFilter("active")}
                          className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${userFilter === "active" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                        >
                          <Users className="w-4 h-4" /> Active Users (
                          {allAppUsers.length})
                        </button>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => setUserFilter("all")}
                              className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${userFilter === "all" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                            >
                              <Users className="w-4 h-4" /> All Users (
                              {allFirebaseUsers.length})
                            </button>
                          </>
                        )}
                      </div>
                      {(userFilter === "all" ? allFirebaseUsers : allAppUsers)
                        .filter(
                          (u) =>
                            isOwner || u.email !== "mrityunjoyk29@gmail.com",
                        )
                        .filter(
                          (u) =>
                            userSearch.trim() === "" ||
                            u.email
                              ?.toLowerCase()
                              .includes(userSearch.toLowerCase()) ||
                            (u as any).displayName
                              ?.toLowerCase()
                              .includes(userSearch.toLowerCase()),
                        ).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                          No users found.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                          {[
                            ...(userFilter === "all"
                              ? allFirebaseUsers
                              : allAppUsers),
                          ]
                            .filter(
                              (u) =>
                                isOwner ||
                                u.email !== "mrityunjoyk29@gmail.com",
                            )
                            .filter(
                              (u) =>
                                userSearch.trim() === "" ||
                                u.email
                                  ?.toLowerCase()
                                  .includes(userSearch.toLowerCase()) ||
                                (u as any).displayName
                                  ?.toLowerCase()
                                  .includes(userSearch.toLowerCase()),
                            )
                            .sort((a, b) => {
                              const search = userSearch.toLowerCase().trim();
                              const nameA = (
                                (a as any).displayName ||
                                a.email ||
                                ""
                              ).toLowerCase();
                              const nameB = (
                                (b as any).displayName ||
                                b.email ||
                                ""
                              ).toLowerCase();
                              if (search) {
                                const aStarts = nameA.startsWith(search)
                                  ? 1
                                  : 0;
                                const bStarts = nameB.startsWith(search)
                                  ? 1
                                  : 0;
                                if (aStarts !== bStarts)
                                  return bStarts - aStarts;
                                return nameA.localeCompare(nameB);
                              }

                              const getMs = (val: any) => {
                                if (!val) return 0;
                                if (typeof val === "number") return val;
                                if (val.toMillis) return val.toMillis();
                                if (val.seconds) return val.seconds * 1000;
                                return new Date(val).getTime() || 0;
                              };

                              const aJoined = getMs((a as any).createdAt);
                              const bJoined = getMs((b as any).createdAt);
                              if (aJoined !== bJoined) return bJoined - aJoined;

                              const aActive = getMs(a.lastActiveAt);
                              const bActive = getMs(b.lastActiveAt);
                              return bActive - aActive;
                            })
                            .slice(0, 100).map((user) => (
                              <li
                                key={user.userId}
                                ref={
                                  expandedAdminId === user.userId
                                    ? adminListRef
                                    : null
                                }
                                className={`p-3 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg ${user.role === "admin" ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""}`}
                                onClick={(e) => {
                                  if (
                                    user.role === "admin" &&
                                    expandedAdminId !== user.userId
                                  ) {
                                    setExpandedAdminId(user.userId);
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={
                                        user.photoURL ||
                                        `https://ui-avatars.com/api/?name=${user.displayName}`
                                      }
                                      className="w-8 h-8 rounded-full object-cover"
                                      alt=""
                                      referrerPolicy="no-referrer"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {user.displayName}
                                      </p>
                                      {isOwner && (
                                        <>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {user.email || user.userId}
                                          </p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            Last active:{" "}
                                            {user.lastActiveAt
                                              ? new Date(
                                                  user.lastActiveAt,
                                                ).toLocaleString()
                                              : "N/A"}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {isOwner && user.email !== "mrityunjoyk29@gmail.com" && (
                                      <CustomDropdown
                                        value={
                                          user.role === "admin"
                                            ? "Admin"
                                            : "User"
                                        }
                                        options={["User", "Admin"]}
                                        onChange={(val) =>
                                          handleUpdateUserRole(
                                            user.userId,
                                            val.toLowerCase(),
                                          )
                                        }
                                        placeholder="Role"
                                        buttonClassName="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold h-[26px] flex items-center justify-between"
                                        optionClassName="px-2 py-1 text-[11px]"
                                        className="w-[85px]"
                                      />
                                    )}
                                    {isOwner && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRecalculateStats(user.userId);
                                      }}
                                      disabled={recalculatingUserIds.has(user.userId)}
                                      className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                                        recalculatingUserIds.has(user.userId)
                                          ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-400"
                                      }`}
                                    >
                                      {recalculatingUserIds.has(user.userId) ? "Updating..." : "Update"}
                                    </button>
                                    )}
                                    {user.email !== "mrityunjoyk29@gmail.com" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateUserStatus(user.userId, {
                                          isMuted: true,
                                          mutedAt: new Date().getTime(),
                                        });
                                      }}
                                      className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/50 dark:hover:text-amber-400 rounded-md transition-colors flex items-center gap-1"
                                    >
                                      Mute
                                    </button>
                                    )}
                                    {isOwner && user.email !== "mrityunjoyk29@gmail.com" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateUserStatus(user.userId, {
                                            isBanned: true,
                                          });
                                        }}
                                        className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-md transition-colors flex items-center gap-1"
                                      >
                                        Ban
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {isOwner &&
                                  user.role === "admin" &&
                                  expandedAdminId === user.userId && (
                                    <div
                                      className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full animate-in slide-in-from-top-2 duration-200"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                                        Admin Permissions
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 w-full">
                                        {[
                                          "canManageUsers",
                                          "canManageNotices",
                                          "canManageChallenges",
                                          "canManageLiveMocks",
                                          "canManageCountdowns",
                                          "canManageSettings",
                                          "canManageQuotes",
                                        ].map((perm) => (
                                          <label
                                            key={perm}
                                            className={`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none ${!!(user.permissions as any)?.[perm] ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={
                                                !!(user.permissions as any)?.[
                                                  perm
                                                ]
                                              }
                                              onChange={() =>
                                                handleTogglePermission(
                                                  user,
                                                  perm,
                                                )
                                              }
                                              className="sr-only"
                                            />
                                            {perm.replace("canManage", "")}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                    {isOwner && (
                      <div>
                        <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-1.5">
                          <UserX className="w-4 h-4" /> Banned Users (
                          {bannedUsers.length})
                        </h4>
                        {bannedUsers.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                            No banned users.
                          </p>
                        ) : (
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                            {bannedUsers.slice(0, 100).map((user) => (
                              <li
                                key={user.userId}
                                className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={
                                      user.photoURL ||
                                      `https://ui-avatars.com/api/?name=${user.displayName}`
                                    }
                                    className="w-8 h-8 rounded-full object-cover"
                                    alt=""
                                    referrerPolicy="no-referrer"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                      {user.displayName}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {user.email || user.userId}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Last active:{" "}
                                      {user.lastActiveAt
                                        ? new Date(
                                            user.lastActiveAt,
                                          ).toLocaleString()
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    handleUpdateUserStatus(user.userId, {
                                      isBanned: false,
                                    })
                                  }
                                  className="text-xs font-medium px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors flex items-center gap-1"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Unban
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <MessageSquareOff className="w-4 h-4" /> Muted Users (
                          {
                            mutedUsers.filter(
                              (u) =>
                                isOwner ||
                                (u.email !== "mrityunjoyk29@gmail.com" &&
                                  u.mutedAt &&
                                  (new Date().getTime() - u.mutedAt) /
                                    (1000 * 60 * 60 * 24) <=
                                    (Number(muteDurationDays) || 1)),
                            ).length
                          }
                          )
                        </h4>
                        {isOwner && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Duration (Days):
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={muteDurationDays}
                              onChange={(e) =>
                                setMuteDurationDays(
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value),
                                )
                              }
                              onBlur={saveSettings}
                              className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-700/50 rounded-md text-xs bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
                            />
                          </div>
                        )}
                      </div>
                      {mutedUsers.filter(
                        (u) =>
                          isOwner ||
                          (u.email !== "mrityunjoyk29@gmail.com" &&
                            u.mutedAt &&
                            (new Date().getTime() - u.mutedAt) /
                              (1000 * 60 * 60 * 24) <=
                              (Number(muteDurationDays) || 1)),
                      ).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                          No muted users.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                          {mutedUsers
                            .filter(
                              (u) =>
                                isOwner ||
                                (u.email !== "mrityunjoyk29@gmail.com" &&
                                  u.mutedAt &&
                                  (new Date().getTime() - u.mutedAt) /
                                    (1000 * 60 * 60 * 24) <=
                                    (Number(muteDurationDays) || 1)),
                            )
                            .slice(0, 100).map((user) => (
                              <li
                                key={user.userId}
                                className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={
                                      user.photoURL ||
                                      `https://ui-avatars.com/api/?name=${user.displayName}`
                                    }
                                    className="w-8 h-8 rounded-full object-cover"
                                    alt=""
                                    referrerPolicy="no-referrer"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                      {user.displayName}
                                    </p>
                                    {isOwner && (
                                      <>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {user.email || user.userId}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          Last active:{" "}
                                          {user.lastActiveAt
                                            ? new Date(
                                                user.lastActiveAt,
                                              ).toLocaleString()
                                            : "N/A"}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    handleUpdateUserStatus(user.userId, {
                                      isMuted: false,
                                    })
                                  }
                                  className="text-xs font-medium px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-md transition-colors flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />{" "}
                                  Unmute
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {activeTab === "liveMock" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageLiveMocks) &&
            renderLiveMockContent()}

          {activeTab === "countdown" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageCountdowns) &&
            renderCountdownContent()}

          {activeTab === "notice" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageNotices) &&
            renderNoticeContent()}

          {activeTab === "challenge" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageChallenges) &&
            renderChallengeContent()}

          {activeTab === "categories" && (
            <AdminCategoriesTab
              onManageSection={(sec, catId) => {
                setAdminCategoryScope(catId);
                setActiveTab(sec as any);
              }}
              onCategorySelect={(catId) => {
                setAdminCategoryScope(catId);
              }}
              renderLiveMock={() =>
                isOwner || adminPermissions?.canManageLiveMocks ? (
                  renderLiveMockContent()
                ) : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderNotice={() =>
                isOwner || adminPermissions?.canManageNotices ? (
                  renderNoticeContent()
                ) : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderCountdown={() =>
                isOwner || adminPermissions?.canManageCountdowns ? (
                  renderCountdownContent()
                ) : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderChallenge={() =>
                isOwner || adminPermissions?.canManageChallenges ? (
                  renderChallengeContent()
                ) : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
            />
          )}

          {activeTab === "quotes" &&
            (isOwner || adminPermissions?.canManageQuotes) && (
              <AdminQuotesTab />
          )}

          {activeTab === "settings" &&
            (isOwner || adminPermissions?.canManageSettings) && (
              <div className="flex flex-col h-full w-full">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
                    System Settings
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="max-w-4xl w-full mx-auto space-y-4">
                    <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Telegram Support Link
                    </label>
                    <input
                      type="url"
                      value={telegramLink}
                      onChange={(e) => setTelegramLink(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                      placeholder="https://t.me/yourgroup"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      This will be shown on the login screen and header for
                      support.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Telegram Button Text
                    </label>
                    <input
                      type="text"
                      value={telegramText}
                      onChange={(e) => setTelegramText(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                      placeholder="Contact us"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      The text to display on the Telegram button.
                    </p>
                  </div>

                  <button
                    onClick={() => saveSettings(false)}
                    disabled={savingAnnouncement}
                    className="mt-4 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />{" "}
                    {savingAnnouncement ? "Saving..." : "Save Settings"}
                  </button>

                  {isOwner && (
                    <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-700/50">
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Owner Tools</h4>
                      <AdminMigrationTool />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

  if (asPage) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0 } }} 
            className="absolute inset-0 bg-slate-900/40  pointer-events-auto" 
            onClick={onClose} 
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }}
            className="relative z-10 w-full flex items-center justify-center pointer-events-auto"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
