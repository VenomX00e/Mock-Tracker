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
import { AdminUsersTab } from "./admin/AdminUsersTab";
import { AdminLiveMocksTab } from "./admin/AdminLiveMocksTab";
import { AdminNoticesTab } from "./admin/AdminNoticesTab";
import { AdminCountdownsTab } from "./admin/AdminCountdownsTab";
import { AdminChallengesTab } from "./admin/AdminChallengesTab";
import { AdminPracticeSetsTab } from "./admin/AdminPracticeSetsTab";
import { AdminSettingsTab } from "./admin/AdminSettingsTab";
import { AdminFeaturesTab } from "./admin/AdminFeaturesTab";
import { AdminApiKeysTab } from "./admin/AdminApiKeysTab";
import { AdminWebhooksTab } from "./admin/AdminWebhooksTab";
import { AdminSearchLogsTab } from "./admin/AdminSearchLogsTab";
import { AdminAdminsTab } from "./admin/AdminAdminsTab";
import { AdminLearningTab } from "./admin/AdminLearningTab";
import { AdminSidebarNav } from "./admin/AdminSidebarNav";
import { AdminMigrationTool } from "./AdminMigrationTool";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminSystem } from "../hooks/useAdminSystem";
import { useAdminLiveMocks } from "../hooks/useAdminLiveMocks";
import { useAdminNotices } from "../hooks/useAdminNotices";
import { useAdminCountdowns } from "../hooks/useAdminCountdowns";
import { useAdminChallenges } from "../hooks/useAdminChallenges";

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
    | "learning"
    | "keys"
    | "admins"
    | "webhooks"
    | "search-logs";
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
    | "features"
    | "categories"
    | "admins"
    | "learning"
    | "quotes"
    | "keys"
    | "webhooks"
    | "search-logs"
  >(initialTab as any);
  const [adminCategoryScope, setAdminCategoryScope] = useState<string | null>(
    !isOwner && currentCategory ? currentCategory : null,
  );
  const isForcedCategory = !isOwner && currentCategory !== null;

  const { bannedUsers, mutedUsers, allAppUsers, allFirebaseUsers, loading, fetchUsers, recalculatingUserIds, handleUpdateUserRole, handleTogglePermission, handleUpdateUserStatus, handleRecalculateStats } = useAdminUsers(currentUser);
  const { liveMocks, notices, countdowns, challenges, telegramLink, setTelegramLink, telegramText, setTelegramText, enableAiTutor, setEnableAiTutor, enableVocabulary, setEnableVocabulary, enableSpeedMath, setEnableSpeedMath, enablePracticeLibrary, setEnablePracticeLibrary, apdfKeys, setApdfKeys, ilovePdfKeys, setIlovePdfKeys, cloudinaryCloudName, setCloudinaryCloudName, cloudinaryUploadPreset, setCloudinaryUploadPreset, muteDurationDays, setMuteDurationDays, fetchAnnouncement, savingSettings: savingAnnouncement, saveSettings } = useAdminSystem();
  
  const [adminManagementCategoryFilter, setAdminManagementCategoryFilter] = useState<string | "all">("all");
  const [adminSearch, setAdminSearch] = useState("");


  

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

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

  
  
  
  const getPrefix = (categoryId: string | null) => {
    if (!categoryId) return "";
    const currentCat = categories.find((c) => c.id === categoryId);
    const prefix = currentCat?.subjectPrefix || categoryId;
    return prefix.replace(/_$/, "").toUpperCase();
  };

  const {
    isCustomExam, setIsCustomExam,
    isCustomRole, setIsCustomRole,
    isCustomPhase, setIsCustomPhase,
    isCustomPlatform, setIsCustomPlatform,
    editingLiveMockId, setEditingLiveMockId,
    liveMockData, setLiveMockData,
    isProcessingImage,
    savingAnnouncement: savingLiveMock,
    saveLiveMock,
    handleEditLiveMock,
    deleteLiveMock,
    handleFileChange
  } = useAdminLiveMocks(adminCategoryScope, getPrefix, fetchAnnouncement);

  const {
    noticeTitle, setNoticeTitle,
    noticeDescription, setNoticeDescription,
    noticeLink, setNoticeLink,
    noticeDate, setNoticeDate,
    noticeUrgency, setNoticeUrgency,
    noticeTags, setNoticeTags,
    noticeEditableBy, setNoticeEditableBy,
    editingNoticeId, setEditingNoticeId,
    savingNotice, saveNotice,
    handleEditNotice, deleteNotice
  } = useAdminNotices(adminCategoryScope, getPrefix, fetchAnnouncement, editNoticeData, initialTab, isOpen, setAdminCategoryScope);

  const {
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
    handleEditChallenge, deleteChallenge
  } = useAdminChallenges(adminCategoryScope, getPrefix, fetchAnnouncement, setAdminCategoryScope);

  const {
    countdownTitle, setCountdownTitle,
    countdownDate, setCountdownDate,
    countdownNote, setCountdownNote,
    countdownColor, setCountdownColor,
    editingCountdownId, setEditingCountdownId,
    savingCountdown, saveCountdown,
    handleEditCountdown, deleteCountdown
  } = useAdminCountdowns(adminCategoryScope, getPrefix, fetchAnnouncement, editCountdownData, initialTab, isOpen, setAdminCategoryScope);

  
  
    const liveMocksTabNode = (
    <AdminLiveMocksTab 
      isCustomExam={isCustomExam}
      setIsCustomExam={setIsCustomExam}
      isCustomRole={isCustomRole}
      setIsCustomRole={setIsCustomRole}
      isCustomPhase={isCustomPhase}
      setIsCustomPhase={setIsCustomPhase}
      isCustomPlatform={isCustomPlatform}
      setIsCustomPlatform={setIsCustomPlatform}
      editingLiveMockId={editingLiveMockId}
      setEditingLiveMockId={setEditingLiveMockId}
      liveMockData={liveMockData}
      setLiveMockData={setLiveMockData}
      isProcessingImage={isProcessingImage}
      savingAnnouncement={savingAnnouncement}
      saveLiveMock={saveLiveMock}
      handleEditLiveMock={handleEditLiveMock}
      deleteLiveMock={deleteLiveMock}
      handleFileChange={handleFileChange}
      adminCategoryScope={adminCategoryScope}
      setAdminCategoryScope={setAdminCategoryScope}
      liveMocks={liveMocks}
      isOwner={!!isOwner}
    />
  );
  const countdownsTabNode = (
    <AdminCountdownsTab
      countdownTitle={countdownTitle}
      setCountdownTitle={setCountdownTitle}
      countdownDate={countdownDate}
      setCountdownDate={setCountdownDate}
      countdownNote={countdownNote}
      setCountdownNote={setCountdownNote}
      countdownColor={countdownColor}
      setCountdownColor={setCountdownColor}
      editingCountdownId={editingCountdownId}
      setEditingCountdownId={setEditingCountdownId}
      savingCountdown={savingCountdown}
      saveCountdown={saveCountdown}
      handleEditCountdown={handleEditCountdown}
      deleteCountdown={deleteCountdown}
      adminCategoryScope={adminCategoryScope}
      countdowns={countdowns}
      isOwner={!!isOwner}
    />
  );
  const noticesTabNode = (
    <AdminNoticesTab
      noticeTitle={noticeTitle}
      setNoticeTitle={setNoticeTitle}
      noticeDescription={noticeDescription}
      setNoticeDescription={setNoticeDescription}
      noticeLink={noticeLink}
      setNoticeLink={setNoticeLink}
      noticeDate={noticeDate}
      setNoticeDate={setNoticeDate}
      noticeUrgency={noticeUrgency}
      setNoticeUrgency={setNoticeUrgency}
      noticeTags={noticeTags}
      setNoticeTags={setNoticeTags}
      noticeEditableBy={noticeEditableBy}
      setNoticeEditableBy={setNoticeEditableBy}
      editingNoticeId={editingNoticeId}
      setEditingNoticeId={setEditingNoticeId}
      savingNotice={savingNotice}
      saveNotice={saveNotice}
      handleEditNotice={handleEditNotice}
      deleteNotice={deleteNotice}
      adminCategoryScope={adminCategoryScope}
      notices={notices}
      isOwner={!!isOwner}
    />
  );
  
  const currentCatSubjects = categories.find(c => c.id === adminCategoryScope)?.subjects || [];
  
  const practiceSetsTabNode = (
    <AdminPracticeSetsTab
      adminCategoryScope={adminCategoryScope}
      isOwner={!!isOwner}
      subjects={currentCatSubjects}
      apdfKeys={apdfKeys}
      ilovePdfKeys={ilovePdfKeys}
      cloudinaryCloudName={cloudinaryCloudName}
      cloudinaryUploadPreset={cloudinaryUploadPreset}
    />
  );

  const challengesTabNode = (
    <AdminChallengesTab
      challengeTitle={challengeTitle}
      setChallengeTitle={setChallengeTitle}
      challengeDescription={challengeDescription}
      setChallengeDescription={setChallengeDescription}
      challengeType={challengeType}
      setChallengeType={setChallengeType}
      challengeStartDate={challengeStartDate}
      setChallengeStartDate={setChallengeStartDate}
      challengeEndDate={challengeEndDate}
      setChallengeEndDate={setChallengeEndDate}
      challengeDuration={challengeDuration}
      setChallengeDuration={setChallengeDuration}
      challengeTasks={challengeTasks}
      setChallengeTasks={setChallengeTasks}
      challengeTodoFrequency={challengeTodoFrequency}
      setChallengeTodoFrequency={setChallengeTodoFrequency}
      editingChallengeId={editingChallengeId}
      setEditingChallengeId={setEditingChallengeId}
      savingChallenge={savingChallenge}
      saveChallenge={saveChallenge}
      handleEditChallenge={handleEditChallenge}
      deleteChallenge={deleteChallenge}
      adminCategoryScope={adminCategoryScope}
      challenges={challenges}
      isOwner={!!isOwner}
    />
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
            <AdminSidebarNav
              isOwner={!!isOwner}
              activeTab={activeTab}
              setActiveTab={setActiveTab as any}
              adminPermissions={adminPermissions}
              adminCategoryScope={adminCategoryScope}
              setAdminCategoryScope={setAdminCategoryScope}
              isForcedCategory={isForcedCategory}
              currentCategory={currentCategory}
              asPage={asPage}
            />
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
            <AdminAdminsTab
              categories={categories}
              allFirebaseUsers={allFirebaseUsers}
              handleUpdateUserRole={handleUpdateUserRole}
              handleTogglePermission={handleTogglePermission}
              currentUser={currentUser}
              loading={loading}
              isOwner={!!isOwner}
              handleRecalculateStats={handleRecalculateStats}
              recalculatingUserIds={recalculatingUserIds}
              handleUpdateUserStatus={handleUpdateUserStatus}
              fetchUsers={fetchUsers}
            />
          )}

          {activeTab === "users" &&
            (isOwner || adminPermissions?.canManageUsers) && (
              <AdminUsersTab
                isOwner={isOwner}
                loading={loading}
                allAppUsers={allAppUsers}
                allFirebaseUsers={allFirebaseUsers}
                bannedUsers={bannedUsers}
                mutedUsers={mutedUsers}
                muteDurationDays={muteDurationDays}
                setMuteDurationDays={setMuteDurationDays}
                saveSettings={saveSettings}
                expandedAdminId={expandedAdminId}
                setExpandedAdminId={setExpandedAdminId}
                adminListRef={adminListRef}
                recalculatingUserIds={recalculatingUserIds}
                handleUpdateUserRole={handleUpdateUserRole}
                handleUpdateUserStatus={handleUpdateUserStatus}
                handleRecalculateStats={handleRecalculateStats}
                handleTogglePermission={handleTogglePermission}
              />
            )}

          {activeTab === "liveMock" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageLiveMocks) &&
            liveMocksTabNode}

          {activeTab === "countdown" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageCountdowns) &&
            countdownsTabNode}

          {activeTab === "notice" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageNotices) &&
            noticesTabNode}

          {activeTab === "challenge" &&
            (!adminCategoryScope || isForcedCategory) &&
            (isOwner || adminPermissions?.canManageChallenges) &&
            challengesTabNode}

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
                isOwner || adminPermissions?.canManageLiveMocks ? liveMocksTabNode : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderNotice={() =>
                isOwner || adminPermissions?.canManageNotices ? noticesTabNode : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderCountdown={() =>
                isOwner || adminPermissions?.canManageCountdowns ? countdownsTabNode : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderChallenge={() =>
                isOwner || adminPermissions?.canManageChallenges ? challengesTabNode : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
              renderPracticeSets={() =>
                isOwner || adminPermissions?.canManageLearning ? practiceSetsTabNode : (
                  <div className="p-4 text-slate-500">Access Denied</div>
                )
              }
            />
          )}

          {activeTab === "quotes" &&
            (isOwner || adminPermissions?.canManageQuotes) && (
              <AdminQuotesTab />
          )}

          {activeTab === "learning" &&
            (isOwner || adminPermissions?.canManageLearning) && (
              <AdminLearningTab 
                categories={categories}
                adminCategoryScope={adminCategoryScope}
                setAdminCategoryScope={setAdminCategoryScope}
                practiceSetsTabNode={practiceSetsTabNode}
                isForcedCategory={isForcedCategory}
              />
          )}

          {activeTab === "features" &&
            (isOwner || adminPermissions?.canManageFeatures) && (
              <AdminFeaturesTab
                enableAiTutor={enableAiTutor}
                setEnableAiTutor={setEnableAiTutor}
                enableVocabulary={enableVocabulary}
                setEnableVocabulary={setEnableVocabulary}
                enableSpeedMath={enableSpeedMath}
                setEnableSpeedMath={setEnableSpeedMath}
                enablePracticeLibrary={enablePracticeLibrary}
                setEnablePracticeLibrary={setEnablePracticeLibrary}
                savingSettings={savingAnnouncement}
                saveSettings={saveSettings}
              />
          )}

          {activeTab === "settings" &&
            (isOwner || adminPermissions?.canManageSettings) && (
              <AdminSettingsTab
                telegramLink={telegramLink}
                setTelegramLink={setTelegramLink}
                telegramText={telegramText}
                setTelegramText={setTelegramText}
                savingSettings={savingAnnouncement}
                saveSettings={saveSettings}
                isOwner={!!isOwner}
              />
          )}

          {activeTab === "keys" && isOwner && (
            <AdminApiKeysTab
              apdfKeys={apdfKeys}
              setApdfKeys={setApdfKeys}
              ilovePdfKeys={ilovePdfKeys}
              setIlovePdfKeys={setIlovePdfKeys}
              cloudinaryCloudName={cloudinaryCloudName}
              setCloudinaryCloudName={setCloudinaryCloudName}
              cloudinaryUploadPreset={cloudinaryUploadPreset}
              setCloudinaryUploadPreset={setCloudinaryUploadPreset}
              savingSettings={savingAnnouncement}
              saveSettings={saveSettings}
            />
          )}

          {activeTab === "webhooks" && isOwner && (
            <AdminWebhooksTab />
          )}
          
          {activeTab === "search-logs" && isOwner && (
            <AdminSearchLogsTab />
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
