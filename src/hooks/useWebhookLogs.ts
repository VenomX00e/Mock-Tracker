import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CloudinaryWebhookLog } from '../types';

export function useWebhookLogs() {
  const [logs, setLogs] = useState<CloudinaryWebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'cloudinary_webhook_logs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedLogs: CloudinaryWebhookLog[] = [];
      querySnapshot.forEach((doc) => {
        fetchedLogs.push({ id: doc.id, ...doc.data() } as CloudinaryWebhookLog);
      });
      setLogs(fetchedLogs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Error fetching webhook logs:', err);
      setError(err.message || 'Failed to fetch logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalLogs = logs.length;
  // Compute exactly how many were successful (Cloudinary delete/folder webhooks usually have missing status so we defaulted to "success")
  const successCount = logs.filter(log => log.status === 'success' || !log.status?.toLowerCase().includes('fail')).length;
  const failedCount = totalLogs - successCount;
  const successRate = totalLogs > 0 ? (successCount / totalLogs) * 100 : 0;

  return {
    logs,
    loading,
    error,
    refreshLogs: () => {}, // No-op since it's real-time now
    metrics: {
      total: totalLogs,
      successCount,
      failedCount,
      successRate: Math.round(successRate * 10) / 10 // rounded to 1 decimal
    }
  };
}
