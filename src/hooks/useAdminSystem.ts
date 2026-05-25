import { useState, useCallback } from "react";
import { collection, query, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useAdminSystem() {
  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [telegramLink, setTelegramLink] = useState("");
  const [telegramText, setTelegramText] = useState("Contact us");
  const [muteDurationDays, setMuteDurationDays] = useState<number | string>(7);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "system")));
      const chalSnap = await getDocs(query(collection(db, "challenges")));
      const tempMocks: any[] = [];
      const tempNotices: any[] = [];
      const tempCountdowns: any[] = [];
      const tempChallenges: any[] = [];

      snap.forEach((d) => {
        const data = d.data();
        if (d.id === "settings") {
          setTelegramLink(data.telegramLink || "");
          setTelegramText(data.telegramText || "Contact us");
          setMuteDurationDays(data.muteDurationDays || 7);
        } else if (data.type === "notice") {
          tempNotices.push({ id: d.id, ...data });
        } else if (data.type === "liveMock") {
          tempMocks.push({ id: d.id, ...data });
        } else if (data.type === "countdown") {
          tempCountdowns.push({ id: d.id, ...data });
        }
      });

      chalSnap.forEach((d) => {
        tempChallenges.push({ id: d.id, ...d.data() });
      });

      setLiveMocks(tempMocks);
      setNotices(tempNotices);
      setCountdowns(tempCountdowns);
      setChallenges(tempChallenges);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const saveSettings = async (
    silent: boolean | React.FocusEvent<HTMLInputElement> = false,
  ) => {
    const isSilent = typeof silent === "boolean" ? silent : true;
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, "system", "settings"),
        {
          type: "settings",
          telegramLink,
          telegramText,
          muteDurationDays: Number(muteDurationDays) || 1,
        },
        { merge: true },
      );
      if (!isSilent) alert("Settings saved successfully");
    } catch (error) {
      console.error(error);
      if (!isSilent) alert("Failed to save settings");
    }
    setSavingSettings(false);
  };

  return {
    liveMocks,
    notices,
    countdowns,
    challenges,
    telegramLink,
    setTelegramLink,
    telegramText,
    setTelegramText,
    muteDurationDays,
    setMuteDurationDays,
    fetchAnnouncement,
    savingSettings,
    saveSettings
  }
}
