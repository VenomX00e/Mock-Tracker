import { useState, useEffect } from "react";
import { setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useAdminNotices(
  adminCategoryScope: string | null,
  getPrefix: (categoryId: string | null) => string,
  fetchAnnouncement: () => Promise<void>,
  editNoticeData: any,
  initialTab: string,
  isOpen: boolean,
  setAdminCategoryScope: (id: string | null) => void
) {
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeDescription, setNoticeDescription] = useState("");
  const [noticeLink, setNoticeLink] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeUrgency, setNoticeUrgency] = useState("");
  const [noticeTags, setNoticeTags] = useState("");
  const [noticeEditableBy, setNoticeEditableBy] = useState<"admin" | "users">("admin");
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  useEffect(() => {
    if (editNoticeData && initialTab === "notice") {
      setEditingNoticeId(editNoticeData.id);
      setNoticeTitle(editNoticeData.title || "");
      setNoticeDescription(editNoticeData.description || "");
      setNoticeLink(editNoticeData.link || "");
      setNoticeDate(editNoticeData.date || "");
      setNoticeUrgency(editNoticeData.urgency || "");
      setNoticeTags(
        Array.isArray(editNoticeData.tags)
          ? editNoticeData.tags.join(", ")
          : editNoticeData.tags || ""
      );
      setNoticeEditableBy(editNoticeData.editableBy || "admin");
      if (editNoticeData.categoryId) {
        setAdminCategoryScope(editNoticeData.categoryId);
      }
    }
  }, [initialTab, editNoticeData, isOpen, setAdminCategoryScope]);

  const saveNotice = async () => {
    setSavingAnnouncement(true);
    try {
      if (!noticeTitle) {
        alert("Notice title is required");
        setSavingAnnouncement(false);
        return;
      }
      const newId =
        editingNoticeId ||
        (adminCategoryScope
          ? `${getPrefix(adminCategoryScope)}_NOTICE_${Date.now()}`
          : `notice_${Date.now()}`);
      await setDoc(
        doc(db, "system", newId),
        {
          type: "notice",
          title: noticeTitle,
          description: noticeDescription,
          link: noticeLink,
          date: noticeDate,
          categoryId: adminCategoryScope || null,
          urgency: noticeUrgency,
          tags: noticeTags
            ? noticeTags.split(",").map((t) => t.trim())
            : [],
          editableBy: noticeEditableBy,
          updatedAt: new Date().toISOString(),
        },
        { merge: !!editingNoticeId }
      );
      alert(
        editingNoticeId
          ? "Notice updated successfully"
          : "Notice saved successfully"
      );
      setEditingNoticeId(null);
      setNoticeTitle("");
      setNoticeDescription("");
      setNoticeLink("");
      setNoticeDate("");
      setNoticeUrgency("");
      setNoticeTags("");
      setNoticeEditableBy("admin");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving notice", error);
      alert("Failed to save notice");
    }
    setSavingAnnouncement(false);
  };

  const handleEditNotice = (n: any) => {
    setEditingNoticeId(n.id);
    setNoticeTitle(n.title || "");
    setNoticeDescription(n.description || "");
    setNoticeLink(n.link || "");
    setNoticeDate(n.date || "");
    setNoticeUrgency(n.urgency || "info");
    setNoticeTags(Array.isArray(n.tags) ? n.tags.join(", ") : "");
    setNoticeEditableBy(n.editableBy || "admin");
    if (n.categoryId) setAdminCategoryScope(n.categoryId);
  };

  const deleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, "system", id));
      fetchAnnouncement();
    } catch (e) {
      console.error(e);
      alert("Failed to delete notice");
    }
  };

  return {
    noticeTitle, setNoticeTitle,
    noticeDescription, setNoticeDescription,
    noticeLink, setNoticeLink,
    noticeDate, setNoticeDate,
    noticeUrgency, setNoticeUrgency,
    noticeTags, setNoticeTags,
    noticeEditableBy, setNoticeEditableBy,
    editingNoticeId, setEditingNoticeId,
    savingNotice: savingAnnouncement,
    saveNotice,
    handleEditNotice,
    deleteNotice
  };
}
