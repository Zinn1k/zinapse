# Zinapse — DeepSeek Harness Context & Architecture Guide

> **Directive for DeepSeek Agent / Benchmark Harness:**
> This document is optimized for autonomous agents and harnesses executing inside the **Zinapse** repository. It outlines runtime commands, directory structure, file locations, data schemas, algorithms, and non-negotiable architectural constraints to prevent regressions.

---

## 1. Environment & Execution Harness Commands

* **Repository Root:** `G:\analog quizlet` (or current workspace root)
* **OS / Shell:** Windows (PowerShell) / Cross-platform POSIX bash compatible
* **Runtime:** Node.js v20+ / v22+, npm 10+
* **Package Manager:** `npm`

### Essential CLI Lifecycle Commands:
```bash
# 1. Verification & Testing (Vitest, 9 test suites, 48 passing tests)
npm test

# 2. Strict TypeScript Compilation Check (Zero Errors)
npx tsc --noEmit

# 3. Next.js Production Build
npm run build

# 4. ESLint 9 Code Style Verification
npm run lint

# 5. Local Dev Server (Runs on http://localhost:3000)
npm run dev

# 6. Google Drive Automated Backup & Context Sync
npm run backup:gdrive

# 7. Capacitor Mobile Sync (Web to Android)
npx cap sync android
```

---

## 2. Directory Map & File Locations

