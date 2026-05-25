import { useState } from "react";
import { setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useAdminChallenges(
  adminCategoryScope: string | null,
  getPrefix: (categoryId: string | null) => string,
  fetchAnnouncement: () => Promise<void>,
  setAdminCategoryScope: (id: string | null) => void
) {
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeType, setChallengeType] = useState("streak");
  const [challengeStartDate, setChallengeStartDate] = useState("");
  const [challengeEndDate, setChallengeEndDate] = useState("");
  const [challengeDuration, setChallengeDuration] = useState("");
  const [challengeTasks, setChallengeTasks] = useState<{ id: string; text: string }[]>([]);
  const [challengeTodoFrequency, setChallengeTodoFrequency] = useState<"oneTime" | "daily">("daily");
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [savingChallenge, setSavingChallenge] = useState(false);

  const saveChallenge = async () => {
    setSavingChallenge(true);
    try {
      if (!challengeTitle || !challengeStartDate || !challengeEndDate) {
        alert("Challenge title, start date and end date are required");
        setSavingChallenge(false);
        return;
      }
      const start = new Date(challengeStartDate).getTime();
      const end = new Date(challengeEndDate).getTime();
      if (end < start) {
        alert("End date cannot be before start date");
        setSavingChallenge(false);
        return;
      }
      const durationDays = challengeDuration
        ? parseInt(challengeDuration)
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const newId =
        editingChallengeId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_CHALLENGE_${Date.now()}`
          : `challenge_${Date.now()}`);
      const cleanTasks = challengeTasks
        .map((t) => ({ ...t, text: t.text.trim() }))
        .filter((t) => t.text.length > 0);
      
      const payload: any = {
        title: challengeTitle,
        categoryId: adminCategoryScope || null,
        description: challengeDescription,
        challengeType,
        todoFrequency: challengeType === "todo" ? challengeTodoFrequency : null,
        durationDays,
        startDate: challengeStartDate,
        endDate: challengeEndDate,
        status: "active",
        tasks: cleanTasks,
        updatedAt: new Date().toISOString(),
      };
      if (!editingChallengeId) {
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(doc(db, "challenges", newId), payload, {
        merge: !!editingChallengeId,
      });
      alert(
        editingChallengeId
          ? "Challenge updated successfully"
          : "Challenge saved successfully",
      );
      setEditingChallengeId(null);
      setChallengeTitle("");
      setChallengeDescription("");
      setChallengeType("streak");
      setChallengeStartDate("");
      setChallengeEndDate("");
      setChallengeDuration("");
      setChallengeTasks([]);
      setChallengeTodoFrequency("daily");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving challenge", error);
      alert("Failed to save challenge");
    }
    setSavingChallenge(false);
  };

  const handleEditChallenge = (c: any) => {
    setEditingChallengeId(c.id);
    setChallengeTitle(c.title || "");
    setChallengeDescription(c.description || "");
    setChallengeType(c.challengeType || "streak");
    setChallengeStartDate(c.startDate?.split("T")[0] || "");
    setChallengeEndDate(c.endDate?.split("T")[0] || "");
    setChallengeDuration(c.durationDays ? c.durationDays.toString() : "");
    setChallengeTasks(c.tasks || []);
    setChallengeTodoFrequency(c.todoFrequency || "daily");
    if (c.categoryId) setAdminCategoryScope(c.categoryId);
  };

  const deleteChallenge = async (id: string) => {
    try {
      await deleteDoc(doc(db, "challenges", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete challenge");
    }
  };

  return {
    challengeTitle, setChallengeTitle,
    challengeDescription, setChallengeDescription,
    challengeType, setChallengeType,
    challengeStartDate, setChallengeStartDate,
    challengeEndDate, setChallengeEndDate,
    challengeDuration, setChallengeDuration,
    challengeTasks, setChallengeTasks,
    challengeTodoFrequency, setChallengeTodoFrequency,
    editingChallengeId, setEditingChallengeId,
    savingChallenge,
    saveChallenge,
    handleEditChallenge,
    deleteChallenge
  };
}
