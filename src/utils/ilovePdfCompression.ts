// src/utils/ilovePdfCompression.ts
import axios from 'axios';

// Polling delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function compressPdfIlovePdf(file: File, keyPair: string, level: 'low' | 'high'): Promise<File> {
  const [publicKey] = keyPair.split(':');
  if (!publicKey) throw new Error("Invalid iLovePDF key pair");

  // 1. Auth
  const authRes = await axios.post<{token: string}>('https://api.ilovepdf.com/v1/auth', {
    public_key: publicKey
  });
  const token = authRes.data.token;
  if (!token) throw new Error("Failed to get auth token from iLovePDF");

  const headers = { Authorization: `Bearer ${token}` };

  // 2. Start
  const startRes = await axios.get<{server: string; task: string}>('https://api.ilovepdf.com/v1/start/compress', { headers });
  const serverUrl = `https://${startRes.data.server}`;
  const taskId = startRes.data.task;

  // 3. Upload
  const formData = new FormData();
  formData.append('task', taskId);
  formData.append('file', file);
  
  const uploadRes = await axios.post<{server_filename: string}>(`${serverUrl}/v1/upload`, formData, { headers });
  const serverFilename = uploadRes.data.server_filename;

  // 4. Process
  const processData = {
    task: taskId,
    tool: 'compress',
    files: [{
      server_filename: serverFilename,
      filename: file.name || 'document.pdf'
    }],
    optimization_level: level === 'high' ? 'extreme' : 'recommended'
  };

  await axios.post(`${serverUrl}/v1/process`, processData, { headers });

  // Poll for completion (Wait until status is TaskSuccess)
  let attempts = 0;
  while (attempts < 30) {
    const statusRes = await axios.get<{status: string}>(`${serverUrl}/v1/task/${taskId}`, { headers });
    const status = statusRes.data.status;
    
    if (status === 'TaskSuccess') {
      break;
    } else if (status === 'TaskError') {
      throw new Error("iLovePDF processing failed");
    }
    
    await delay(1500);
    attempts++;
  }

  // 5. Download
  const downloadRes = await axios.get(`${serverUrl}/v1/download/${taskId}`, {
    headers,
    responseType: 'blob'
  });

  return new File([downloadRes.data], file.name || 'compressed.pdf', { type: file.type || 'application/pdf' });
}
