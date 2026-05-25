import { useState } from "react";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useAdminSettings(
  initialTelegramLink: string = "",
  initialTelegramText: string = "Contact us",
  initialMuteDuration: number | string = 7
) {
  const [telegramLink, setTelegramLink] = useState(initialTelegramLink);
  const [telegramText, setTelegramText] = useState(initialTelegramText);
  const [muteDurationDays, setMuteDurationDays] = useState<number | string>(initialMuteDuration);
  const [savingSettings, setSavingSettings] = useState(false);

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
          muteDurationDays,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      if (!isSilent) {
        alert("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings", error);
      if (!isSilent) alert("Failed to save settings");
    }
    setSavingSettings(false);
  };

  return {
    telegramLink, setTelegramLink,
    telegramText, setTelegramText,
    muteDurationDays, setMuteDurationDays,
    savingSettings, saveSettings
  };
}
