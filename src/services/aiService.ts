import { auth } from "./firebase";

export interface WordDetails {
  meaning?: string;
  mnemonic?: string;
}

export interface ExtractedVocabularyItem {
  word: string;
  pos?: string;
  meaning?: string;
  additional?: string;
  mnemonic?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

export interface ExtractedPhraseItem {
  text: string;
  meaning?: string;
  example?: string;
}

export interface ExtractedEditorialVocabulary {
  title?: string;
  topic?: string;
  rawMarkdown?: string;
  words: Array<{
    word: string;
    pos?: string;
    meaning?: string;
    synonyms?: string[];
    antonyms?: string[];
    example?: string;
    editorialContext?: string;
    mnemonic?: string;
    additional?: string;
    additionalGroups?: Array<{ theme: string; terms: string }>;
  }>;
  idiomsAndPhrases?: Array<{
    phrase: string;
    meaning?: string;
    example?: string;
  }>;
}

export interface ExtractedDocumentContent {
  vocabulary?: ExtractedVocabularyItem[];
  idioms?: ExtractedPhraseItem[];
  phrasalVerbs?: ExtractedPhraseItem[];
  oneWordSubstitutions?: ExtractedPhraseItem[];
  editorialSummary?: ExtractedEditorialVocabulary;
}

import { getActiveApiKey } from '../utils/apiKeyManager';

/**
 * Retrieve credentials from local storage.
 * @returns { customApiKey: string | null, model: string }
 */
function getAiSettings() {
  const customApiKey = getActiveApiKey();
  const model = localStorage.getItem('geminiModel_vocab') || localStorage.getItem('geminiModel') || 'gemini-3.1-flash-lite';
  return { customApiKey, model };
}

/**
 * Generates meaning and mnemonic for a specific word.
 */
export async function generateWordDetails(word: string): Promise<WordDetails> {
  const { customApiKey, model } = getAiSettings();

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/generate-word-details', {
    method: 'POST',
    headers,
    body: JSON.stringify({ word, customApiKey: customApiKey || null, model, featureKey: 'flashcards' })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate word details');
  }

  return response.json();
}

/**
 * Extracts vocabulary items and phrases from a base64 encoded document (image or pdf).
 */
export async function extractContentFromDocument(
  data: string | { base64Data: string; mimeType: string }[] | null, 
  mimeType?: string,
  textData?: string
): Promise<ExtractedDocumentContent> {
  const { customApiKey, model } = getAiSettings();

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload: any = { customApiKey: customApiKey || null, model, featureKey: 'flashcards' };
  if (typeof data === 'string') {
    payload.base64Data = data;
    payload.mimeType = mimeType;
  } else if (Array.isArray(data)) {
    payload.documents = data;
  }
  if (typeof textData === 'string') {
    payload.textData = textData;
  }

  const response = await fetch('/api/extract-document', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract document contents');
  }

  return response.json();
}

/**
 * Extracts structured editorial vocabulary, context, and idioms from any source text/transcript using Gemini.
 */
export async function extractVocabFromEditorialTranscript(
  textBodyOrTranscript: string,
  context?: { title?: string; channel?: string; duration?: number } | string,
  customInstructions?: string,
  options?: {
    targetLevel?: string;
    wordCount?: number;
    nativeLanguage?: string;
  }
): Promise<ExtractedEditorialVocabulary> {
  const { customApiKey, model } = getAiSettings();

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload: any = {
    customApiKey: customApiKey || null,
    model,
    featureKey: 'flashcards',
    textBody: textBodyOrTranscript,
    transcript: textBodyOrTranscript, // Backward compatibility
    context: typeof context === 'string' ? context : undefined,
    videoContext: typeof context === 'object' ? context : undefined, // Backward compatibility
    customInstructions,
    targetLevel: options?.targetLevel,
    wordCount: options?.wordCount,
    nativeLanguage: options?.nativeLanguage,
  };

  const response = await fetch('/api/extract-editorial-vocab', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract vocabulary from text');
  }

  return response.json();
}

/**
 * Extracts verbatim raw text / OCR from an uploaded document (image or pdf).
 */
export async function extractRawTextFromDocument(
  data: string | { base64Data: string; mimeType: string }[] | null,
  mimeType?: string
): Promise<string> {
  const { customApiKey, model } = getAiSettings();

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload: any = { customApiKey: customApiKey || null, model, featureKey: 'flashcards' };
  if (typeof data === 'string') {
    payload.base64Data = data;
    payload.mimeType = mimeType;
  } else if (Array.isArray(data)) {
    payload.documents = data;
  }

  const response = await fetch('/api/extract-raw-text', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract raw text from document');
  }

  const result = await response.json();
  return result.rawText || '';
}

