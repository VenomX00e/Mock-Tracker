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
    throw new Error(err.error || 'Failed to extract mock details from server');
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
    throw new Error(err.error || 'Failed to extract scorecard details from server');
  }

  const parsed = await response.json();
  
  return {
      examType: parsed.examType || "Unknown Exam",
      examRole: parsed.examRole || "",
      examPhase: parsed.examPhase || "",
      examScope: parsed.examScope || "",
      mockName: parsed.mockName || "Unknown Mock",
      date: parsed.date || new Date().toISOString().split('T')[0],
      score: parsed.score != null ? Number(parsed.score) : null,
      percentile: parsed.percentile != null ? Number(parsed.percentile) : null,
      percentage: parsed.percentage != null ? Number(parsed.percentage) : null,
      quant: {
        score: parsed.quant?.score != null ? Number(parsed.quant.score) : null,
        percentile: parsed.quant?.percentile != null ? Number(parsed.quant.percentile) : null,
      },
      reasoning: {
        score: parsed.reasoning?.score != null ? Number(parsed.reasoning.score) : null,
        percentile: parsed.reasoning?.percentile != null ? Number(parsed.reasoning.percentile) : null,
      },
      english: {
        score: parsed.english?.score != null ? Number(parsed.english.score) : null,
        percentile: parsed.english?.percentile != null ? Number(parsed.english.percentile) : null,
      },
      ga: {
        score: parsed.ga?.score != null ? Number(parsed.ga.score) : null,
        percentile: parsed.ga?.percentile != null ? Number(parsed.ga.percentile) : null,
      }
    };
}
