import { MockScore } from "../types";
import { auth } from "./firebase";
import { getActiveApiKey } from "../utils/apiKeyManager";

export async function parseMockAnnouncementImage(images: { base64: string, mimeType: string }[], model: string = "gemini-3.1-flash-lite"): Promise<any> {
  const customKey = getActiveApiKey();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/extract-mock', {
    method: 'POST',
    headers,
    body: JSON.stringify({ images, customApiKey: customKey || null, model, featureKey: 'mock_score_extractor' })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || '';
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
       if (customKey) {
         throw new Error("Your personal Gemini API key is invalid. Please update it in the AI Tutor Settings or clear it to use the default app key.");
       } else {
         throw new Error("App Gemini API key is missing or invalid. Please check the backend configuration.");
       }
    }
    throw new Error(msg || 'Failed to extract mock details from server');
  }

  return await response.json();
}


export async function generateBadge(promptText: string): Promise<{ name: string, imageBase64: string }> {
  const customKey = getActiveApiKey();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/generate-badge', {
    method: 'POST',
    headers,
    body: JSON.stringify({ promptText, customApiKey: customKey || null, featureKey: 'general_chat' })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || '';
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
       if (customKey) {
         throw new Error("Your personal Gemini API key is invalid. Please update it in the AI Tutor Settings or clear it to use the default app key.");
       } else {
         throw new Error("App Gemini API key is missing or invalid. Please check the backend configuration.");
       }
    }
    throw new Error(msg || 'Failed to generate badge');
  }

  return await response.json();
}

function extractNum(val: any): number | null {
  if (val == null || val === '') return null;
  const str = String(val)
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-');
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (match) return Number(match[0]);
  return null;
}

