import { auth } from "./firebase";
import { getActiveApiKey } from "../utils/apiKeyManager";

export interface Citation {
  uri: string;
  title: string;
}

export interface Attachment {
  data: string;
  mimeType: string;
  pages?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  citations?: Citation[];
  attachments?: Attachment[];
}

export async function askLearningTutor(messages: ChatMessage[], useWebSearch: boolean = false, useCustomWebSearch: boolean = false, modelKey: string = 'gemini-3.1-flash-lite', chatMode: string = 'default', onMessageUpdate?: (text: string, citations?: Citation[]) => void): Promise<{ text: string, citations?: Citation[] }> {
  const customKey = getActiveApiKey();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/tutor-chat-stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, customApiKey: customKey || null, model: modelKey, useWebSearch, useCustomWebSearch, chatMode })
  });
  
  if (!response.ok) {
    let msg = 'Failed to communicate with AI Tutor';
    try {
      const err = await response.json();
      msg = err.error || msg;
    } catch (e) {
      // Ignored
    }
    if (msg.includes('No Gemini API key available') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
       throw new Error("Your personal Gemini API key is missing or invalid. Please configure it in the AI Tutor Settings.");
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      throw new Error("Quota exceeded for this model. Please check your Gemini API plan limits.");
    }
    if (msg.includes('NOT_FOUND') || msg.includes('404')) {
      throw new Error(`Model not found or not supported. Please select a different model. Details: ${msg}`);
    }
    throw new Error(msg);
  }

  if (!response.body) {
    throw new Error('No response body from server');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let finalCitations: Citation[] = [];
  let buffer = '';

  let isDone = false;
  while (!isDone) {
    const { value, done } = await reader.read();
    if (done) {
      isDone = true;
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr) {
          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.text) {
              fullText += data.text;
            }
            if (data.citations) {
              finalCitations = data.citations;
            }
            if (onMessageUpdate) {
              onMessageUpdate(fullText, finalCitations);
            }
          } catch (e) {
            // Ignore parse errors from partial chunks if any, although event stream blocks are mostly complete JSON objects.
          }
        }
      }
    }
  }

  return {
    text: fullText,
    citations: finalCitations.length > 0 ? finalCitations : undefined
  };
}
