# AI Vocabulary Quiz Redesign & Enhancement Plan

This plan overhauls the AI Vocabulary Quiz from configuration through active practice and post-quiz revision—eliminating answer spoilers, restoring the missing Reading Comprehension passage view, fixing Mixed Mock rendering, and introducing a compact, mobile- and desktop-friendly UI that matches the app's native theme.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions were confirmed during clarification and govern the implementation:

- **Confirmed Decision 1 — Instant Practice Feedback**: Every question format (including Cloze blanks, Reading Comprehension, Fillers, Synonyms/Antonyms, Spot the Error, and Mixed Challenge) operates in **Instant Practice Mode**, revealing whether the selected choice is correct along with its contextual explanation immediately after the user answers that specific question—while keeping all unanswered questions completely spoiler-free.
- **Confirmed Decision 2 — Streamlined Configuration Controls**: The **Configure AI Vocab Quiz** modal will include a **Question Count Selector** (`5`, `10`, `15`, or `20` questions) and a **Word Pool Filter** (`All in View` vs. `Starred Only`), arranged in a compact layout where all controls fit cleanly without vertical cutoffs.
- **Confirmed Decision 3 — Post-Quiz Revision Suite**: The **Quiz Results** screen will feature a **Retry Missed Words** button for immediate re-testing of wrong answers, a **One-Click Star / Bookmark** action for missed vocabulary, and a **Side-by-Side Passage & Answer Review** for passage-based quizzes.

---

## 1. Overview & Core Concept

- **What It Does**: Generates tailored, exam-grade interactive vocabulary quizzes from a user's saved vocabulary words across 6 practice formats (*Cloze Test*, *Sentence Fillers*, *Synonyms & Antonyms*, *Spot the Error*, *Reading Comprehension*, and *Mixed Mock Challenge*).
- **Target Audience / Persona**: Competitive banking and government exam aspirants practicing active recall and contextual usage from their saved editorial and study vocabulary lists.
- **Key Value**: Transforms passive word lists into active, spoiler-free exam practice with instant per-question explanations and targeted re-drilling of weak words.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Compact Quiz Configuration Modal**:
   - **Word Pool & Question Count Bar**: Top control strip lets the user switch between **All Words in View** and **Starred Only** (with live word counts) and choose the **Question Count** (`5`, `10`, `15`, or `20`, automatically capped to the available word pool when in Strict Mode).
   - **6 Compact Format Cards**: 2-column grid of sleek, single-line-header cards with concise 1-line descriptions and unboxed typographic metadata (`· Passage Blanks`, `· Single Sentence`, etc.), eliminating the oversized cards that previously pushed lower sections off-screen.
   - **Compact Scope & Optional Theme Row**: Side-by-side **Strict Mode** vs. **Expanded Mode** toggle cards paired with a compact single-line custom theme input so the entire modal fits comfortably on desktop and mobile screens.

2. **Spoiler-Free Instant Practice Arena**:
   - **Cloze Test (Two-Zone Interactive Passage)**:
     - *Left / Top Stage*: Cohesive passage where each `[Blank N]` renders as a custom themed inline popover selector (via `createPortal` so menus never clip). Selecting an option immediately locks that blank, colors it Emerald (correct) or Rose (incorrect), and reveals that specific blank's explanation in the right/bottom feedback deck.
     - *Zero Spoilers*: Unanswered blanks never display `testedWord` or `Target` answers in advance.
   - **Reading Comprehension (Two-Zone Split View)**:
     - *Left Stage (Desktop) / Collapsible Top Card (Mobile)*: Displays the full generated editorial passage (`passageText`) with clean typography and reading progress.
     - *Right Stage*: Displays the current comprehension/vocabulary question with 4 interactive option cards, instant correctness feedback, explanation drawer, and question navigation (`1`, `2`, `3`...).
   - **Sentence Fillers, Synonyms/Antonyms, Spot the Error & Mixed Mock**:
     - Question header shows `Question X of N` and keyboard/click navigation pills without exposing `Focus: [testedWord]` before the user answers (once answered, the tested target word and full explanation appear in the instant feedback card).
     - In **Mixed Mock Challenge**, each question dynamically dispatches to `SpotErrorRenderer` when `sentenceChunks` are present or `StandardMCQRenderer` otherwise.

