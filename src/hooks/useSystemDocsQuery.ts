import useSWR from 'swr';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

async function fetchSystemDocs() {
  const snap = await getDocs(query(collection(db, 'system')));
  
  let activeNotices: any[] = [];
  let activeCountdowns: any[] = [];
  let mocks: any[] = [];
  let pins: string[] = [];
  let noticePins: string[] = [];
  let pinnedChallenges: string[] = [];
  let quotesConfig: any = null;
  let speedMathConfig: any = null;
  const nowTs = new Date().getTime();

  snap.forEach(d => {
    const data = d.data();
    if (d.id === 'config') {
      pins = data.pinnedCountdowns || [];
      noticePins = data.pinnedNotices || [];
      pinnedChallenges = data.pinnedChallenges || [];
    } else if (d.id === 'quotesConfig') {
      quotesConfig = data;
    } else if (d.id === 'speedMathConfig') {
      speedMathConfig = data;
    } else if (data.type === 'notice') {
      if (data.date && new Date(data.date).getTime() < nowTs) return;
      activeNotices.push({ id: d.id, ...data });
    } else if (data.type === 'liveMock') {
        if (data.date && new Date(data.date).getTime() < nowTs) {
           deleteDoc(doc(db, 'system', d.id)).catch(console.error);
           return;
        }
        mocks.push({ id: d.id, ...data });
    } else if (data.type === 'countdown') {
        if (data.date && new Date(data.date).getTime() < nowTs) return;
        activeCountdowns.push({ id: d.id, ...data });
    }
  });

  activeCountdowns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    activeNotices,
    activeCountdowns,
    liveMocks: mocks,
    pinnedCountdowns: pins,
    pinnedNotices: noticePins,
    pinnedChallenges,
    quotesConfig,
    speedMathConfig
  };
}

export function useSystemDocsQuery() {
  const { data, error, mutate } = useSWR('systemDocs', fetchSystemDocs, {
    revalidateOnFocus: false
  });

  return {
    notices: data?.activeNotices || [],
    countdowns: data?.activeCountdowns || [],
    liveMocks: data?.liveMocks || [],
    pinnedCountdowns: data?.pinnedCountdowns || [],
    pinnedNotices: data?.pinnedNotices || [],
    pinnedChallenges: data?.pinnedChallenges || [],
    quotesConfig: data?.quotesConfig || null,
    speedMathConfig: data?.speedMathConfig || null,
    mutateSystemDocs: mutate
  };
}
