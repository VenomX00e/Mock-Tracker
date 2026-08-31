import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';

export function usePublicSettings() {
  const [telegramLink, setTelegramLink] = useState<string>('');
  const [telegramText, setTelegramText] = useState<string>('Contact us');
  const [enableAiTutor, setEnableAiTutor] = useState<boolean>(true);
  const [enableVocabulary, setEnableVocabulary] = useState<boolean>(true);
  const [enableSpeedMath, setEnableSpeedMath] = useState<boolean>(true);
  const [enablePracticeLibrary, setEnablePracticeLibrary] = useState<boolean>(true);
  const [mockExtractionModel, setMockExtractionModel] = useState<string>('gemini-3.1-flash-lite');
  const [hiddenYptTabs, setHiddenYptTabs] = useState<string[]>([]);

  useEffect(() => {
    let unsubscribe1: any;
    let unsubscribe2: any;
    const fetchPublicSettings = async () => {
      try {
        const { onSnapshot, doc } = await import('firebase/firestore');
        unsubscribe1 = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setTelegramLink(data.telegramLink || '');
            setTelegramText(data.telegramText || 'Contact us');
            setEnableAiTutor(data.enableAiTutor ?? true);
            setEnableVocabulary(data.enableVocabulary ?? true);
            setEnableSpeedMath(data.enableSpeedMath ?? true);
            setEnablePracticeLibrary(data.enablePracticeLibrary ?? true);
            setMockExtractionModel(data.mockExtractionModel || 'gemini-3.1-flash-lite');
            if (Array.isArray(data.hiddenYptTabs)) {
              setHiddenYptTabs(data.hiddenYptTabs);
            }
          }
        }, (error: any) => {
          if (error.code !== 'permission-denied') {
             console.warn("Public settings subscription error:", error);
          }
        });

        unsubscribe2 = onSnapshot(doc(db, 'yptChallenges', 'hub_settings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.hiddenYptTabs)) {
              setHiddenYptTabs(data.hiddenYptTabs);
            }
          }
        }, (error: any) => {
          if (error.code !== 'permission-denied') {
             console.warn("YPT config subscription error:", error);
          }
        });
      } catch (e) {
        console.error("Error fetching settings", e);
      }
    };
    fetchPublicSettings();
    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
  }, []);

  return useMemo(() => ({ telegramLink, telegramText, enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary, mockExtractionModel, hiddenYptTabs }), [telegramLink, telegramText, enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary, mockExtractionModel, hiddenYptTabs]);
}
