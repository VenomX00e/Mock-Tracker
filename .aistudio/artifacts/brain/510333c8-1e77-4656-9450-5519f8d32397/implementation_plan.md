# AI Model Routing, Descending Fallback, Per-Message Model Tag & Latency Optimization Plan

## 1. Objective & Scope

1. **Preserve Active Models & Remove Discontinued Checkpoints (`3.5 Flash` & `3.7 Flash`):**
   - Stop `normalizeGeminiModel()` from silently downgrading valid `3.x` models (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview`) down to `2.5` models.
   - Remove discontinued `3.5 Flash` (`gemini-3.5-flash`) and `3.7 Flash` (`gemini-3.7-flash`) from all UI dropdown selectors while keeping `3.5 Flash Lite` and all other valid checkpoints intact.

2. **Descending Model Fallback Chain Across All AI Features:**
   - Primary requests always execute directly on the user's selected model (so no fallback occurs under normal operation).
   - If the primary model throws a rate-limit (`429`), quota, overload (`503`), or availability (`404`) error, step down in **descending order** within the same model tier across all AI features (`backendHelpers.ts`, `jarvisRoutes.ts`, and `extractionRoutes.ts`):
     - **Flash Tier:** `gemini-3.8-flash` (3.8 Flash) ➔ `gemini-3.6-flash` (3.6 Flash) ➔ `gemini-3-flash-preview` (3.0 Flash) ➔ `gemini-2.5-flash` (2.5 Flash)
     - **Flash Lite Tier:** `gemini-3.5-flash-lite` (3.5 Flash Lite) ➔ `gemini-3.1-flash-lite` (3.1 Flash Lite) ➔ `gemini-2.5-flash-lite` (2.5 Flash Lite)
     - **Pro Tier:** `gemini-3.1-pro-preview` (3.1 Pro) ➔ `gemini-2.5-pro` (2.5 Pro) ➔ `gemini-3.8-flash` (3.8 Flash)

3. **Subtle Short Model Label Inside Each AI Tutor Message:**
   - Return the actual `modelUsed` (whether primary or fallback) in the `/api/tutor-chat-stream` SSE stream and `/api/learning-chat` response.
   - Render the short model name (`3.8 Flash`, `3.6 Flash`, `3.5 Flash Lite`, `3.1 Flash Lite`, etc.—without `"Gemini"`) in a tiny, low-contrast label (`text-[9px] text-slate-300 dark:text-slate-600`) at the bottom-right corner of each AI reply bubble so it is never eye-catching or distracting.

4. **Speed & Responsiveness Optimizations:**
   - **60-Second Server Memory Cache for `system_config/global_gemini`:** Eliminate the ~500–1,000ms sequential Admin SDK failure + Firestore REST round-trip that currently runs before every single AI request in `resolveGeminiProxyConfig()`.
   - **Local Streaming State Buffer in `LearningAIAssistant.tsx`:** Stream incoming SSE text chunks into lightweight component state (`streamingReply`) and commit to `useChatStore` (`setMessages`) only **once** when the stream completes, eliminating 50–100 synchronous `localStorage` serialization writes per answer.

---

## 2. File-by-File Implementation Details

### A. Backend Model Normalization, Descending Fallback & Config Caching (`server/utils/backendHelpers.ts`)

1. **Direct Pass-Through in `normalizeGeminiModel(rawModel)`:**
   - Keep all valid active model checkpoints untouched:
     - `'gemini-3.8-flash'`
     - `'gemini-3.6-flash'`
     - `'gemini-3.5-flash-lite'`
     - `'gemini-3.1-flash-lite'`
     - `'gemini-3.1-pro-preview'`
     - `'gemini-3-flash-preview'`
     - `'gemini-2.5-flash'`, `'gemini-2.5-flash-lite'`, `'gemini-2.5-pro'`
     - `'gemma-4-26b-a4b-it'`, `'gemma-4-31b-it'`
   - Map legacy saved values for the two removed checkpoints in descending order:
     - `'gemini-3.7-flash'` ➔ `'gemini-3.6-flash'`
     - `'gemini-3.5-flash'` ➔ `'gemini-3-flash-preview'`

2. **Descending Fallback Chain Helper (`getDescendingFallbackChain(primaryModel: string): string[]`):**
   - Define the ordered ladders:
     ```ts
     const FLASH_LADDER = [
       "gemini-3.8-flash",
       "gemini-3.6-flash",
       "gemini-3-flash-preview",
       "gemini-2.5-flash",
     ];
     const FLASH_LITE_LADDER = [
       "gemini-3.5-flash-lite",
       "gemini-3.1-flash-lite",
       "gemini-2.5-flash-lite",
     ];
     const PRO_LADDER = [
       "gemini-3.1-pro-preview",
       "gemini-2.5-pro",
       "gemini-3.8-flash",
       "gemini-3.6-flash",
     ];
     ```
   - Given `primaryModel`, locate its index in its family ladder and return `[primaryModel, ...remainingLowerModels]` (so e.g. starting at `gemini-3.6-flash` yields `['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash']`, and starting at `gemini-3.5-flash-lite` yields `['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']`).

3. **App-Wide Fallback Wrappers (`generateContentStreamWithFallback` & `generateContentWithFallback`):**
   - Update `generateContentStreamWithFallback(aiClient, payload)` to iterate through `getDescendingFallbackChain(payload.model)`, returning `{ stream, firstChunk, iterator, modelUsed }` from the first model that succeeds.
   - Add `generateContentWithFallback(aiClient, payload)` for non-streaming endpoints (`/api/gemini-proxy`, `/api/learning-chat`, `/api/jarvis/*`, and extraction routes) so all AI features automatically step down the descending ladder if a model errors.

4. **60-Second Server-Side Cache for `global_gemini` Config:**
   - Add an in-memory cache (`cachedGlobalGeminiConfig: { data: any; expiresAt: number } | null`) and `adminSdkGlobalConfigFailed: boolean` flag inside `backendHelpers.ts`.
   - In `resolveGeminiProxyConfig()`:
     - If `cachedGlobalGeminiConfig && cachedGlobalGeminiConfig.expiresAt > Date.now()`, use `cachedGlobalGeminiConfig.data` immediately in **0ms**.
     - Otherwise, fetch once (skipping Admin SDK if it previously failed with ADC/permission error and going straight to `getGlobalGeminiConfigRest()`), and cache the result for 60 seconds (`Date.now() + 60_000`).
     - Expose `invalidateGlobalGeminiConfigCache()` so any admin update immediately clears the cache.

---

### B. Streaming Route & `modelUsed` Telemetry (`server/routes/jarvisRoutes.ts`)

1. **`POST /api/tutor-chat-stream`:**
   - Use the descending fallback chain (`getDescendingFallbackChain(modelToUse)`).
   - Attempt `aiClient.models.generateContentStream` on the selected `activeModel` first. Only if it throws an error, step down to the next model in `getDescendingFallbackChain(modelToUse)`.
   - Once the stream opens, track `activeModel` and emit it in the first SSE metadata event:
     ```ts
     res.write(`data: ${JSON.stringify({ modelUsed: activeModel })}\n\n`);
     ```
2. **`POST /api/learning-chat` & `POST /api/gemini-proxy`:**
   - Use `generateContentWithFallback` so non-streaming requests also follow the descending fallback chain and return `modelUsed`.

---

### C. UI Model Dropdown Lists (`SubjectRow.tsx`, `LearningView.tsx`, `AdminGlobalGeminiTab.tsx`, `jarvisIntentService.ts`)

1. **`src/components/mocks/SubjectRow.tsx`:**
   - Remove `'gemini-3.7-flash'` and `'gemini-3.5-flash'` from `AVAILABLE_MOCK_MODELS` (leaving `3.5 Flash Lite`, `3.1 Flash Lite`, `3.8 Flash`, `3.6 Flash`, `3.1 Pro`, `3.0 Flash`, `2.5 Flash`, `2.5 Flash Lite`).
2. **`src/components/learning/LearningView.tsx`:**
   - Remove `'gemini-3.7-flash'` and `'gemini-3.5-flash'` from `MODELS`.
3. **`src/components/admin/AdminGlobalGeminiTab.tsx`:**
   - Remove `'gemini-3.7-flash'` and `'gemini-3.5-flash'` from `AVAILABLE_MODELS`.
4. **`src/features/jarvis/services/jarvisIntentService.ts`:**
   - Update fallback default parameter `_model: string = 'gemini-3.5-flash'` to `'gemini-3.5-flash-lite'`.

---

### D. Frontend Streaming Buffer & Subtle Per-Message Model Tag (`learningGeminiService.ts`, `LearningAIAssistant.tsx`, `ChatMessage.tsx`)

1. **`src/services/learningGeminiService.ts`:**
   - Add `modelUsed?: string;` to the `ChatMessage` interface.
   - Update `askLearningTutor` callback signature to `onMessageUpdate?: (text: string, citations?: Citation[], modelUsed?: string) => void` and return `{ text: string; citations?: Citation[]; modelUsed?: string }`.
   - Parse `data.modelUsed` from the SSE stream and forward it to `onMessageUpdate` and the final resolved object.

2. **`src/components/learning/LearningAIAssistant.tsx`:**
   - Add local state `const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);`.
   - During `askLearningTutor` streaming:
     - Inside `onMessageUpdate(text, citations, modelUsed)`, update `setStreamingMessage({ role: 'model', text, citations, modelUsed: modelUsed || modelToUse })` instead of calling `setMessages(chatMode, ...)` on every token chunk.
   - When `askLearningTutor` resolves:
     - Clear `setStreamingMessage(null)` and call `setMessages(chatMode, [...chatHistory, { role: 'model', text: reply.text, citations: reply.citations, modelUsed: reply.modelUsed || modelToUse }])` **once**.
   - Render `streamingMessage` at the end of the messages list while streaming is active.

3. **`src/components/learning/ai/ChatMessage.tsx`:**
   - Import `formatModelName` from `../../mocks/SubjectRow`.
   - At the bottom-right of model message bubbles (when `isModel && msg.modelUsed`), render a subtle, non-eye-catching short label:
     ```tsx
     {isModel && msg.modelUsed && (
       <div className="mt-1 flex justify-end">
         <span className="text-[9px] font-normal text-slate-300 dark:text-slate-600 select-none leading-none">
           {formatModelName(msg.modelUsed)}
         </span>
       </div>
     )}
     ```

---

## 3. Verification Plan

1. Run `compile_applet` and `lint_applet` (`tsc --noEmit`) to verify zero TypeScript or build errors across both frontend and server.
2. Verify that `3.5 Flash` and `3.7 Flash` are removed from all model selectors while `3.8 Flash`, `3.6 Flash`, `3.5 Flash Lite`, `3.1 Flash Lite`, `3.1 Pro`, `3.0 Flash`, `2.5 Flash`, and `2.5 Flash Lite` remain selectable and pass straight through to the API.
3. Verify that each AI Tutor reply displays the subtle short model name (e.g., `3.5 Flash Lite`, `3.8 Flash`) at the bottom-right corner of the message bubble.
