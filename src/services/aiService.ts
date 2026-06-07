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

export interface ExtractedDocumentContent {
  vocabulary?: ExtractedVocabularyItem[];
  idioms?: ExtractedPhraseItem[];
  phrasalVerbs?: ExtractedPhraseItem[];
  oneWordSubstitutions?: ExtractedPhraseItem[];
}

import { getActiveApiKey } from '../utils/apiKeyManager';

/**
 * Retrieve credentials from local storage.
 * @returns { customApiKey: string | null, model: string }
 */
function getAiSettings() {
  const customApiKey = getActiveApiKey();
  const model = localStorage.getItem('geminiModel') || 'gemini-3.1-flash-lite';
  return { customApiKey, model };
}

/**
 * Generates meaning and mnemonic for a specific word.
 */
export async function generateWordDetails(word: string): Promise<WordDetails> {
  const { customApiKey, model } = getAiSettings();

  if (!customApiKey) {
    throw new Error("Your personal Gemini API key is missing. Please configure it in Settings.");
  }

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/generate-word-details', {
    method: 'POST',
    headers,
    body: JSON.stringify({ word, customApiKey, model })
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

  if (!customApiKey) {
    throw new Error("Your personal Gemini API key is missing. Please configure it in Settings.");
  }

  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload: any = { customApiKey, model };
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
