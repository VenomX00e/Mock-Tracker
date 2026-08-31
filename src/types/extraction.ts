import { ExtractedEditorialVocabulary } from '../services/aiService';

export type ExtractionSourceType = 'youtube' | 'pdf' | 'image' | 'text';

export interface ExtractionSourceMetadata {
  title?: string;
  url?: string;
  fileName?: string;
  channel?: string;
  durationSec?: number;
  wordCount?: number;
  extractedAt?: number;
}

export interface ExtractionSession {
  sourceType: ExtractionSourceType;
  sourceMetadata: ExtractionSourceMetadata;
  rawText: string; // The transcript or OCR result
  customInstructions: string;
  targetLevel?: string;
  wordCount?: number;
  nativeLanguage?: string;
  aiOutput: ExtractedEditorialVocabulary | null; // The JSON from Gemini
  currentStep: 1 | 2 | 3 | 4;
  lastUpdated: number; // For TTL caching (timestamp in ms)
}
