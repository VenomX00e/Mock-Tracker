import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LATEST_VERSION } from '../config/versionConfig';

interface VersionState {
  currentLocalVersion: string;
  latestCloudVersion: string;
  hasUnreadUpdate: boolean;
  isUpdateModalOpen: boolean;
  setLocalVersion: (version: string) => void;
  setLatestCloudVersion: (version: string) => void;
  checkForUpdates: () => void;
  setUpdateModalOpen: (open: boolean) => void;
}

export const useVersionStore = create<VersionState>()(
  persist(
    (set, get) => ({
      // We start at v4.0 so the user gets to trigger the cool v5.0 update button!
      currentLocalVersion: 'v4.0',
      latestCloudVersion: 'v5.0',
      hasUnreadUpdate: true,
      isUpdateModalOpen: false,

      setLocalVersion: (version) => {
        const { latestCloudVersion } = get();
        set({ 
          currentLocalVersion: version, 
          hasUnreadUpdate: version.toLowerCase() !== latestCloudVersion.toLowerCase() 
        });
      },

      setLatestCloudVersion: (version) => {
        const { currentLocalVersion } = get();
        set({
          latestCloudVersion: version,
          hasUnreadUpdate: currentLocalVersion.toLowerCase() !== version.toLowerCase()
        });
      },

      checkForUpdates: () => {
        const { currentLocalVersion, latestCloudVersion } = get();
        set({ hasUnreadUpdate: currentLocalVersion.toLowerCase() !== latestCloudVersion.toLowerCase() });
      },

      setUpdateModalOpen: (open) => set({ isUpdateModalOpen: open })
    }),
    {
      name: 'system-app-version-store',
      partialize: (state) => ({
        currentLocalVersion: state.currentLocalVersion,
        hasUnreadUpdate: state.hasUnreadUpdate,
        latestCloudVersion: state.latestCloudVersion,
      }),
    }
  )
);
