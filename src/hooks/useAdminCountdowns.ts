import { useState, useEffect } from "react";
import { setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useAdminCountdowns(
  adminCategoryScope: string | null,
  getPrefix: (categoryId: string | null) => string,
  fetchAnnouncement: () => Promise<void>,
  editCountdownData: any,
  initialTab: string,
  isOpen: boolean,
  setAdminCategoryScope: (id: string | null) => void
) {
  const [countdownTitle, setCountdownTitle] = useState("");
  const [countdownDate, setCountdownDate] = useState("");
  const [countdownNote, setCountdownNote] = useState("");
  const [countdownColor, setCountdownColor] = useState("green");
  const [editingCountdownId, setEditingCountdownId] = useState<string | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  useEffect(() => {
    if (editCountdownData && initialTab === "countdown") {
      setEditingCountdownId(editCountdownData.id);
      setCountdownTitle(editCountdownData.title || "");
      setCountdownDate(editCountdownData.date || "");
      setCountdownNote(editCountdownData.note || "");
      setCountdownColor(editCountdownData.color || "green");
      if (editCountdownData.categoryId) {
        setAdminCategoryScope(editCountdownData.categoryId);
      }
    }
  }, [initialTab, editCountdownData, isOpen, setAdminCategoryScope]);

  const saveCountdown = async () => {
    setSavingAnnouncement(true);
    try {
      if (!countdownTitle || !countdownDate) {
        alert("Title and Date are required");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingCountdownId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_COUNTDOWN_${Date.now()}`
          : `countdown_${Date.now()}`);
      const payload: any = {
        type: "countdown",
        title: countdownTitle,
        categoryId: adminCategoryScope || null,
        date: countdownDate,
        updatedAt: new Date().toISOString(),
      };
      if (countdownNote) payload.note = countdownNote;
      if (countdownColor) payload.color = countdownColor;

      await setDoc(doc(db, "system", newId), payload, {
        merge: !!editingCountdownId,
      });

      alert(
        editingCountdownId
          ? "Countdown updated successfully"
          : "Countdown saved successfully"
      );
      setEditingCountdownId(null);
      setCountdownTitle("");
      setCountdownDate("");
      setCountdownNote("");
      setCountdownColor("green");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving countdown", error);
      alert("Failed to save countdown");
    }
    setSavingAnnouncement(false);
  };

  const handleEditCountdown = (c: any) => {
    setEditingCountdownId(c.id);
    setCountdownTitle(c.title || "");
    setCountdownDate(c.date || "");
    setCountdownNote(c.note || "");
    setCountdownColor(c.color || "green");
    if (c.categoryId) setAdminCategoryScope(c.categoryId);
  };

  const deleteCountdown = async (id: string) => {
    try {
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete countdown");
    }
  };

  return {
    countdownTitle, setCountdownTitle,
    countdownDate, setCountdownDate,
    countdownNote, setCountdownNote,
    countdownColor, setCountdownColor,
    editingCountdownId, setEditingCountdownId,
    savingCountdown: savingAnnouncement,
    saveCountdown,
    handleEditCountdown,
    deleteCountdown
  };
}
