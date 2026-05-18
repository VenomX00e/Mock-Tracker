import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { MockScore } from '../types';
import { parseLocalDate } from '../lib/utils';

function calculateStats(mocks: MockScore[], periodDays?: number) {
  let filteredMocks = mocks;
  if (periodDays !== undefined) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffTime = cutoff.getTime();
    filteredMocks = mocks.filter(m => {
       const d = parseLocalDate(m.date);
       return d.getTime() >= cutoffTime;
    });
  }

  if (!filteredMocks.length) return { avgPercentile: 0, avgAccuracy: 0, avgQuantPercentile: 0, avgReasoningPercentile: 0, avgEnglishPercentile: 0, avgGaPercentile: 0, totalTests: 0, streak: 0, lastMockDate: '', dynamicAverages: {} };
  
  const total = filteredMocks.length;
  let sumP = 0, pCount = 0;
  let sumQ = 0, qCount = 0;
  let sumR = 0, rCount = 0;
  let sumE = 0, eCount = 0;
  let sumG = 0, gCount = 0;
  let sumAcc = 0, accCount = 0;
  
  const dynamicSums: Record<string, { sum: number; count: number }> = {};

  filteredMocks.forEach(m => {
    const qPerc = m.quant?.percentile || m.dynamicSubjects?.['bank_quant']?.percentile || m.dynamicSubjects?.['ssc_maths']?.percentile;
    const rPerc = m.reasoning?.percentile || m.dynamicSubjects?.['bank_reasoning']?.percentile || m.dynamicSubjects?.['ssc_reasoning']?.percentile;
    const ePerc = m.english?.percentile || m.dynamicSubjects?.['bank_english']?.percentile || m.dynamicSubjects?.['ssc_english']?.percentile;
    const gPerc = m.ga?.percentile || m.dynamicSubjects?.['bank_ga']?.percentile || m.dynamicSubjects?.['ssc_gk']?.percentile;

    if ((!m.examScope || m.examScope === 'Full') && m.percentile != null && !isNaN(m.percentile) && m.percentile > 0) {
      sumP += m.percentile;
      pCount++;
    }
    if (qPerc != null && !isNaN(qPerc) && qPerc > 0) {
      sumQ += qPerc;
      qCount++;
    }
    if (rPerc != null && !isNaN(rPerc) && rPerc > 0) {
      sumR += rPerc;
      rCount++;
    }
    if (ePerc != null && !isNaN(ePerc) && ePerc > 0) {
      sumE += ePerc;
      eCount++;
    }
    if (gPerc != null && !isNaN(gPerc) && gPerc > 0) {
        sumG += gPerc;
        gCount++;
    }
    if (m.accuracy !== undefined && m.accuracy !== null && !isNaN(m.accuracy)) {
        sumAcc += m.accuracy;
        accCount++;
    }
    if (m.dynamicSubjects) {
      Object.keys(m.dynamicSubjects).forEach(subId => {
        const perc = m.dynamicSubjects![subId]?.percentile;
        if (perc != null && !isNaN(perc) && perc > 0) {
          if (!dynamicSums[subId]) dynamicSums[subId] = { sum: 0, count: 0 };
          dynamicSums[subId].sum += perc;
          dynamicSums[subId].count++;
        }
      });
    }
  });

  const datesStr = filteredMocks.map(m => m.date).sort((a,b) => parseLocalDate(b).getTime() - parseLocalDate(a).getTime());
  const lastMockDate = datesStr[0] || '';

  const dates = filteredMocks.map(m => {
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

    const dynamicAverages: Record<string, number> = {};
    Object.keys(dynamicSums).forEach(subId => {
      dynamicAverages[subId] = Number((dynamicSums[subId].sum / dynamicSums[subId].count).toFixed(2));
    });

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
    dynamicAverages,
    ...(lastMockDate ? { lastMockDate } : {})
  };
}

import useSWRSubscription from 'swr/subscription';

