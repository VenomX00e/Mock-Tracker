import { auth } from "../services/firebase";
import { getActiveApiKey } from "../utils/apiKeyManager";
import type { QuizConfig, AIQuizResponse } from "../types";

function getAiSettings() {
  const customApiKey = getActiveApiKey();
  const model =
    localStorage.getItem("geminiModel_vocab") ||
    localStorage.getItem("geminiModel") ||
    "gemini-2.5-flash";
  return { customApiKey, model };
}

function sampleVocabularyWords<T>(words: T[], maxCount = 20): T[] {
  if (!words || words.length <= maxCount) return [...words];
  // Randomly sample up to maxCount items to provide diverse high-quality quizzes
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxCount);
}

export async function generateAIQuiz(config: QuizConfig): Promise<AIQuizResponse> {
  const { customApiKey, model } = getAiSettings();
  const token = await auth.currentUser?.getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Sample 15-20 words maximum if list is large (e.g. 100 words) to avoid token limits
  const sampledWords = sampleVocabularyWords(config.sourceWords, 20);

  const payload = {
    customApiKey: customApiKey || null,
    model,
    featureKey: "vocab_quiz",
    config: {
      format: config.format,
      theme: config.theme,
      scope: config.scope,
      // Pass the essential fields of the sampled words (max 20)
      words: sampledWords.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        pos: w.pos || "",
        synonyms: w.synonyms || [],
        antonyms: w.antonyms || [],
        example: w.example || "",
      })),
    },
  };

  let response = await fetch("/api/generate-quiz", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    // Fallback in case of router caching or alternate route mapping
    response = await fetch("/api/generate-vocab-quiz", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || "Failed to generate AI Quiz. Please try again.");
  }

  const data: AIQuizResponse = await response.json();
  if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error("AI did not generate valid quiz questions. Please try with different settings.");
  }

  return data;
}
