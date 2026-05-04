import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { MockScore } from '../types';
import { parseLocalDate } from '../lib/utils';

function calculateStats(mocks: MockScore[]) {
  if (!mocks.length) return { avgPercentile: 0, avgAccuracy: 0, avgQuantPercentile: 0, avgReasoningPercentile: 0, avgEnglishPercentile: 0, totalTests: 0, streak: 0, lastMockDate: '' };
  
  const total = mocks.length;
  let sumP = 0, pCount = 0;
  let sumQ = 0, qCount = 0;
  let sumR = 0, rCount = 0;
  let sumE = 0, eCount = 0;
  let sumG = 0, gCount = 0;
  let sumAcc = 0, accCount = 0;
  
  mocks.forEach(m => {
    if ((!m.examScope || m.examScope === 'Full') && m.percentile != null && !isNaN(m.percentile) && m.percentile > 0) {
      sumP += m.percentile;
      pCount++;
    }
    if (m.quant?.percentile != null && !isNaN(m.quant.percentile) && m.quant.percentile > 0) {
      sumQ += m.quant.percentile;
      qCount++;
    }
    if (m.reasoning?.percentile != null && !isNaN(m.reasoning.percentile) && m.reasoning.percentile > 0) {
      sumR += m.reasoning.percentile;
      rCount++;
    }
    if (m.english?.percentile != null && !isNaN(m.english.percentile) && m.english.percentile > 0) {
      sumE += m.english.percentile;
      eCount++;
    }
    if (m.ga?.percentile != null && !isNaN(m.ga.percentile) && m.ga.percentile > 0) {
        sumG += m.ga.percentile;
        gCount++;
    }
    if (m.accuracy !== undefined && m.accuracy !== null && !isNaN(m.accuracy)) {
        sumAcc += m.accuracy;
        accCount++;
    }
  });

  const datesStr = mocks.map(m => m.date).sort((a,b) => parseLocalDate(b).getTime() - parseLocalDate(a).getTime());
  const lastMockDate = datesStr[0] || '';

  const dates = mocks.map(m => {
    const d = parseLocalDate(m.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }).sort((a,b) => b - a);
  const uniqueDates = [...new Set(dates)];
  
  let streak = 0;
  let streakActive = false;
  
  if (uniqueDates.length > 0) {
    let currentDt = new Date(uniqueDates[0]);
    streak = 1;
    
    for (let i = 1; i < uniqueDates.length; i++) {
       const expectedPrevDt = new Date(currentDt);
       expectedPrevDt.setDate(expectedPrevDt.getDate() - 1);
       if (uniqueDates[i] === expectedPrevDt.getTime()) {
          streak++;
          currentDt = expectedPrevDt;
       } else {
          break;
       }
    }
    
    const todayTime = new Date();
    const today = new Date(todayTime.getFullYear(), todayTime.getMonth(), todayTime.getDate()).getTime();
    
    if (uniqueDates[0] === today) {
       streakActive = true;
    } else {
       const yesterdayTime = new Date(todayTime);
       yesterdayTime.setDate(yesterdayTime.getDate() - 1);
       const yesterday = new Date(yesterdayTime.getFullYear(), yesterdayTime.getMonth(), yesterdayTime.getDate()).getTime();
       
       if (uniqueDates[0] === yesterday) {
          streakActive = false;
       } else {
          streak = 0;
          streakActive = false;
       }
    }
  }

  return {
    avgPercentile: pCount > 0 ? Number((sumP / pCount).toFixed(2)) : 0,
    avgAccuracy: accCount > 0 ? Number((sumAcc / accCount).toFixed(2)) : 0,
    avgQuantPercentile: qCount > 0 ? Number((sumQ / qCount).toFixed(2)) : 0,
    avgReasoningPercentile: rCount > 0 ? Number((sumR / rCount).toFixed(2)) : 0,
    avgEnglishPercentile: eCount > 0 ? Number((sumE / eCount).toFixed(2)) : 0,
    avgGaPercentile: gCount > 0 ? Number((sumG / gCount).toFixed(2)) : 0,
    totalTests: total,
    streak,
    streakActive,
    ...(lastMockDate ? { lastMockDate } : {})
  };
}

export function useMocks() {
  const { user } = useAuth();
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [deletedMocks, setDeletedMocks] = useState<MockScore[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setMocks([]);
      setDeletedMocks([]);
      setStats(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'mocks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mockData: MockScore[] = [];
      const deletedData: MockScore[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        if (data.isDeleted) {
            deletedData.push({
              ...data,
              id: doc.id,
            } as MockScore);
        } else {
            mockData.push({
              ...data,
              id: doc.id,
            } as MockScore);
        }
      });
      mockData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      deletedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMocks(mockData);
      setDeletedMocks(deletedData);
      
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
      const targetDateStr = mock.date;
      const targetTime = parseLocalDate(targetDateStr);
      const targetTimeMidnight = new Date(targetTime.getFullYear(), targetTime.getMonth(), targetTime.getDate()).getTime();
      
      const allDates = [...new Set([...mocks.map(m => {
          const d = parseLocalDate(m.date);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }), targetTimeMidnight])].sort((a,b) => b - a);
      
      const targetIdx = allDates.indexOf(targetTimeMidnight);
      
      let newStreakAtTime = 1;
      let currentDt = new Date(targetTimeMidnight);
      
      for (let i = targetIdx + 1; i < allDates.length; i++) {
        const expectedPrevDt = new Date(currentDt);
        expectedPrevDt.setDate(expectedPrevDt.getDate() - 1);
        if (allDates[i] === expectedPrevDt.getTime()) {
           newStreakAtTime++;
           currentDt = expectedPrevDt;
        } else {
           break;
        }
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
      await setDoc(doc(db, 'users', user.uid, 'mocks', id), { isDeleted: true, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Error deleting mock:", error);
    }
  };

  const permanentlyDeleteMock = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mocks', id));
    } catch (error) {
      console.error("Error permanently deleting mock:", error);
    }
  };

  const restoreDeletedMock = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'mocks', id), { isDeleted: false, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Error restoring mock:", error);
    }
  };

  return { mocks, deletedMocks, stats, loading, addMock, updateMock, deleteMock, permanentlyDeleteMock, restoreDeletedMock };
}
