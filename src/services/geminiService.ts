import { MockScore } from "../types";

export async function parseMockAnnouncementImage(images: { base64: string, mimeType: string }[]): Promise<any> {
  const customKey = localStorage.getItem('geminiApiKey');
  const response = await fetch('/api/extract-mock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function parseScorecardImage(images: { base64: string, mimeType: string }[]): Promise<Partial<MockScore>> {
  const customKey = localStorage.getItem('geminiApiKey');
  const response = await fetch('/api/extract-scorecard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, customApiKey: customKey || null })
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

  return {
    examType: cleanStr(parsed.examType),
    examRole: cleanStr(parsed.examRole),
    examPhase: cleanStr(parsed.examPhase),
    examScope: cleanStr(parsed.examScope),
    mockName: cleanStr(parsed.mockName),
    platform: cleanStr(parsed.platform),
    detectedSubject: parsed.detectedSubject || null,
    date: parsed.date || new Date().toISOString().split('T')[0],
    score: parsed.score != null ? Number(parsed.score) : null,
    percentile: parsed.percentile != null ? Number(parsed.percentile) : null,
    percentage: parsed.percentage != null ? Number(parsed.percentage) : null,
    accuracy: parsed.accuracy != null ? Number(parsed.accuracy) : null,
    quant: {
      score: parsed.quant?.score != null ? Number(parsed.quant.score) : null,
      percentile: parsed.quant?.percentile != null ? Number(parsed.quant.percentile) : null,
      accuracy: parsed.quant?.accuracy != null ? Number(parsed.quant.accuracy) : null,
    },
    reasoning: {
      score: parsed.reasoning?.score != null ? Number(parsed.reasoning.score) : null,
      percentile: parsed.reasoning?.percentile != null ? Number(parsed.reasoning.percentile) : null,
      accuracy: parsed.reasoning?.accuracy != null ? Number(parsed.reasoning.accuracy) : null,
    },
    english: {
      score: parsed.english?.score != null ? Number(parsed.english.score) : null,
      percentile: parsed.english?.percentile != null ? Number(parsed.english.percentile) : null,
      accuracy: parsed.english?.accuracy != null ? Number(parsed.english.accuracy) : null,
    },
    ga: {
      score: parsed.ga?.score != null ? Number(parsed.ga.score) : null,
      percentile: parsed.ga?.percentile != null ? Number(parsed.ga.percentile) : null,
      accuracy: parsed.ga?.accuracy != null ? Number(parsed.ga.accuracy) : null,
    }
  } as any;
}
