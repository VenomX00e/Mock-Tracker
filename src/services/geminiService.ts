import { MockScore } from "../types";
import { auth } from "./firebase";

export async function parseMockAnnouncementImage(images: { base64: string, mimeType: string }[]): Promise<any> {
  const customKey = localStorage.getItem('geminiApiKey');
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/extract-mock', {
    method: 'POST',
    headers,
    body: JSON.stringify({ images, customApiKey: customKey || null })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || '';
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID')) {
       throw new Error("API Key missing or invalid. Click the app logo in the top left to configure your free key.");
    }
    throw new Error(msg || 'Failed to extract mock details from server');
  }

  return await response.json();
}


function extractNum(val: any): number | null {
  if (val == null || val === '') return null;
  const str = String(val).trim();
  const match = str.match(/(?:\b|^)-?\d+(?:\.\d+)?/);
  if (match) return Number(match[0]);
  return null;
}

export async function parseScorecardImage(images: { base64: string, mimeType: string }[], subjects?: { id: string, name: string }[]): Promise<Partial<MockScore>> {
  const customKey = localStorage.getItem('geminiApiKey');
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/extract-scorecard', {
    method: 'POST',
    headers,
    body: JSON.stringify({ images, customApiKey: customKey || null, subjects })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || '';
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID')) {
       throw new Error("API Key missing or invalid. Click the app logo in the top left to configure your free key.");
    }
    throw new Error(msg || 'Failed to extract scorecard details from server');
  }

  const parsed = await response.json();
  
  const cleanStr = (val: any) => {
    if (val === null || val === undefined || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'none' || String(val).toLowerCase() === 'unknown') return "";
    return String(val);
  };

  const returnObj = {
    examType: cleanStr(parsed.examType),
    examRole: cleanStr(parsed.examRole),
    examPhase: cleanStr(parsed.examPhase),
    examScope: cleanStr(parsed.examScope),
    mockName: cleanStr(parsed.mockName),
    platform: cleanStr(parsed.platform),
    detectedSubject: parsed.detectedSubject || null,
    date: parsed.date || new Date().toISOString().split('T')[0],
    score: parsed.score != null ? extractNum(parsed.score) : null,
    percentile: parsed.percentile != null ? extractNum(parsed.percentile) : null,
    percentage: parsed.percentage != null ? extractNum(parsed.percentage) : null,
    accuracy: parsed.accuracy != null ? extractNum(parsed.accuracy) : null,
  } as any;

  if (subjects) {
    subjects.forEach(s => {
      if (parsed[s.id]) {
        (returnObj as any)[s.id] = {
          score: parsed[s.id]?.score != null ? extractNum(parsed[s.id].score) : null,
          percentile: parsed[s.id]?.percentile != null ? extractNum(parsed[s.id].percentile) : null,
          accuracy: parsed[s.id]?.accuracy != null ? extractNum(parsed[s.id].accuracy) : null,
        }
      }
    });
  } else {
    ['quant', 'reasoning', 'english', 'ga'].forEach(s => {
      if (parsed[s]) {
        (returnObj as any)[s] = {
          score: parsed[s]?.score != null ? extractNum(parsed[s].score) : null,
          percentile: parsed[s]?.percentile != null ? extractNum(parsed[s].percentile) : null,
          accuracy: parsed[s]?.accuracy != null ? extractNum(parsed[s].accuracy) : null,
        }
      }
    });
  }
  return returnObj;
}
