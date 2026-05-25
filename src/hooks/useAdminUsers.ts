import { useState } from "react";
import { collection, query, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { calculateStats } from "./useMocks";
import { UserProfile } from "../types";

export function useAdminUsers(currentUser: any) {
  const [bannedUsers, setBannedUsers] = useState<UserProfile[]>([]);
  const [mutedUsers, setMutedUsers] = useState<UserProfile[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<UserProfile[]>([]);
  const [allFirebaseUsers, setAllFirebaseUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalculatingUserIds, setRecalculatingUserIds] = useState<Set<string>>(new Set());

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
      const uniqueCats = new Set(mocks.map(m => m.categoryId || "banking"));
      uniqueCats.forEach(cat => {
        const catMocks = mocks.filter(m => (m.categoryId || "banking") === cat);
        categoryStats[cat as string] = {
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
        if (e.code === "not-found") {
          await setDoc(doc(db, "users", userId), payload);
        } else {
          throw e;
        }
      }

      alert("User stats recalculation finished.");
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

  return {
    bannedUsers,
    mutedUsers,
    allAppUsers,
    allFirebaseUsers,
    loading,
    fetchUsers,
    recalculatingUserIds,
    handleUpdateUserRole,
    handleTogglePermission,
    handleUpdateUserStatus,
    handleRecalculateStats
  }
}
