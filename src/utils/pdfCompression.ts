import axios from 'axios';
import { compressPdfIlovePdf } from './ilovePdfCompression';

export async function compressPdfWithFallback(
  file: File,
  apiKeys: string[],
  iloveApiKeys: string[] = [],
  level: 'low' | 'high' = 'high'
): Promise<File> {
  const hasApdfKeys = apiKeys && apiKeys.length > 0;
  const hasIloveKeys = iloveApiKeys && iloveApiKeys.length > 0;

  if (!hasApdfKeys && !hasIloveKeys) {
    throw new Error("No compression API keys available.");
  }

  const formData = new FormData();
  formData.append('file', file);
  // Optional: Add compression level to the API if supported
  // formData.append('image_quality', level === 'high' ? '50' : '80');

  let lastError: any = null;

  // 1. Try APDF keys first
  if (hasApdfKeys) {
    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[i];
      try {
        const response = await axios.post(
          'https://api.apdf.io/v1/pdf-compress',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'multipart/form-data',
            },
            responseType: 'blob' // Important: Expect a binary document response
          }
        );

        if (response.status === 200 && response.data) {
          const compressedBlob = response.data;
          return new File([compressedBlob], file.name, { type: file.type || 'application/pdf' });
        }
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        // Handle rate limiting (429) and forbidden (403 limits)
        if (status === 429 || status === 403 || status === 401) {
          console.warn(`[PDF Compression] apdf.io Key at index ${i} failed or hit limits, rotating to next key...`);
          continue;
        }
        
        console.error(`[PDF Compression] apdf.io error at index ${i}:`, error);
        if (i === apiKeys.length - 1 && !hasIloveKeys) {
          throw new Error(`APDF Compression failed with all keys (Last error: ${error.message})`);
        }
      }
    }
  }

  // 2. Try iLovePDF keys if APDF exhausted or none provided
  if (hasIloveKeys) {
    for (let i = 0; i < iloveApiKeys.length; i++) {
      const keyPair = iloveApiKeys[i];
      try {
        return await compressPdfIlovePdf(file, keyPair, level);
      } catch (error: any) {
        lastError = error;
        console.warn(`[PDF Compression] iLovePDF Key at index ${i} failed, rotating to next key...`, error.message);
        if (i === iloveApiKeys.length - 1) {
          throw new Error(`iLovePDF Compression failed with all keys (Last error: ${error.message})`);
        }
      }
    }
  }

  throw new Error(`All compression API keys are exhausted or failed. (Last error: ${lastError?.message || 'Unknown'})`);
}
