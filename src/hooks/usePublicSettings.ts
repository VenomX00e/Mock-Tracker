import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';

export function usePublicSettings() {
  const [telegramLink, setTelegramLink] = useState<string>('');
  const [telegramText, setTelegramText] = useState<string>('Contact us');
  const [enableAiTutor, setEnableAiTutor] = useState<boolean>(true);
  const [enableVocabulary, setEnableVocabulary] = useState<boolean>(true);
  const [enableSpeedMath, setEnableSpeedMath] = useState<boolean>(true);
  const [enablePracticeLibrary, setEnablePracticeLibrary] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribe: any;
    const fetchPublicSettings = async () => {
      try {
        const { onSnapshot, doc } = await import('firebase/firestore');
        unsubscribe = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setTelegramLink(data.telegramLink || '');
            setTelegramText(data.telegramText || 'Contact us');
            setEnableAiTutor(data.enableAiTutor ?? true);
            setEnableVocabulary(data.enableVocabulary ?? true);
            setEnableSpeedMath(data.enableSpeedMath ?? true);
            setEnablePracticeLibrary(data.enablePracticeLibrary ?? true);
          }
        }, (error: any) => {
          if (error.code !== 'permission-denied') {
             console.warn("Public settings subscription error:", error);
          }
        });
      } catch (e) {
        console.error("Error fetching settings", e);
      }
    };
    fetchPublicSettings();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return useMemo(() => ({ telegramLink, telegramText, enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary }), [telegramLink, telegramText, enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary]);
}
