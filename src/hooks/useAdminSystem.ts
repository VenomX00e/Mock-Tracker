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
  const [apdfKeys, setApdfKeys] = useState<string[]>([]);
  const [ilovePdfKeys, setIlovePdfKeys] = useState<string[]>([]);
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState("");
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState("");
  const [muteDurationDays, setMuteDurationDays] = useState<number | string>(7);
  const [enableAiTutor, setEnableAiTutor] = useState(true);
  const [enableVocabulary, setEnableVocabulary] = useState(true);
  const [enableSpeedMath, setEnableSpeedMath] = useState(true);
  const [enablePracticeLibrary, setEnablePracticeLibrary] = useState(true);
  const [mockExtractionModel, setMockExtractionModel] = useState('gemini-3.1-flash-lite');
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
          setApdfKeys(data.apdfKeys || []);
          setIlovePdfKeys(data.ilovePdfKeys || []);
          setCloudinaryCloudName(data.cloudinaryCloudName || "");
          setCloudinaryUploadPreset(data.cloudinaryUploadPreset || "");
          setMuteDurationDays(data.muteDurationDays || 7);
          setEnableAiTutor(data.enableAiTutor ?? true);
          setEnableVocabulary(data.enableVocabulary ?? true);
          setEnableSpeedMath(data.enableSpeedMath ?? true);
          setEnablePracticeLibrary(data.enablePracticeLibrary ?? true);
          setMockExtractionModel(data.mockExtractionModel || 'gemini-3.1-flash-lite');
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
          apdfKeys,
          ilovePdfKeys,
          cloudinaryCloudName,
          cloudinaryUploadPreset,
          muteDurationDays: Number(muteDurationDays) || 1,
          enableAiTutor,
          enableVocabulary,
          enableSpeedMath,
          enablePracticeLibrary,
          mockExtractionModel,
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
    apdfKeys,
    setApdfKeys,
    ilovePdfKeys,
    setIlovePdfKeys,
    cloudinaryCloudName,
    setCloudinaryCloudName,
    cloudinaryUploadPreset,
    setCloudinaryUploadPreset,
    muteDurationDays,
    setMuteDurationDays,
    enableAiTutor,
    setEnableAiTutor,
    enableVocabulary,
    setEnableVocabulary,
    enableSpeedMath,
    setEnableSpeedMath,
    enablePracticeLibrary,
    setEnablePracticeLibrary,
    mockExtractionModel,
    setMockExtractionModel,
    fetchAnnouncement,
    savingSettings,
    saveSettings
  }
}
