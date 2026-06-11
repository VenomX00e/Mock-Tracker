import { useState } from 'react';
import { auth } from '../services/firebase';

interface UploadOptions {
  file: File | Blob;
  folderPath: string;
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  fileName?: string;
  onProgress?: (progress: number) => void;
}

export function useCloudinary() {
  const [isUploading, setIsUploading] = useState(false);

  const getAuthToken = async () => {
    return await auth.currentUser?.getIdToken();
  };

  const sanitizeFolderPath = (path: string) => {
    if (!path) return '';
    // Strip everything not alphanumeric, underscore, hyphen or slash. Remove leading/trailing/multiple slashes.
    return path.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  };

  const getOriginUrl = () => {
    return window.location.origin;
  };

  const createFolder = async (folderPath: string) => {
    const safeFolderPath = sanitizeFolderPath(folderPath);
    const idToken = await getAuthToken();
    const res = await fetch('/api/cloudinary/createFolder', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify({ folderPath: safeFolderPath })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create folder on Cloudinary");
    }
    return await res.json();
  };

  const uploadFile = async ({
    file,
    folderPath,
    resourceType,
    fileName,
    onProgress
  }: UploadOptions) => {
    setIsUploading(true);
    try {
      const idToken = await getAuthToken();
      const safeFolderPath = sanitizeFolderPath(folderPath);
      const originUrl = getOriginUrl();
      const webhookUrl = `${originUrl}/api/cloudinary/webhook`;
      
      const sigParams: Record<string, any> = {
        folder: safeFolderPath,
        notification_url: webhookUrl
      };
      
      let safePublicId: string | undefined = undefined;

      if (fileName) {
        // Strip trailing extensions and replace spaces/special-chars with underscores
        safePublicId = fileName.trim().split('.').slice(0, -1).join('.') || fileName.trim();
        safePublicId = safePublicId.replace(/[^a-zA-Z0-9_-]/g, '_');
        sigParams.public_id = safePublicId;
      }
      
      // Get Signature
      const sigResponse = await fetch('/api/cloudinary/generateSignature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          paramsToSign: sigParams
        })
      });

      if (!sigResponse.ok) {
        throw new Error("Failed to get upload signature");
      }

      const { signature, timestamp, apiKey, cloudName } = await sigResponse.json();

      if (!cloudName || !apiKey) {
        throw new Error("Server Cloudinary settings are missing");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", safeFolderPath);
      formData.append("notification_url", webhookUrl);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);

      if (safePublicId) {
        formData.append("public_id", safePublicId);
      }

      return await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);

        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentCompleted = Math.round((e.loaded * 100) / e.total);
              onProgress(percentCompleted);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed due to network error'));
        
        xhr.send(formData);
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteResource = async (
    resourceType: 'file' | 'folder',
    opts: { public_id?: string; folderPath?: string; cloudResourceType?: string }
  ) => {
    const safeOpts = { ...opts };
    if (safeOpts.folderPath) {
      safeOpts.folderPath = sanitizeFolderPath(safeOpts.folderPath);
    }

    const idToken = await getAuthToken();
    const res = await fetch('/api/cloudinary/deleteResource', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        resourceType,
        ...safeOpts
      })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `Failed to delete ${resourceType}`);
    }
    
    return await res.json();
  };

  return {
    isUploading,
    createFolder,
    uploadFile,
    deleteResource
  };
}
