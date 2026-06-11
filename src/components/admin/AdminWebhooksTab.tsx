import React from "react";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Trash2, Server } from "lucide-react";
import { useWebhookLogs } from "../../hooks/useWebhookLogs";
import { CloudinaryWebhookLog } from "../../types";

export function AdminWebhooksTab() {
  const { logs, loading, error, metrics, refreshLogs } = useWebhookLogs();

  return (
    <div className="p-4 md:p-6 lg:p-10 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
          <Server className="w-6 h-6 text-indigo-500" />
          Cloudinary Webhook Logs
        </h2>
        <button
          onClick={refreshLogs}
          disabled={loading}
          className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50">
          Error: {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Total Deletions (Logged)
              </div>
              <div className="mt-4 text-3xl font-bold text-slate-800 dark:text-slate-100">
                {metrics.total}
              </div>
            </div>
            
            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                Successful Removes
              </div>
              <div className="mt-4 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.successCount}
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between items-start">
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Webhook Success Rate
              </div>
              <div className="mt-4 text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-baseline gap-2">
                {metrics.successRate}%
                {metrics.successRate >= 99 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Recent Events
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Timestamp</th>
                    <th className="p-4 font-medium">Target ID</th>
                    <th className="p-4 font-medium">Action</th>
                    <th className="p-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-slate-400">
                        Loading logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-slate-400">
                        No webhook events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log: CloudinaryWebhookLog) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "Just now"}
                        </td>
                        <td className="p-4 text-sm font-mono text-slate-800 dark:text-slate-300 break-all max-w-[200px]">
                          {log.publicId || "N/A"}
                        </td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {log.notificationType === 'delete' || log.notificationType === 'delete_folder' ? (
                              <Trash2 className="w-3.5 h-3.5" />
                            ) : null}
                            {log.notificationType}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-center">
                          {log.status === "success" || !log.status.toLowerCase().includes('fail') ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium text-xs">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
