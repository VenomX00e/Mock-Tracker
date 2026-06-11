import { useState, useCallback } from 'react';

export function useFileDownloader(
  fileId: string,
  fileMeta: { url: string; sizeBytes?: number; mimeType?: string },
  cachedUrl: string | undefined,
  setBlobUrl: (id: string, url: string) => void
) {
  const [downloadState, setDownloadState] = useState<'IDLE' | 'DOWNLOADING' | 'READY'>(
    cachedUrl ? 'READY' : 'IDLE'
  );
  const [progress, setProgress] = useState(0);

  const downloadFile = useCallback(async () => {
    if (downloadState === 'READY' || downloadState === 'DOWNLOADING') {
      return;
    }

    setDownloadState('DOWNLOADING');
    setProgress(0);

    try {
      const response = await fetch(fileMeta.url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : (fileMeta.sizeBytes || 0);
      
      let loaded = 0;
      const reader = response.body?.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            
            loaded += value.byteLength;
            if (total > 0) {
              setProgress(Math.round((loaded / total) * 100));
            }
            controller.enqueue(value);
          }
          controller.close();
          reader?.releaseLock();
        }
      });

      const newResponse = new Response(stream);
      const rawBlob = await newResponse.blob();
      
      // Explicitly inject the correct MIME type based on the Firestore metadata
      let mimeType = fileMeta.mimeType || 'application/pdf';
      
      // Normalize Cloudinary's raw format strings to standard MIME types
      if (mimeType === 'pdf') mimeType = 'application/pdf';
      else if (mimeType === 'zip') mimeType = 'application/zip';
      else if (mimeType === 'png') mimeType = 'image/png';
      else if (mimeType === 'jpg' || mimeType === 'jpeg') mimeType = 'image/jpeg';
      else if (mimeType === 'html') mimeType = 'text/html';
      else if (mimeType === 'csv') mimeType = 'text/csv';
      
      const typedBlob = new Blob([rawBlob], { type: mimeType });
      
      const url = URL.createObjectURL(typedBlob);
      
      setBlobUrl(fileId, url);
      setDownloadState('READY');
    } catch (error) {
      console.error("Download failed, opening directly", error);
      // Fallback to direct download/open in new tab if CORS or other fetch issue occurs
      window.open(fileMeta.url, '_blank');
      setDownloadState('IDLE');
      setProgress(0);
    }
  }, [downloadState, fileMeta.url, fileMeta.sizeBytes, fileMeta.mimeType, fileId, setBlobUrl]);

  return { downloadState, progress, downloadFile };
}
