import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';

export function usePublicSettings() {
  const [telegramLink, setTelegramLink] = useState<string>('');
  const [telegramText, setTelegramText] = useState<string>('Contact us');

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

  return useMemo(() => ({ telegramLink, telegramText }), [telegramLink, telegramText]);
}