3. **Actionable Results & Revision Screen**:
   - **Score & Accuracy Summary**: Clean summary header with tabular numerals (`score / total` and `accuracy %`).
   - **Revision Action Bar**:
     - **Retry Missed Words**: Immediately launches a fresh quiz scoped strictly to the vocabulary words missed in the completed session.
     - **Star / Bookmark Missed Words**: 1-click toggle to star all missed vocabulary items in `useVocabularyStore`.
   - **Side-by-Side Passage & Question Breakdown**: When the quiz includes a `passageText` (*Cloze* or *Reading Comprehension*), the review screen presents the full passage alongside the question-by-question answer breakdown with target words highlighted in context.

### Visual Identity & Theme

- **Aesthetic Direction**: Matches the app's native dual-theme and Cyber/Neon (`html.cyber`, `html.dark`, and light mode) design language—crisp borders, balanced density, and zero visual clutter.
- **60-30-10 Color Discipline**:
  - *60% Dominant Canvas*: `bg-slate-50/90 dark:bg-slate-950/90` arena backdrop and `bg-white dark:bg-slate-900` primary stage cards.
  - *30% Structural Surfaces*: `border-slate-200 dark:border-slate-800` hairlines, secondary control bars (`bg-slate-50 dark:bg-slate-800/60`), and neutral typography.
  - *10% Semantic Accents*: Primary interactive focus in Indigo/Sky (`indigo-600` / cyber neon accent), `emerald-500` with `CheckCircle2` icon + `Correct` label for right answers, and `rose-500` with `XCircle` icon + `Incorrect` label for wrong answers.
- **Zero-Pill Metadata Discipline**: Format subtitles, question counters, and mode labels use clean unboxed typography with `·` separators rather than static decorative capsules.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Per-Blank Instant Feedback in Cloze Test Without Pre-Answer Spoilers**
  - *Chosen Approach*: Replace native `<select>` elements with a custom portal-backed inline dropdown and only reveal a blank's target word and explanation after the user selects an option for that specific blank.
  - *Why*: Previously, all blanks and their target answers were listed below the passage from the start, ruining the test. Per-blank instant lock + feedback preserves the active-recall challenge while honoring Instant Practice Mode.
- **Decision 2 — Align Quiz Backend Proxy with `vocab_extractor` Global Gemini Key**
  - *Chosen Approach*: Map the quiz generation request to resolve against `vocab_extractor` (and fallback to `ai_tutor`) in `resolveGeminiProxyConfig` and `useGeminiResolution('vocab_extractor')`.
  - *Why*: Ensures the owner's **Global Gemini Access** toggle and model locks for **Vocabulary Extractor** directly govern the AI Vocab Quiz without requiring a separate orphaned config key.
- **Decision 3 — Question-Level Renderer Dispatch for Mixed Mock Challenge**
  - *Chosen Approach*: Inspect each `QuizQuestion` for `sentenceChunks?.length === 4` to choose `SpotErrorRenderer` vs. `StandardMCQRenderer` per question, rather than branching only on the top-level quiz format.
  - *Why*: Allows **Mixed Mock Challenge** to seamlessly blend Sentence Fillers, Synonyms/Antonyms, and Spot-the-Error questions in a single session.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Vocabulary View & Store Layer                         │
│  ┌─────────────────────────┐               ┌──────────────────────────────┐  │
│  │   useVocabularyStore    │──────────────▶│      useQuizStore (Zustand)  │  │
│  │ (words, favoriteVocabs) │               │ (activeQuiz, config, answers)│  │
│  └─────────────────────────┘               └──────────────┬───────────────┘  │
└───────────────────────────────────────────────────────────┼──────────────────┘
                                                            │
        ┌───────────────────────────────────────────────────┼───────────────┐
        ▼                                                   ▼               ▼
