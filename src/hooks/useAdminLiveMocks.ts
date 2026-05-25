import { useState } from "react";
import { setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getErrorMessage } from "../lib/errorUtils";
import { parseMockAnnouncementImage } from "../services/geminiService";
import { EXAMS, ROLES, PHASES, PLATFORMS } from "../lib/constants";

export function useAdminLiveMocks(
  adminCategoryScope: string | null,
  getPrefix: (categoryId: string | null) => string,
  fetchAnnouncement: () => Promise<void>
) {
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [editingLiveMockId, setEditingLiveMockId] = useState<string | null>(null);
  const [liveMockData, setLiveMockData] = useState({
    examType: "",
    examRole: "",
    examPhase: "Prelims",
    examScope: "Full",
    mockName: "",
    platform: "",
    date: "",
  });
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const saveLiveMock = async () => {
    setSavingAnnouncement(true);
    try {
      if (!liveMockData.mockName || !liveMockData.examType) {
        alert("Mock Name and Exam Type are required.");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingLiveMockId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_LIVEMOCK_${Date.now()}`
          : `liveMock_${Date.now()}`);
      await setDoc(
        doc(db, "system", newId),
        {
          type: "liveMock",
          ...liveMockData,
          categoryId: adminCategoryScope || null,
          title: `Live: ${liveMockData.mockName}`,
          description: `Join the community in taking the ${liveMockData.examType} ${liveMockData.examRole} ${liveMockData.examPhase} mock on ${liveMockData.platform || "any platform"}.`,
          link: "",
          updatedAt: new Date().toISOString(),
        },
        { merge: !!editingLiveMockId },
      );
      alert(
        editingLiveMockId
          ? "Live Mock updated successfully"
          : "Live Mock saved successfully",
      );
      setEditingLiveMockId(null);
      setLiveMockData({
        examType: "",
        examRole: "",
        examPhase: "Prelims",
        examScope: "Full",
        mockName: "",
        platform: "",
        date: "",
      });
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving live mock", error);
      alert("Failed to save live mock");
    }
    setSavingAnnouncement(false);
  };

  const handleEditLiveMock = (m: any, setAdminCategoryScope: (id: string | null) => void) => {
    setEditingLiveMockId(m.id);
    if (!EXAMS.includes(m.examType)) setIsCustomExam(true);
    else setIsCustomExam(false);
    if (!ROLES.includes(m.examRole)) setIsCustomRole(true);
    else setIsCustomRole(false);
    if (!PHASES.includes(m.examPhase)) setIsCustomPhase(true);
    else setIsCustomPhase(false);
    if (!PLATFORMS.includes(m.platform)) setIsCustomPlatform(true);
    else setIsCustomPlatform(false);

    setLiveMockData({
      examType: m.examType || "",
      examRole: m.examRole || "",
      examPhase: m.examPhase || "Prelims",
      examScope: m.examScope || "Full",
      mockName: m.mockName || "",
      platform: m.platform || "",
      date: m.date || "",
    });
    if (m.categoryId) setAdminCategoryScope(m.categoryId);
  };

  const deleteLiveMock = async (id: string) => {
    try {
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete live mock");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessingImage(true);

    try {
      const imagesPayload: { base64: string; mimeType: string }[] = [];
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result?.toString().split(",")[1];
            if (result) resolve(result);
            else reject(new Error("Failed to read file"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imagesPayload.push({ base64: base64Data, mimeType: file.type });
      }

      if (imagesPayload.length > 0) {
        const extractedData = await parseMockAnnouncementImage(imagesPayload);

        if (extractedData.examType && !EXAMS.includes(extractedData.examType))
          setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole))
          setIsCustomRole(true);
        if (
          extractedData.examPhase &&
          !PHASES.includes(extractedData.examPhase)
        )
          setIsCustomPhase(true);
        if (
          extractedData.platform &&
          !PLATFORMS.includes(extractedData.platform)
        )
          setIsCustomPlatform(true);

        setLiveMockData((prev: any) => ({
          ...prev,
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope,
        }));
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsProcessingImage(false);
      e.target.value = "";
    }
  };

  return {
    isCustomExam, setIsCustomExam,
    isCustomRole, setIsCustomRole,
    isCustomPhase, setIsCustomPhase,
    isCustomPlatform, setIsCustomPlatform,
    editingLiveMockId, setEditingLiveMockId,
    liveMockData, setLiveMockData,
    isProcessingImage,
    savingAnnouncement,
    saveLiveMock,
    handleEditLiveMock,
    deleteLiveMock,
    handleFileChange
  };
}
