import React, { useState, useEffect } from "react";
import { Search, Trash2, ShieldAlert, Loader2, Save } from "lucide-react";
import { db, auth } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";

interface SearchLog {
  id: string;
  apiName: string;
  query: string;
  status: 'success' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export function AdminSearchLogsTab() {
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState<number | ''>('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchSettings();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/search-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      
      let data: any;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 403) {
          throw new Error(`PERMISSION_DENIED (Intercepted 403): ${text.substring(0, 50)}`);
        }
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.substring(0, 50)}`);
      }
      
      if (res.ok) {
        setLogs(data.logs || []);
      } else {
        const err = new Error(data.error || "Failed to fetch logs");
        (err as any).inMemoryLogs = data.inMemoryLogs;
        throw err;
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("PERMISSION_DENIED") || err.message.includes("ADC restrictions"))) {
        console.log("Backend blocked by ADC, falling back to client-side Firestore for fetchLogs");
        try {
          const { collection, getDocs, query, orderBy, limit } = await import("firebase/firestore");
          const logsRef = collection(db, "search_api_logs");
          const q = query(logsRef, orderBy("createdAt", "desc"), limit(100));
          const snapshot = await getDocs(q);
          const fetchedLogs = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
              data.createdAt = data.createdAt.toDate().toISOString();
            }
            return { id: doc.id, ...data } as SearchLog;
          });
          const combinedLogs = [...(err.inMemoryLogs || []), ...fetchedLogs];
          // Sort combined logs by createdAt
          combinedLogs.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setLogs(combinedLogs);
          return; // Success with fallback
        } catch (fallbackErr: any) {
          console.error("Client fallback failed:", fallbackErr);
          setError(fallbackErr.message || "Failed to fetch logs (client fallback)");
        }
      } else {
        console.error(err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, "system", "settings");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.searchLogAutoDeleteDays !== undefined) {
          setAutoDeleteDays(data.searchLogAutoDeleteDays);
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const saveSettings = async () => {
    const days = typeof autoDeleteDays === 'string' ? parseInt(autoDeleteDays) || 0 : autoDeleteDays;
    
    setSavingSettings(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/settings/search-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ searchLogAutoDeleteDays: days })
      });
      
      if (!res.ok) {
        let data: any = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else if (res.status === 403) {
          throw new Error("PERMISSION_DENIED (Intercepted 403)");
        }
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("PERMISSION_DENIED") || err.message.includes("ADC restrictions"))) {
        console.log("Backend blocked by ADC, falling back to client-side Firestore for saveSettings");
        try {
          const { doc, setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, "system", "settings"), { searchLogAutoDeleteDays: days }, { merge: true });
          return;
        } catch (fallbackErr: any) {
          console.error("Client fallback failed:", fallbackErr);
          alert(fallbackErr.message || "Failed to save settings (client fallback)");
        }
      } else {
        console.error(err);
        alert(err.message);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearAllLogs = async () => {
    setClearing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/search-logs", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      
      if (res.ok) {
        setLogs([]);
        setShowClearConfirm(false);
      } else {
        let data: any = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else if (res.status === 403) {
          throw new Error("PERMISSION_DENIED (Intercepted 403)");
        }
        throw new Error(data.error || "Failed to clear logs");
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("PERMISSION_DENIED") || err.message.includes("ADC restrictions"))) {
        console.log("Backend blocked by ADC, falling back to client-side Firestore for handleClearAllLogs");
        try {
          const { collection, getDocs, writeBatch } = await import("firebase/firestore");
          const logsRef = collection(db, "search_api_logs");
          const snapshot = await getDocs(logsRef);
          
          const batchSize = 500;
          const chunks = [];
          for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            chunks.push(snapshot.docs.slice(i, i + batchSize));
          }
          
          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
          setLogs([]);
          setShowClearConfirm(false);
          return;
        } catch (fallbackErr: any) {
          console.error("Client fallback failed:", fallbackErr);
          alert(fallbackErr.message || "Failed to clear logs (client fallback)");
        }
      } else {
        console.error(err);
        alert(err.message);
      }
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Search API Logs
        </h3>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              Auto delete in (days):
            </label>
            <input
              type="number"
              value={autoDeleteDays}
              onChange={(e) => setAutoDeleteDays(e.target.value)}
              className="w-20 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700/50 rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
            />
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              title="Save Setting"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
          
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400">No search logs found.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date/Time</th>
                    <th className="px-4 py-3 font-medium">API Used</th>
                    <th className="px-4 py-3 font-medium w-full">Query</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-medium">{log.apiName}</td>
                      <td className="px-4 py-3 whitespace-normal min-w-[200px] break-words">
                        {log.query}
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'success' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Clear All Logs</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              Are you sure you want to delete all search API logs? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllLogs}
                disabled={clearing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center"
              >
                {clearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {clearing ? "Clearing..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