┌──────────────────────┐                         ┌────────────────────┐ ┌──────────────────────┐
│   QuizConfigModal    │                         │   QuizPlayArena    │ │  QuizResultsSummary  │
│ ──────────────────── │                         │ ────────────────── │ │ ──────────────────── │
│ • Word Pool Filter   │                         │ • Question Jumper  │ │ • Score & Accuracy   │
│   (All vs Starred)   │                         │ • Split Passage    │ │ • Retry Missed Words │
│ • Question Count     │                         │   View (RC/Cloze)  │ │ • Star Missed Words  │
│   (5 / 10 / 15 / 20) │                         │ • Instant Feedback │ │ • Side-by-Side       │
│ • 6 Compact Formats  │                         │   Drawer           │ │   Passage & Review   │
│ • Scope & Theme      │                         └─────────┬──────────┘ └──────────────────────┘
└──────────┬───────────┘                                   │
           │                                   ┌───────────┴───────────┐
           │                                   ▼                       ▼
           │                        ┌─────────────────────┐ ┌─────────────────────┐
           │                        │   ClozeRenderer     │ │ Question Dispatcher │
           │                        │ (Portal Popovers +  │ │ • StandardMCQ       │
           │                        │  Answered-Only      │ │ • SpotErrorRenderer │
           │                        │  Feedback Cards)    │ │   (per-question)    │
           │                        └─────────────────────┘ └─────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Quiz Service & Express Gemini Proxy (/api/generate-quiz)     │
│  • Resolves model & key via Global Gemini ('vocab_extractor' feature rule)   │
│  • Builds dynamic prompt with questionCount, format, scope, and theme        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`QuizConfig` Extension**:
  - `sourceWords: VocabularyItem[]` (filtered by word pool selection before generation)
  - `wordPool?: 'all' | 'starred'`
  - `questionCount: 5 | 10 | 15 | 20`
  - `format: QuizFormat`
  - `scope: 'strict' | 'expanded'`
  - `theme: string`
- **`QuizQuestion` Extension**:
  - `questionType?: 'mcq' | 'spot_error' | 'cloze'` (inferred from `sentenceChunks` or format so Mixed Mode renders each question with the right interactive component).
- **`useQuizStore` Actions**:
  - `retryMissedWords: (missedWords: VocabularyItem[]) => void` — immediately starts a new quiz generation using the current config's format/scope and the subset of missed `VocabularyItem`s.

### Interactive Component & State Mapping

- **`QuizConfigModal`**:
  - Switching **Word Pool** (`All in View` vs. `Starred Only`) filters `sourceWords` against `favoriteVocabIds` from `useVocabularyStore`; if `Starred Only` has 0 words, displays an inline notice and disables the option.
  - Selecting **Question Count** (`5`, `10`, `15`, `20`) updates `questionCount` state and passes it to `/api/generate-quiz`.
- **`ClozeRenderer`**:
  - Clicking an inline `[Blank N]` button opens a `createPortal` option menu positioned via `getBoundingClientRect()`.
  - Selecting an option calls `onSelectAnswer(question.id, optIdx)`, immediately locking that blank and adding its explanation card to the **Answered Blanks Feedback** list below the passage.
- **`QuizPlayArena`**:
  - Renders a 2-column split on desktop (`lg:grid-cols-12`) when `format === 'reading_comprehension'` and `activeQuiz.passageText` is present (`col-span-6` scrollable passage card on the left, `col-span-6` question & instant explanation on the right).
  - Header question number pills (`1..N`) allow jumping directly to any question, color-coded by answered correctness (`emerald` / `rose` / `neutral`).
  - `StandardMCQRenderer` hides `testedWord` while `selectedIndex === undefined` and reveals `Tested Word: {question.testedWord}` inside the explanation badge once answered.
- **`QuizResultsSummary`**:
  - Clicking **Retry Missed Words** invokes `retryMissedWords(matchedWrongVocabs)` to generate a targeted revision quiz on the spot.
  - Clicking **Star Missed Words** stars all unstarred items in `matchedWrongVocabs` via `toggleFavorite`.
  - Renders the passage alongside the question breakdown when `passageText` is present.