### 2.1. Root Configuration & Documentation Files
| File Path | Description / Responsibility |
| :--- | :--- |
| `package.json` | Project metadata, scripts, dependencies (Next 15.5+, React 19, Tailwind 4, Vitest 5, FSRS 5) |
| `tsconfig.json` | TypeScript configuration (strict mode, path aliases `@/*` -> `./src/*`) |
| `next.config.ts` | Next.js configuration: sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` (for Firebase OAuth popup) and rewrites |
| `capacitor.config.ts` | Capacitor 8 configuration (`appId: "com.zinapse.app"`, `server.url: "https://zinapse.vercel.app"`) |
| `firestore.rules` | Production Cloud Firestore security rules with granular user-data isolation |
| `firebase.json` | Firebase CLI deployment settings for Firestore rules |
| `.env.example` | Template of required environment variables (`GEMINI_API_KEY`, `NEXT_PUBLIC_FIREBASE_*`) |
| `PROJECT_CONTEXT_FOR_AI.md` | Human & LLM high-level overview |
| `scripts/sync-gdrive.ps1` | Automation script for Google Drive sync & `.zip` artifact creation |
| `.github/workflows/android-build.yml` | GitHub Actions CI building `zinapse-debug.apk` using Java 21 & Android SDK 35/36 |

---

### 2.2. Application Routes (`src/app/`) — Next.js 15 App Router
| Route / File Path | Responsibility |
| :--- | :--- |
| `src/app/layout.tsx` | Root layout: `Inter` (full Cyrillic) + `Geist Mono`, blocking theme script (no flash), `ThemeProvider`, skip-link, `ServiceWorkerRegister`, `AppUpdateNotification`. `AppHeader` lives on the dashboard page, not here |
| `src/app/page.tsx` | Main library dashboard: hero with daily progress ring, workload stats, deck grid, quick action modals |
| `src/app/create-ai/page.tsx` | Full-screen AI deck creation wizard: file upload (.txt, .md), multimodal OCR, prompt controls |
| `src/app/deck/[id]/page.tsx` | Single deck overview: study mode selector, card list, audio previews, sharing drawer |
| `src/app/deck/[id]/edit/page.tsx` | Full-featured deck editor: batch card editing, reordering, tags, WebP image upload |
| `src/app/deck/[id]/flashcards/page.tsx` | Flashcards study page (renders `FlashcardsMode.tsx`) |
| `src/app/deck/[id]/learn/page.tsx` | Learn study page (renders `LearnMode.tsx`) |
| `src/app/deck/[id]/match/page.tsx` | Match speed game page (renders `MatchMode.tsx`) |
| `src/app/deck/[id]/test/page.tsx` | Exam testing page (renders `TestMode.tsx`) |
| `src/app/share/[shareCode]/page.tsx` | Public preview & 1-click clone page for shared decks via 6-char share code |
| `src/app/api/generate-deck/route.ts` | Backend API: integrates `@google/genai` (Gemini 3.5 Flash Lite), OCR, structured JSON schema |
| `src/app/manifest.ts` | Dynamic PWA Web App Manifest generator |
| `src/app/globals.css` | Design system: Tailwind v4 `@theme` (semantic colors, fonts, shadows, animations), class-based `@custom-variant dark`, app-shell backdrop, `animate-in` emulation, reduced-motion guard |

---

### 2.3. Study Engines (`src/components/study/`)
| Component Path | Functionality |
| :--- | :--- |
| `src/components/study/FlashcardsMode.tsx` | 3D-card flip (`framer-motion`), FSRS ratings (Again=1, Hard=2, Good=3, Easy=4), Cram Mode, hotkeys (`1-4`, `Space`), Web Speech TTS |
| `src/components/study/LearnMode.tsx` | 2-stage adaptive mastery: Stage 1 = Multiple choice with distractors; Stage 2 = Written input with Levenshtein tolerance & override |
| `src/components/study/MatchMode.tsx` | Fast-paced tile-matching grid (12 tiles), 0.1s timer, +1.0s penalty on mismatch, Web Audio SFX, live Firebase leaderboard |
| `src/components/study/TestMode.tsx` | Custom test generator: Multiple choice, True/False, Written, Matching. Detailed score card & mistake review |

---

### 2.4. Core UI & Modals (`src/components/`)
| Component Path | Responsibility |
| :--- | :--- |
| `src/components/AppHeader.tsx` | Sticky glass navbar: brand, AI action, sync status pill, auth, theme toggle, settings |
| `src/components/ThemeProvider.tsx` | Theme context (`light` / `dark` / `system`), applies `.dark` class + `theme-color`, mirrors preference into Dexie |
| `src/components/ui/*` | Design-system primitives: `button`, `card`, `input`, `textarea`, `badge`, `progress`, `switch`, `tabs`, `dialog`, `skeleton`, `empty-state` |
| `src/components/AuthModal.tsx` | Firebase Auth: Google 1-Click popup with redirect fallback, Email/Password sign-up & sign-in |
| `src/components/AIGenerateModal.tsx` | Quick AI generation dialog accessible from any page |
| `src/components/CardEditorModal.tsx` | Add/edit individual card with formula preview & image compression |
| `src/components/CreateEditDeckModal.tsx` | Create or update deck metadata (title, description, tags, isPublic) |
| `src/components/DeckCard.tsx` | Summary card presentation in the deck grid |
| `src/components/DeckDetailView.tsx` | Detailed deck view with FSRS progress breakdown |
| `src/components/FSRSAnalyticsModal.tsx` | Retention metrics, difficulty distribution, upcoming due cards charts |
| `src/components/MarkdownMath.tsx` | Renders Markdown + LaTeX equations via `KaTeX`, `remark-math`, `rehype-katex` |
| `src/components/AppUpdateNotification.tsx` | In-app notification banner prompting users to download updated Android APK |
| `src/components/SettingsModal.tsx` | User preferences: theme selector (light/dark/system), custom Gemini API key + model, FSRS target retention, TTS voice, backup export/import |
| `src/components/ZinapseLogo.tsx` | Scalable animated neural synapse vector logo |
| `src/components/ServiceWorkerRegister.tsx`| Client-side Service Worker registration for PWA offline caching |

---

### 2.5. Business Logic & Library Utilities (`src/lib/`)
| Library Path | Responsibility |
| :--- | :--- |
| `src/lib/theme.ts` | Pure theme helpers: preference parsing, system resolution, `<html>` class application, no-flash init script |
| `src/lib/db.ts` | Dexie.js (`FreeQuizletDB` v2) IndexedDB setup, TypeScript schemas, cascade deletion, starter decks |
| `src/lib/fsrs.ts` | FSRS v5 wrapper (`ts-fsrs`), interval previews, `NEW_CARD_DAILY_LIMIT`, library-wide workload aggregation |
| `src/lib/sync.ts` | Bidirectional synchronization engine: drains `sync_queue` to Firestore, pulls remote changes |
| `src/lib/firebase.ts` | Firebase initialization: Auth with popup + redirect fallback, Firestore with persistent local cache |
| `src/lib/ai.ts` | Client helper for AI deck generation calling `/api/generate-deck` or direct Gemini API |
| `src/lib/image-compression.ts` | Compresses images to WebP ($\le 40$ KB) Base64 strings to eliminate paid bucket storage |
| `src/lib/levenshtein.ts` | Levenshtein distance string similarity algorithm for typo-tolerant answer validation |
| `src/lib/cloze.ts` | Cloze deletion engine: parses `{{c1::answer::hint}}` syntax for fill-in-the-blank cards |
| `src/lib/sound.ts` | Web Audio API procedural sound synthesizer (correct chime, wrong buzz, match click) |
| `src/lib/speech.ts` | Web Speech API text-to-speech synthesis for Russian and English card terms |
| `src/lib/importer.ts` | Importer for Quizlet export strings, CSV, TSV, and tabular flashcard formats |
| `src/lib/updater.ts` | Checks GitHub Releases API (`Zinn1k/zinapse`) for newer Android APK versions |
| `src/lib/analytics.ts` | Computes retention curves, memory stability, and review forecast stats |
| `src/lib/utils.ts` | Utility helpers: `cn()` (clsx + twMerge), `generateId()`, `generateShareCode()` |
| `src/hooks/use-settings.ts` | Live Dexie view over `settings` — single source for `requestRetention`, voice and Gemini model |

---

### 2.6. Test Suites (`src/lib/__tests__/`) — 48 Tests Total
* `src/lib/__tests__/fsrs.test.ts` — FSRS formatting, record ↔ ts-fsrs conversion, interval math
* `src/lib/__tests__/fsrs-db.test.ts` — **DB-backed FSRS invariants** (`fake-indexeddb`): Cram Mode never mutates the schedule, retention target changes intervals, new-card cap consistency, per-user isolation
* `src/lib/__tests__/theme.test.ts` — theme preference resolution (`light` / `dark` / `system`), fallbacks
* `src/lib/__tests__/sync.test.ts` — Sync queue operations, enqueue/dequeue, offline reconciliation
* `src/lib/__tests__/levenshtein.test.ts` — Typo tolerance and string distance edge cases
* `src/lib/__tests__/cloze.test.ts` — Cloze bracket extraction, hint parsing, multiple blanks
* `src/lib/__tests__/importer.test.ts` — Delimiter detection, CSV/TSV parsing, multi-line terms
* `src/lib/__tests__/analytics.test.ts` — Retention calculation and review counts
* `src/lib/__tests__/firebase.test.ts` — Config validation, auth state mocks

---

## 3. Data Models & Schemas

### 3.1. Local IndexedDB (Dexie: `FreeQuizletDB` v2 in `src/lib/db.ts`)
```ts
// 1. Decks
interface Deck {
  id: string;          // UUID
  ownerId: string;     // Firebase UID or "local_guest"
  title: string;
  description: string;
  isPublic: boolean;
  shareCode: string;   // 6-character unique alphanumeric code
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

// 2. Cards
interface Card {
  id: string;          // UUID
  deckId: string;      // FK -> Deck.id
  term: string;        // Front / Question
  definition: string;  // Back / Answer
  hint?: string;
  imageData?: string;  // Base64 WebP <= 40KB
  tags?: string[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

// 3. FSRS States
interface FSRSStateRecord {
  id: string;          // Composite PK: `${userId}_${cardId}`
  cardId: string;
  deckId: string;
  userId: string;
  state: number;       // 0=New, 1=Learning, 2=Review, 3=Relearning
  due: Date | number;  // Timestamp
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review?: Date | number | null;
}

// 4. Sync Queue
interface SyncQueueItem {
  id: string;
  collection: "decks" | "cards" | "fsrs_states";
  docId: string;
  action: "upsert" | "delete";
  payload?: unknown;
  timestamp: number;
  attempts: number;
}
```

### 3.2. Cloud Firestore Collections (`firestore.rules`)
* `/decks/{deckId}`: Publicly readable if `resource.data.isPublic == true` or `request.auth.uid == resource.data.ownerId`. Modifiable only by owner.
* `/cards/{cardId}`: Accessible if parent deck is accessible.
* `/fsrs_states/{stateId}`: **Strictly private** (`request.auth.uid == resource.data.userId`).
* `/review_logs/{logId}`: **Strictly private** (`request.auth.uid == resource.data.userId`).
* `/match_scores/{scoreId}`: Public leaderboard for a deck with strict numeric score and duration validation.

---

## 4. Critical Constraints & Gotchas for DeepSeek

1. **Next.js 15 Async Page Props:**
   In Next.js 15 App Router, `params` and `searchParams` in page components are **Promises**.
   All deck routes are `"use client"` pages, so they unwrap the promise with React's `use()`:
   ```tsx
   "use client";
   import { use } from "react";

   export default function Page({ params }: { params: Promise<{ id: string }> }) {
     const { id } = use(params);
   }
   ```
   An `async` Server Component must use `await params` instead — never read `params.id` directly.
2. **Local-First Zero-Latency Rule:**
   Never block the UI waiting for a network response. User mutations must write immediately to Dexie.js, enqueue an action to `sync_queue`, and let `sync.ts` background sync to Firestore. Study engines call `scheduleSync(userId)` after rating a card.
3. **Zero-Cost Firebase Spark Plan Constraint:**
   Do **NOT** introduce paid cloud storage or external paid APIs. Images must remain compressed client-side to WebP $\le 40$ KB Base64 embedded in the card object. Audio synthesis must use the browser's native Web Speech API.
4. **FSRS vs. Cram Mode Separation:**
   Cram mode (`cramMode === true`) allows users to review cards repeatedly before an exam without touching long-term FSRS weights (`stability`, `difficulty`, `due`). FSRS state updates must only be recorded when Cram mode is disabled. Covered by `fsrs-db.test.ts`.
5. **Retention target is user data, not a constant:**
   `rateCardFSRS` / `getFSRSIntervalPreviews` accept `requestRetention`. Always pass the value from `useSettings()` (`src/hooks/use-settings.ts`); hard-coding `0.9` silently disables the Settings slider.
6. **Theme system:**
   `dark:` variants are class-based via `@custom-variant dark` in `globals.css`. Toggle through `useTheme()` (`src/components/ThemeProvider.tsx`) — never manipulate `document.documentElement.classList` by hand. Preference persists in `localStorage["zinapse-theme"]` and mirrors into Dexie `settings.theme`.
7. **Firebase Popup COOP Header:**
   `next.config.ts` includes `Cross-Origin-Opener-Policy: same-origin-allow-popups` to support Google OAuth popups. Never remove this header.
8. **Regression Testing Requirement:**
   Any change made by the agent must be verified with `npm test`, `npx tsc --noEmit` and `npm run lint`. All 48 tests must pass.