export async function parseScorecardImage(images: { base64: string, mimeType: string }[], subjects?: { id: string, name: string }[], model: string = "gemini-3.1-flash-lite"): Promise<Partial<MockScore>> {
  const customKey = getActiveApiKey();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/extract-scorecard', {
    method: 'POST',
    headers,
    body: JSON.stringify({ images, customApiKey: customKey || null, subjects, model, featureKey: 'mock_score_extractor' })
  });
  
  if (!response.ok) {
    let err = {};
    let rawText = '';
    try { 
      rawText = await response.text();
      err = JSON.parse(rawText); 
    } catch (e) {}
    
    const msg = (err as any).error || response.statusText || (rawText ? rawText.substring(0, 50) : '') || 'Unknown Server Error';
    const status = response.status;
    
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
       if (customKey) {
         throw new Error("Your personal Gemini API key is invalid. Please update it in the AI Tutor Settings or clear it to use the default app key.");
       } else {
         throw new Error("App Gemini API key is missing or invalid. Please check the backend configuration.");
       }
    }
    
    if (status === 413) {
      throw new Error('Image too large. Please upload a smaller image.');
    } else if (status === 504) {
      throw new Error('Server timeout while analyzing image. Please try again later.');
    }

    throw new Error(`Error ${status}: ${msg}`);
  }

  const parsed = await response.json();
  
  const cleanStr = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val).trim();
    const lower = s.toLowerCase();
    if (lower === 'null' || lower === 'none' || lower === 'unknown' || lower === 'n/a' || lower === 'na' || lower === 'undefined') return "";
    return s;
  };

  const cleanMockName = (val: any) => {
    const s = cleanStr(val);
    if (!s) return "";
    const lower = s.toLowerCase();
    const fakeHeaderPatterns = [
      'section wise performance',
      'section-wise performance',
      'banking & insurance',
      'banking and insurance',
      'your overall performance',
      'overall performance',
      'rank & percentile analysis',
      'rank and percentile analysis',
      'toppers benchmark',
      'performance analysis',
      'test analysis',
      'scorecard',
      'search for courses',
    ];
    if (fakeHeaderPatterns.some(p => lower === p || lower.startsWith(p))) {
      return "";
    }
    return s;
  };

  const cleanedDate = cleanStr(parsed.date);
  const validDate = cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)
    ? cleanedDate.split('T')[0]
    : new Date().toISOString().split('T')[0];

  const detectedSubj = cleanStr(parsed.detectedSubject) || null;

  const rawScore = parsed.score != null ? extractNum(parsed.score) : null;
  const rawPercentile = parsed.percentile != null ? extractNum(parsed.percentile) : null;
  const rawPercentage = parsed.percentage != null ? extractNum(parsed.percentage) : null;
  const rawAccuracy = parsed.accuracy != null ? extractNum(parsed.accuracy) : null;

  const returnObj = {
    examType: cleanStr(parsed.examType),
    examRole: cleanStr(parsed.examRole),
    examPhase: cleanStr(parsed.examPhase),
    examScope: cleanStr(parsed.examScope),
    mockName: cleanMockName(parsed.mockName),
    platform: cleanStr(parsed.platform),
    detectedSubject: detectedSubj,
    date: validDate,
    score: rawScore,
    percentile: rawPercentile ?? rawPercentage,
    percentage: rawPercentage,
    accuracy: rawAccuracy,
  } as any;

  const subjectKeys = subjects && subjects.length > 0
    ? subjects.map(s => s.id)
    : ['quant', 'reasoning', 'english', 'ga', 'computer'];

  let populatedSectionCount = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let hasCorrectWrongCounts = false;

  subjectKeys.forEach(key => {
    if (parsed[key]) {
      let sCorrect = parsed[key]?.correct != null ? extractNum(parsed[key].correct) : null;
      const sWrong = parsed[key]?.wrong != null ? extractNum(parsed[key].wrong) : null;
      const sScore = parsed[key]?.score != null ? extractNum(parsed[key].score) : null;
      const sPct = parsed[key]?.percentile != null ? extractNum(parsed[key].percentile) : null;
      let sAcc = parsed[key]?.accuracy != null ? extractNum(parsed[key].accuracy) : null;

      if (sCorrect !== null && sWrong !== null && sCorrect >= 0 && sWrong >= 0) {
        // If a Lite model accidentally read 'Answered' (e.g. 32) instead of 'Correct' (24),
        // verify against the printed sectional accuracy (e.g. 75%):
        // (32 - 8) / 32 * 100 = 75%, whereas 32 / (32 + 8) * 100 = 80%.
        if (sAcc !== null && sCorrect > sWrong && sWrong > 0) {
          const accIfCorrect = (sCorrect / (sCorrect + sWrong)) * 100;
          const accIfAnswered = ((sCorrect - sWrong) / sCorrect) * 100;
          if (Math.abs(accIfAnswered - sAcc) + 1 < Math.abs(accIfCorrect - sAcc)) {
            sCorrect = sCorrect - sWrong;
          }
        }

        totalCorrect += sCorrect;
        totalWrong += sWrong;
        hasCorrectWrongCounts = true;
        if (sAcc === null && (sCorrect + sWrong) > 0) {
          sAcc = Number(((sCorrect / (sCorrect + sWrong)) * 100).toFixed(2));
        }
      }

      returnObj[key] = {
        score: sScore,
        percentile: sPct,
        accuracy: sAcc,
      };
      if (sScore !== null || sPct !== null || sAcc !== null) {
        populatedSectionCount++;
      }
    }
  });

  // Deterministic JavaScript calculation for overall accuracy when Correct & Wrong counts are present
  if (hasCorrectWrongCounts && (totalCorrect + totalWrong) > 0) {
    const exactOverallAccuracy = Number(((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(2));
    if (
      returnObj.accuracy === null ||
      returnObj.accuracy === returnObj.score ||
      returnObj.accuracy === returnObj.percentile ||
      Math.abs(returnObj.accuracy - exactOverallAccuracy) > 0.5
    ) {
      returnObj.accuracy = exactOverallAccuracy;
    }
  }

  // Deterministic Mains detection if GA or Computer has any metric (even 0) or 4+ sections are populated
  const hasGa = returnObj.ga && (returnObj.ga.score !== null || returnObj.ga.percentile !== null || returnObj.ga.accuracy !== null);
  const hasComputer = returnObj.computer && (returnObj.computer.score !== null || returnObj.computer.percentile !== null || returnObj.computer.accuracy !== null);
  if (hasGa || hasComputer || populatedSectionCount >= 4) {
    returnObj.examPhase = 'Mains';
  }

  // If this is a Sectional test and the model populated either overall or the detected subject, sync both
  if (returnObj.examScope?.toLowerCase() === 'sectional' && detectedSubj && subjectKeys.includes(detectedSubj)) {
    const subjObj = returnObj[detectedSubj] || { score: null, percentile: null, accuracy: null };
    if (subjObj.score == null && returnObj.score != null) subjObj.score = returnObj.score;
    if (subjObj.percentile == null && returnObj.percentile != null) subjObj.percentile = returnObj.percentile;
    if (subjObj.accuracy == null && returnObj.accuracy != null) subjObj.accuracy = returnObj.accuracy;
    if (returnObj.score == null && subjObj.score != null) returnObj.score = subjObj.score;
    if (returnObj.percentile == null && subjObj.percentile != null) returnObj.percentile = subjObj.percentile;
    if (returnObj.accuracy == null && subjObj.accuracy != null) returnObj.accuracy = subjObj.accuracy;
    returnObj[detectedSubj] = subjObj;
  }

  return returnObj;
}
