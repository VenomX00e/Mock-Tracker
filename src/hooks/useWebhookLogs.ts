import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { CloudinaryWebhookLog } from "../types";

export type LogFilter = "all" | "upload" | "delete";

export function useWebhookLogs() {
  const [logs, setLogs] = useState<CloudinaryWebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "cloudinary_webhook_logs"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedLogs: CloudinaryWebhookLog[] = [];
        querySnapshot.forEach((doc) => {
          fetchedLogs.push({
            id: doc.id,
            ...doc.data(),
          } as CloudinaryWebhookLog);
        });
        setLogs(fetchedLogs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching webhook logs:", err);
        setError(err.message || "Failed to fetch logs");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs
    .filter((log) => !log.isDeleted)
    .filter((log) => {
      if (filter === "all") return true;
      if (filter === "upload") return log.notificationType === "upload";
      if (filter === "delete")
        return log.notificationType?.startsWith("delete");
      return true;
    });

  const totalLogs = filteredLogs.length;
  // Compute exactly how many were successful (Cloudinary delete/folder webhooks usually have missing status so we defaulted to "success")
  const successCount = filteredLogs.filter(
    (log) =>
      log.status === "success" || !log.status?.toLowerCase().includes("fail"),
  ).length;
  const failedCount = totalLogs - successCount;
  const successRate = totalLogs > 0 ? (successCount / totalLogs) * 100 : 0;

  const clearLogs = async () => {
    try {
      const response = await fetch("/api/webhooks/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logIds: logs.map((log) => log.id),
        }),
      });
      if (!response.ok) {
        throw new Error("Server returned an error");
      }
    } catch (err) {
      console.warn(
        "Server-side deletion failed, falling back to client-side deletion due to potential ADC restrictions in preview environment.",
        err,
      );
      // Fallback: Client-side deletion using user credentials
      try {
        const q = collection(db, "cloudinary_webhook_logs");
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.set(
            doc.ref,
            {
              isDeleted: true,
            },
            { merge: true },
          );
        });
        await batch.commit();
      } catch (fallbackErr) {
        console.error("Client-side deletion also failed:", fallbackErr);
        throw fallbackErr;
      }
    }
  };

  return {
    logs: filteredLogs,
    loading,
    error,
    filter,
    setFilter,
    clearLogs,
    refreshLogs: () => {}, // No-op since it's real-time now
    metrics: {
      total: totalLogs,
      successCount,
      failedCount,
      successRate: Math.round(successRate * 10) / 10, // rounded to 1 decimal
    },
  };
}
