import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../types';

export const useLeaderboardRank = (profile: UserProfile | null | undefined, categoryId?: string) => {
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRank = async () => {
      if (!profile?.userId) return;
      try {
        const q = query(collection(db, 'users'), orderBy('avgPercentile', 'desc'), limit(1000));
        const snap = await getDocs(q);
        if (!isMounted) return;

        const users = snap.docs.map(d => d.data() as UserProfile);
        
        const catId = categoryId || 'banking';

        users.forEach(u => {
           if (u.categoryStats) {
               const cs = u.categoryStats[catId]?.allTime;
               if (cs) {
                   u.avgPercentile = cs.avgPercentile || 0;
                   u.totalTests = cs.totalTests || 0;
                   u.avgAccuracy = cs.avgAccuracy || 0;
                   u.avgQuantPercentile = cs.avgQuantPercentile || 0;
                   u.avgReasoningPercentile = cs.avgReasoningPercentile || 0;
                   u.avgEnglishPercentile = cs.avgEnglishPercentile || 0;
                   u.avgGaPercentile = cs.avgGaPercentile || 0;
               } else {
                   u.avgPercentile = 0;
                   u.totalTests = 0;
                   u.avgAccuracy = 0;
                   u.avgQuantPercentile = 0;
                   u.avgReasoningPercentile = 0;
                   u.avgEnglishPercentile = 0;
                   u.avgGaPercentile = 0;
               }
           } else if (u.categoryId === catId || (!u.categoryId && catId === 'banking')) {
               // Keep global
           } else {
               u.avgPercentile = 0;
               u.totalTests = 0;
               u.avgAccuracy = 0;
               u.avgQuantPercentile = 0;
               u.avgReasoningPercentile = 0;
               u.avgEnglishPercentile = 0;
               u.avgGaPercentile = 0;
           }
        });

        users.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));
        
        let visibleUsers = users.filter((u) => !u.isBanned && !u.isMuted);
        
        visibleUsers = visibleUsers.filter(u => u.categoryId === catId || (!u.categoryId && catId === 'banking') || (u.categoryStats && u.categoryStats[catId] && u.categoryStats[catId].allTime.totalTests > 0));
        visibleUsers = visibleUsers.filter(u => u.totalTests > 0);

        // Deduplicate by email
        const emailMap = new Map<string, UserProfile>();
        const finalVisibleUsers: UserProfile[] = [];
        for (const u of visibleUsers) {
           if (u.email) {
               if (!emailMap.has(u.email)) {
                   emailMap.set(u.email, u);
               } else {
                   const existing = emailMap.get(u.email)!;
                   if ((u.totalTests || 0) > (existing.totalTests || 0)) {
                       emailMap.set(u.email, u);
                   }
               }
           } else {
               finalVisibleUsers.push(u);
           }
        }
        for (const u of emailMap.values()) {
            finalVisibleUsers.push(u);
        }
        
        finalVisibleUsers.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));

        const rank = finalVisibleUsers.findIndex(u => u.userId === profile.userId) + 1;
        
        if (isMounted) {
          if (rank > 0) {
            setLeaderboardRank(rank);
          } else {
            setLeaderboardRank(null);
          }
        }
      } catch (e: any) {
        if (e.code !== 'permission-denied') {
          console.error("Error fetching rank", e);
        }
      }
    };
    fetchRank();
    
    return () => {
      isMounted = false;
    };
  }, [profile?.userId, categoryId]);

  return leaderboardRank;
};
