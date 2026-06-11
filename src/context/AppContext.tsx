import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../services/AuthContext';
export const useAuthCtx = () => {
    return useAuth();
};
import { useUserProfile } from '../hooks/useUserProfile';
import { useSystemData } from '../hooks/useSystemData';
import { useChallengesManager } from '../hooks/useChallengesManager';
import { useInlineEditNotice } from '../hooks/useInlineEditNotice';
import { usePublicSettings } from '../hooks/usePublicSettings';
import { MockScore } from '../types';

export interface AppStateContextType {

  handleUpdateProfileTasks: (tasks: any[]) => Promise<void>;
  isOwner: boolean;
  isAdminUser: boolean;
  isAdmin: boolean;
  adminPermissions: any;
  setLocalCategory: (val: string) => void;
  localCategory: string;
}

export const UserProfileCtx = createContext<ReturnType<typeof useUserProfile> | undefined>(undefined);
export const SystemDataCtx = createContext<ReturnType<typeof useSystemData> | undefined>(undefined);
export const ChallengesManagerCtx = createContext<ReturnType<typeof useChallengesManager> | undefined>(undefined);
export const InlineEditNoticeCtx = createContext<ReturnType<typeof useInlineEditNotice> | undefined>(undefined);
export const PublicSettingsCtx = createContext<ReturnType<typeof usePublicSettings> | undefined>(undefined);
export const AppStateCtx = createContext<AppStateContextType | undefined>(undefined);

export const useUserProfileCtx = () => {
  const ctx = useContext(UserProfileCtx);
  if (!ctx) throw new Error("useUserProfileCtx must be used within AppProvider");
  return ctx;
};
export const useSystemDataCtx = () => {
  const ctx = useContext(SystemDataCtx);
  if (!ctx) throw new Error("useSystemDataCtx must be used within AppProvider");
  return ctx;
};
export const useChallengesManagerCtx = () => {
  const ctx = useContext(ChallengesManagerCtx);
  if (!ctx) throw new Error("useChallengesManagerCtx must be used within AppProvider");
  return ctx;
};
export const useInlineEditNoticeCtx = () => {
  const ctx = useContext(InlineEditNoticeCtx);
  if (!ctx) throw new Error("useInlineEditNoticeCtx must be used within AppProvider");
  return ctx;
};
export const usePublicSettingsCtx = () => {
  const ctx = useContext(PublicSettingsCtx);
  if (!ctx) throw new Error("usePublicSettingsCtx must be used within AppProvider");
  return ctx;
};
export const useAppStateCtx = () => {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error("useAppStateCtx must be used within AppProvider");
  return ctx;
};

// Provider wrappers
const PublicSettingsProvider = ({ children }: { children: ReactNode }) => {
  const val = usePublicSettings();
  return <PublicSettingsCtx.Provider value={val}>{children}</PublicSettingsCtx.Provider>;
};

const UserProfileProviderWrapper = ({ children }: { children: ReactNode }) => {
  const val = useUserProfile();
  return <UserProfileCtx.Provider value={val}>{children}</UserProfileCtx.Provider>;
};

const DependentProviders = ({ children }: { children: ReactNode }) => {
  const authVal = useAuth();
  const userProfileVal = useContext(UserProfileCtx)!;
  const publicSettingsVal = useContext(PublicSettingsCtx)!;


  const { user } = authVal;
  const { profile, updateProfile } = userProfileVal;

  const isOwner = profile?.role === 'owner' || user?.email === 'mrityunjoyk29@gmail.com';
  const [localCategory, setLocalCategory] = useState<string>('banking');

  useEffect(() => {
    if (profile?.categoryId) setLocalCategory(profile.categoryId);
  }, [profile?.categoryId]);

  const isAdminUser = (profile?.role === 'admin' || profile?.role === 'owner') && profile?.adminCategories?.includes(localCategory);
  const isAdmin = isOwner || isAdminUser;

  const adminPermissions = useMemo(() => ({
    canManageUsers: isOwner || (isAdminUser && profile?.permissions?.canManageUsers),
    canManageNotices: isOwner || (isAdminUser && profile?.permissions?.canManageNotices),
    canManageChallenges: isOwner || (isAdminUser && profile?.permissions?.canManageChallenges),
    canManageLiveMocks: isOwner || (isAdminUser && profile?.permissions?.canManageLiveMocks),
    canManageCountdowns: isOwner || (isAdminUser && profile?.permissions?.canManageCountdowns),
    canManageSettings: isOwner || (isAdminUser && profile?.permissions?.canManageSettings),
    canManageFeatures: isOwner || (isAdminUser && profile?.permissions?.canManageFeatures),
    canManageQuotes: isOwner || (isAdminUser && profile?.permissions?.canManageQuotes),
    canManageLearning: isOwner || (isAdminUser && profile?.permissions?.canManageLearning),
  }), [isOwner, isAdminUser, profile?.permissions]);

  const handleUpdateProfileTasks = useCallback(async (tasks: any[]) => {
    if (updateProfile) await updateProfile({ tasks });
  }, [updateProfile]);

  const systemDataVal = useSystemData(user, profile, adminPermissions, isOwner);
  const { pinnedChallenges, fetchAnnouncement, notices, setNotices, categories } = systemDataVal;

  useEffect(() => {
    if (categories && categories.length > 0) {
      const exists = categories.find((c: any) => c.id === localCategory);
      if (!exists) {
        const fallback = categories.find((c: any) => c.id === 'banking') ? 'banking' : categories[0].id;
        setLocalCategory(fallback);
      }
    }
  }, [categories, localCategory]);

  const challengesManagerVal = useChallengesManager(user, adminPermissions, isOwner, pinnedChallenges, systemDataVal.setPinnedChallenges, fetchAnnouncement);
  const inlineEditNoticeVal = useInlineEditNotice(user, isAdmin, notices, setNotices);

  const appStateVal = useMemo(() => ({
    handleUpdateProfileTasks,
    isOwner, isAdminUser, isAdmin, adminPermissions, setLocalCategory, localCategory,
  }), [handleUpdateProfileTasks, isOwner, isAdminUser, isAdmin, adminPermissions, localCategory]);

  return (
    <SystemDataCtx.Provider value={systemDataVal}>
      <ChallengesManagerCtx.Provider value={challengesManagerVal}>
        <InlineEditNoticeCtx.Provider value={inlineEditNoticeVal}>
          <AppStateCtx.Provider value={appStateVal}>
            {children}
          </AppStateCtx.Provider>
        </InlineEditNoticeCtx.Provider>
      </ChallengesManagerCtx.Provider>
    </SystemDataCtx.Provider>
  );
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <PublicSettingsProvider>
      <UserProfileProviderWrapper>
        <DependentProviders>
          {children}
        </DependentProviders>
      </UserProfileProviderWrapper>
    </PublicSettingsProvider>
  );
};