export function useMocks() {
  const { user } = useAuth();

  const { data, error } = useSWRSubscription(
    user ? ['mocks', user.uid] : null,
    ([_, uid], { next }) => {
      const q = query(collection(db, 'users', uid, 'mocks'));
      return onSnapshot(q, (snapshot) => {
        const mockData: MockScore[] = [];
        const deletedData: MockScore[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          if (data.isDeleted) {
              deletedData.push({ ...data, id: doc.id } as MockScore);
          } else {
              mockData.push({ ...data, id: doc.id } as MockScore);
          }
        });
        mockData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        deletedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Calculate stats purely in memory for local app state
        const calculatedStats = calculateStats(mockData);

        next(null, { mocks: mockData, deletedMocks: deletedData, stats: calculatedStats });
      }, (err: any) => {
        if (err.code === 'permission-denied') {
          // Ignore permission-denied errors during sign-out
          next(null, { mocks: [], deletedMocks: [], stats: null });
        } else {
          console.error("Error fetching mocks:", err);
          next(err);
        }
      });
    }
  );

  const mocks = data?.mocks || [];
  const deletedMocks = data?.deletedMocks || [];
  const stats = data?.stats || null;
  const loading = !data && !error && !!user;

  const updateStatsForUser = async (uid: string, mockData: MockScore[]) => {
    try {
      const calculatedStats = calculateStats(mockData);
      const stats30D = calculateStats(mockData, 30);
      const stats7D = calculateStats(mockData, 7);
      
      const categoryStats: Record<string, any> = {};
      const uniqueCats = new Set(mockData.map(m => m.categoryId || 'banking'));
      uniqueCats.forEach(cat => {
        const catMocks = mockData.filter(m => (m.categoryId || 'banking') === cat);
        categoryStats[cat] = {
           allTime: calculateStats(catMocks),
           stats30D: calculateStats(catMocks, 30),
           stats7D: calculateStats(catMocks, 7)
        };
      });
      
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        ...calculatedStats,
        stats30D,
        stats7D,
        categoryStats,
        lastActiveAt: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error updating stats", e);
    }
  };

  const validateMockScore = (mock: MockScore) => {
    if (!mock.id || mock.id.length > 128) throw new Error("Invalid mock ID");
    if (!mock.mockName || mock.mockName.length > 200) throw new Error("Mock name too long");
    if (!mock.examType || mock.examType.length > 100) throw new Error("Exam type too long");
    if (mock.examRole && mock.examRole.length > 100) throw new Error("Exam role too long");
    if (mock.examPhase && mock.examPhase.length > 100) throw new Error("Exam phase too long");
    if (mock.examScope && mock.examScope.length > 100) throw new Error("Exam scope too long");
    if (mock.platform && mock.platform.length > 100) throw new Error("Platform too long");
    if (mock.customPlatform && mock.customPlatform.length > 100) throw new Error("Custom platform too long");
    if (!mock.date || mock.date.length > 50) throw new Error("Invalid date");
  };

  const addMock = async (mock: MockScore) => {
    if (!user) return;
    try {
      validateMockScore(mock);

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
      
      const newMocks = [...mocks, mock].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      await updateStatsForUser(user.uid, newMocks);
    } catch (error: any) {
      console.error("Error adding mock:", error);
      throw error; // Rethrow to UI
    }
  };

  const updateMock = async (updatedMock: MockScore) => {
    if (!user) return;
    try {
      validateMockScore(updatedMock);

      const docRef = doc(db, 'users', user.uid, 'mocks', updatedMock.id);
      const oldItem = mocks.find(m => m.id === updatedMock.id);
      await setDoc(docRef, {
        ...updatedMock,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        createdAt: oldItem?.createdAt || serverTimestamp()
      }, { merge: true });

      const newMocks = mocks.map(m => m.id === updatedMock.id ? updatedMock : m);
      await updateStatsForUser(user.uid, newMocks);
    } catch (error: any) {
      console.error("Error updating mock:", error);
      throw error; // Rethrow to UI
    }
  };
  
  const deleteMock = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'mocks', id), { isDeleted: true, updatedAt: serverTimestamp() }, { merge: true });
      const newMocks = mocks.filter(m => m.id !== id);
      await updateStatsForUser(user.uid, newMocks);
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
      const restoredMock = deletedMocks.find(m => m.id === id);
      if (restoredMock) {
        const newMocks = [...mocks, { ...restoredMock, isDeleted: false }].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        await updateStatsForUser(user.uid, newMocks);
      }
    } catch (error) {
      console.error("Error restoring mock:", error);
    }
  };

  return useMemo(() => ({
    mocks, deletedMocks, stats, loading, addMock, updateMock, deleteMock, permanentlyDeleteMock, restoreDeletedMock
  }), [mocks, deletedMocks, stats, loading, user?.uid]);
}
