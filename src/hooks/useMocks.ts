import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { MockScore } from '../types';

function calculateStats(mocks: MockScore[]) {
  if (!mocks.length) return { avgPercentile: 0, avgAccuracy: 0, avgQuantPercentile: 0, avgReasoningPercentile: 0, avgEnglishPercentile: 0, totalTests: 0, streak: 0, lastMockDate: '' };
  
  const total = mocks.length;
  let sumP = 0, sumQ = 0, sumR = 0, sumE = 0, sumG = 0;
  let sumAcc = 0;
  let hasG = false;
  let accCount = 0;
  
  mocks.forEach(m => {
    sumP += m.percentile || 0;
    sumQ += m.quant?.percentile || 0;
    sumR += m.reasoning?.percentile || 0;
    sumE += m.english?.percentile || 0;
    if (m.ga?.percentile) {
        sumG += m.ga.percentile;
        hasG = true;
    }
    if (m.accuracy !== undefined && !isNaN(m.accuracy)) {
        sumAcc += m.accuracy;
        accCount++;
    }
  });

  const datesStr = mocks.map(m => m.date).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
  const lastMockDate = datesStr[0] || '';

  const dates = mocks.map(m => new Date(m.date).setHours(0,0,0,0)).sort((a,b) => b - a);
  const uniqueDates = [...new Set(dates)];
  
  let streak = 0;
  const today = new Date().setHours(0,0,0,0);
  const msPerDay = 86400000;
  
  if (uniqueDates.length > 0) {
    if (uniqueDates[0] === today) {
      streak = 1;
      let expectedNextDate = today - msPerDay;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === expectedNextDate) {
          streak++;
          expectedNextDate -= msPerDay;
        } else {
          break;
        }
      }
    } else if (uniqueDates[0] === today - msPerDay) {
      streak = 1;
      let expectedNextDate = today - 2 * msPerDay;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === expectedNextDate) {
          streak++;
          expectedNextDate -= msPerDay;
        } else {
          break;
        }
      }
    }
  }

  return {
    avgPercentile: total > 0 ? Number((sumP / total).toFixed(2)) : 0,
    avgAccuracy: accCount > 0 ? Number((sumAcc / accCount).toFixed(2)) : 0,
    avgQuantPercentile: total > 0 ? Number((sumQ / total).toFixed(2)) : 0,
    avgReasoningPercentile: total > 0 ? Number((sumR / total).toFixed(2)) : 0,
    avgEnglishPercentile: total > 0 ? Number((sumE / total).toFixed(2)) : 0,
    avgGaPercentile: total > 0 && hasG ? Number((sumG / total).toFixed(2)) : 0,
    totalTests: total,
    streak,
    ...(lastMockDate ? { lastMockDate } : {})
  };
}

export function useMocks() {
  const { user } = useAuth();
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setMocks([]);
      setStats(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'mocks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mockData: MockScore[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        mockData.push({
          ...data,
          id: doc.id,
        } as MockScore);
      });
      setMocks(mockData);
      
      // Sync stats back to user profile when mock data changes
      const calculatedStats = calculateStats(mockData);
      setStats(calculatedStats);
      
      setDoc(doc(db, 'users', user.uid), {
        ...calculatedStats,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(console.error);

      setLoading(false);
    }, (error) => {
      console.error("Error fetching mocks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addMock = async (mock: MockScore) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'mocks', mock.id);
      
      // Calculate what the streak will be after this mock is added
      const mockDateObj = new Date(mock.date).setHours(0,0,0,0);
      const today = new Date().setHours(0,0,0,0);
      const dates = mocks.map(m => new Date(m.date).setHours(0,0,0,0));
      const hasMockToday = dates.includes(today);
      const hasMockOnDate = dates.includes(mockDateObj);
      
      let newStreakAtTime = stats?.streak || 0;
      if (mockDateObj === today && !hasMockToday) {
        // Adding a mock for today and none existed yet
        const msPerDay = 86400000;
        const hasMockYesterday = dates.includes(today - msPerDay);
        if (hasMockYesterday) {
            newStreakAtTime = (stats?.streak || 0) + 1;
        } else {
            newStreakAtTime = 1;
        }
      } else if (!hasMockOnDate && newStreakAtTime === 0) {
          // Fallback basic streak count if needed
          newStreakAtTime = 1;
      }
      
      await setDoc(docRef, {
        ...mock,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        streakAtTime: mock.streakAtTime ?? newStreakAtTime,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding mock:", error);
    }
  };

  const updateMock = async (updatedMock: MockScore) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'mocks', updatedMock.id);
      const oldItem = mocks.find(m => m.id === updatedMock.id);
      await setDoc(docRef, {
        ...updatedMock,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        createdAt: oldItem?.createdAt || serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating mock:", error);
    }
  };
  
  const deleteMock = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mocks', id));
    } catch (error) {
      console.error("Error deleting mock:", error);
    }
  };

  return { mocks, stats, loading, addMock, updateMock, deleteMock };
}
