# Zinapse — Сводка проекта и контекст для ИИ (AI Hand-off Document)

> **Инструкция для принимающей языковой модели / ИИ-агента:**
> Данный документ содержит полный архитектурный, технологический и продуктовый контекст проекта **Zinapse**. Используй эту информацию для понимания кодовой базы, архитектурных соглашений, моделей данных и текущего статуса проекта без необходимости заново сканировать все файлы. При внесении изменений строго придерживайся зафиксированных здесь паттернов.

---

## 1. О проекте (Executive Summary)

* **Название:** Zinapse (ранее Free Quizlet Analog)
* **Репозиторий:** `Zinn1k/zinapse` (ветка `main`)
* **Платформа / Production URL:** [https://zinapse.vercel.app](https://zinapse.vercel.app)
* **Форм-факторы:** 
  1. Progressive Web App (PWA) для Web, iOS, macOS, Windows
  2. Нативное Android-приложение (сборка через Capacitor 8, APK формируется через GitHub Actions CI/CD)
* **Назначение:** Современный, бесплатный, локально-ориентированный (Local-First) аналог Quizlet и Anki для эффективного запоминания информации на базе научно обоснованного алгоритма интервальных повторений **FSRS**, искусственного интеллекта **Google Gemini 3.5 Flash-Lite** (с поддержкой **gemini-3.8-flash**) и облачной синхронизации **Firebase** (100% бесплатный Spark Plan).

---

## 2. Ключевые архитектурные принципы

1. **Local-First & 0ms UI Latency:**
   * Первичный источник правды для клиента — браузерная IndexedDB через библиотеку **Dexie.js**.
   * Все операции чтения, создания карточек, редактирования и тренировок происходят синхронно/мгновенно локально.
   * Приложение работает на 100% офлайн (в метро, самолете, без связи).
2. **Zero-Cost Infrastructure (100% Free Tier):**
   * Работает полностью на бесплатных лимитах: Vercel (Hobby), Firebase (Spark Plan), Google Gemini 3.5 Flash-Lite (AI Studio free tier).
   * **Никакого платного Firebase Storage:** Картинки карточек сжимаются на клиенте до формата WebP ($\le 40$ КБ) и сохраняются в виде Base64-строк непосредственно в документе карточки.
   * **Озвучка (TTS) без затрат:** Используется Web Speech API браузера/устройства, а не платные облачные API.
3. **Научный алгоритм интервальных повторений (FSRS):**
   * Движок **`ts-fsrs`** (Free Spaced Repetition Scheduler v5) вместо устаревшего алгоритма SM-2.
   * Расчет вероятности вспоминания (target retention 90%), стабильности (stability) и сложности (difficulty).
   * Поддержка **Cram Mode (Быстрая зубрежка)** для подготовки перед зачетом/экзаменом без искажения долгосрочных весов FSRS.
4. **Кроссплатформенность и автообновления:**
   * Next.js 15 упакован в Android-приложение через Capacitor 8.
   * Встроена система проверки и уведомления об обновлениях (`updater.ts` + `AppUpdateNotification.tsx`), которая проверяет GitHub Releases API и отдает свежий APK.

---

## 3. Технологический стек и версии библиотек

| Категория | Технология / Пакет | Версия | Назначение |
| :--- | :--- | :--- | :--- |
| **Фреймворк** | **Next.js** | `^15.5.29` | App Router, Server Actions, API Routes, Turbopack |
| **Библиотека UI** | **React** | `19.3.0` | React 19 (Server & Client Components) |
| **Язык** | **TypeScript** | `^5.x` | Strict type checking, Next-типизация |
| **Стилизация** | **Tailwind CSS** | `^4.3.3` | Tailwind v4 (`@tailwindcss/postcss`) |
| **Анимации** | **Framer Motion** | `^14.14.0` | 3D-переворот карточек, жесты свайпов, переходы |
| **Иконки** | **Lucide React** | `^1.73.0` | Набор векторных иконок |
| **UI-примитивы** | **Radix UI** | `^1.x` | Dialog, Tabs, Switch, Progress, Slot |
| **Локальная БД** | **Dexie.js** | `^4.4.7` | IndexedDB ORM |
| **Реактивность БД** | **dexie-react-hooks** | `^4.4.0` | `useLiveQuery` для авто-обновления React компонентов |
| **Облако & Auth** | **Firebase SDK** | `^13.3.0` | Firebase Auth + Cloud Firestore |
| **Интервалы** | **ts-fsrs** | `^5.4.2` | Математика FSRS v5 (стабильная версия; v6 требует Node.js 24+) |
| **Искусственный интеллект** | **@google/genai** | `^3.4.0` | Официальный SDK Google Gemini (`gemini-3.5-flash-lite`, fallback `gemini-3.8-flash`) |
| **Математика / Наука** | **KaTeX, remark-math, rehype-katex** | `^0.19.1` / `^6.0.0` / `^7.0.1` | Рендеринг LaTeX-формул `$E=mc^2$` и `$$\int...$$` |
| **Мобильная оболочка** | **Capacitor** | `^8.6.2` | `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` (Node 22+) |
| **Эффекты** | **canvas-confetti** | `^1.9.4` | Салют победы при завершении учебной сессии |
| **Тестирование** | **Vitest** | `^5.1.1` | Юнит-тестирование логики (`npm test`, 38 тестов) |

---

## 4. Архитектура данных и схемы

### 4.1. Локальная база данных Dexie (IndexedDB: `FreeQuizletDB`, v2)
Файл реализации: `src/lib/db.ts`

1. **`decks`** (Колоды):
   * `id: string` (UUID)
   * `ownerId: string` (Firebase UID или `"local_guest"`)
   * `title: string`
   * `description: string`
   * `isPublic: boolean`
   * `shareCode: string` (короткий 6-значный код для публичного шеринга)
   * `tags?: string[]`
   * `createdAt: number`, `updatedAt: number`
2. **`cards`** (Карточки):
   * `id: string` (UUID)
   * `deckId: string` (FK к `decks.id`)
   * `term: string` (термин / вопрос / лицевая сторона)
   * `definition: string` (определение / ответ / обратная сторона)
   * `hint?: string` (подсказка)
   * `imageData?: string` (Base64 WebP сжатое изображение $\le 40$ КБ)
   * `tags?: string[]`
   * `order: number` (порядок карточки в колоде)
   * `createdAt: number`, `updatedAt: number`
3. **`fsrs_states`** (FSRS-состояние карточки):
   * `id: string` (составной ключ: `${userId}_${cardId}`)
   * `cardId: string`, `deckId: string`, `userId: string`
   * `state: number` (`0: New`, `1: Learning`, `2: Review`, `3: Relearning`)
   * `due: Date | number` (дата/время следующего повторения)
   * `stability: number`, `difficulty: number`
   * `elapsed_days: number`, `scheduled_days: number`
   * `reps: number`, `lapses: number`
   * `last_review?: Date | number | null`
4. **`review_logs`** (История каждого повторения):
   * `id: string`, `cardId: string`, `userId: string`
   * `rating: number` (`1: Again`, `2: Hard`, `3: Good`, `4: Easy`)
   * `elapsedDays: number`, `reviewedAt: number`
5. **`sync_queue`** (Очередь офлайн-синхронизации):
   * `id: string`, `collection: "decks" | "cards" | "fsrs_states"`
   * `docId: string`, `action: "upsert" | "delete"`, `payload?: any`
   * `timestamp: number`, `attempts: number`
6. **`settings`** (Пользовательские настройки):
   * `id: "current"`, `userId: string`
   * `geminiApiKey?: string`, `requestRetention: number` (дефолт 0.9)
   * `theme: "system" | "light" | "dark"`
   * `voiceSpeed: number`, `voiceName?: string`

### 4.2. Облачная база данных Firestore
Файлы реализации: `src/lib/firebase.ts`, `src/lib/sync.ts`, `firestore.rules`.
Проект Firebase: `zinapse-b4d7a`.

* **Коллекции:**
  * `/decks/{deckId}`: Доступны на чтение публично (`isPublic == true`) либо владельцу (`ownerId == auth.uid`). Запись только владельцу.
  * `/cards/{cardId}`: Доступны на чтение, если родительская колода публичная или принадлежит пользователю.
  * `/fsrs_states/{stateId}`: **Строго приватная коллекция** (`userId == auth.uid`).
  * `/review_logs/{logId}`: **Строго приватная коллекция** (`userId == auth.uid`).
  * `/match_scores/{scoreId}`: Мультиплеерный лидерборд игры «Подбор». Разрешено чтение всем для данной колоды, добавление результата с валидацией времени.

---

## 5. Режимы обучения (Study Modes)

Все компоненты расположены в `src/components/study/`:

1. **Карточки (`FlashcardsMode.tsx`, маршрут `/deck/[id]/flashcards`):**
   * 3D-переворот карточки по клику или `Space`.
   * Кнопки FSRS-оценки: `1: Снова`, `2: Трудно`, `3: Хорошо`, `4: Легко` с динамическим расчетом следующего интервала (например: «10 мин», «1 день», «4 дня»).
   * Горячие клавиши (`1–4`, `Стрелки`, `Space`), озвучка (Web Speech TTS).
   * Переключатель **Cram Mode (Быстрая зубрежка)**: позволяет гонять колоду по кругу без изменения постоянных коэффициентов FSRS.
2. **Заучивание (`LearnMode.tsx`, маршрут `/deck/[id]/learn`):**
   * Адаптивное пошаговое прохождение до 100% усвоения.
   * **Этап 1 (Тест):** 4 варианта ответа с умными дистракторами из этой же колоды.
   * **Этап 2 (Письменный ввод):** Ввод ответа руками с нечетким сравнением строк по алгоритму расстояния Левенштейна (`src/lib/levenshtein.ts`) с допуском опечаток и кнопкой апелляции «Засчитать мой ответ».
3. **Подбор (`MatchMode.tsx`, маршрут `/deck/[id]/match`):**
   * Тайм-атака мини-игра. Сетка карточек (термины и определения вперемешку).
   * Высокоточный таймер (шаг 0.1 с). Штраф `+1.0 сек` при неверном выборе.
   * Звуковые эффекты через Web Audio API (`src/lib/sound.ts`).
   * Сохранение лучшего рекорда в локальной БД и синхронизация в глобальный онлайн-лидерборд Firestore (`match_scores`).
4. **Тест (`TestMode.tsx`, маршрут `/deck/[id]/test`):**
   * Конфигуратор тестирования: выбор числа вопросов (5, 10, 20, все) и типов заданий:
     * Тест с выбором вариантов (Multiple Choice)
     * Верно / Неверно (True / False)
     * Письменный ответ (Written)
     * Сопоставление (Matching)
   * Подробный итоговый экран с процентом правильных ответов, списком ошибок и рекомендациями повторить.

---

## 6. AI-генерация колод (`/create-ai` и `/api/generate-deck`)

* **Движок:** `@google/genai` (Google Gemini 3.5 Flash-Lite с автоматическим fallback на `gemini-3.8-flash`).
* **Маршруты:**
  * Фронтенд: `src/app/create-ai/page.tsx` + модалка `src/components/AIGenerateModal.tsx`.
  * Бэкенд: `src/app/api/generate-deck/route.ts`.
* **Функционал:**
  * Генерация из произвольного текста, темы, конспекта или лекции.
  * Drag-and-drop загрузка файлов конспектов `.txt` и `.md`, а также фото/сканов (Multimodal OCR).
  * Выбор уровня сложности (Школа, Университет, Профессиональный) и количества карточек.
  * Поддержка двух режимов ключа API и выбора модели:
    1. Серверный `GEMINI_API_KEY` из окружения приложения.
    2. Пользовательский собственный ключ и модель из настроек (`SettingsModal.tsx`).
  * Строгий JSON-вывод со структурой `{ title, description, cards: [{ term, definition, hint }] }` с автоматическим форматированием формул в LaTeX KaTeX.

---

## 7. Мобильная сборка (Capacitor & Android)

* **Конфигурация:** `capacitor.config.ts`
  * `appId: "com.zinapse.app"`
  * `appName: "Zinapse"`
  * `server.url: "https://zinapse.vercel.app"` (загружает актуальный продакшн-код с поддержкой всех нативных фич)
  * `android.allowMixedContent: true`
* **CI/CD Автосборка:** `.github/workflows/android-build.yml`
  * Срабатывает при пуше в `main` или вручную (`workflow_dispatch`).
  * Среда: Ubuntu Latest, Java 21 Temurin, Android SDK 35/36.
  * Результат сборки: файл `zinapse-debug.apk` публикуется в артефактах GitHub Actions и в релизах.
* **In-App Auto-Update:**
  * `src/lib/updater.ts`: проверяет `https://api.github.com/repos/Zinn1k/zinapse/releases/latest`.
  * Сравнивает семантическую версию с `APP_CURRENT_VERSION = "1.0.0"`.
  * Если доступна новая версия, компонент `AppUpdateNotification.tsx` показывает плашку с changelog и кнопкой мгновенного скачивания нового APK.

---

## 8. Структура проекта (File Tree Map)

```
g:\analog quizlet\
├── .github/
│   └── workflows/
│       └── android-build.yml       # GitHub Actions CI для сборки Android APK
├── android/                        # Android Studio / Gradle проект (Capacitor)
├── public/                         # PWA манифест, иконки, статические ассеты
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate-deck/      # Серверный эндпоинт генерации колод через Gemini
│   │   │       └── route.ts
│   │   ├── create-ai/              # Страница полноэкранной AI-генерации колод
│   │   │   └── page.tsx
│   │   ├── deck/
│   │   │   └── [id]/
│   │   │       ├── edit/page.tsx   # Редактор колоды и карточек
│   │   │       ├── flashcards/     # Режим Карточки (3D-флип, FSRS, Cram)
│   │   │       ├── learn/          # Режим Заучивание (тест + ввод текста)
│   │   │       ├── match/          # Режим Подбор (тайм-атака, лидерборд)
│   │   │       ├── test/           # Режим Тест (4 типа заданий, оценка)
│   │   │       └── page.tsx        # Главная страница колоды (детали, список карточек)
│   │   ├── share/
│   │   │   └── [shareCode]/        # Публичный доступ к колодам по короткому коду
│   │   ├── layout.tsx              # Корневой лэйаут, ServiceWorkerRegister, AppHeader
│   │   ├── page.tsx                # Главная библиотека пользователя (список колод, статы)
│   │   └── manifest.ts             # PWA Web App Manifest конфигурация
│   ├── components/
│   │   ├── study/                  # 4 учебных движка (Flashcards, Learn, Match, Test)
│   │   ├── ui/                     # Radix + Tailwind базовые компоненты (dialog, button, etc.)
│   │   ├── AIGenerateModal.tsx     # Модальное окно быстрой AI-генерации
│   │   ├── AppHeader.tsx           # Верхняя панель (логотип, поиск, синхронизация, профиль)
│   │   ├── AppUpdateNotification.tsx# Баннер автообновления Android APK
│   │   ├── AuthModal.tsx           # Модалка авторизации (Google 1-Click + Email/Pass)
│   │   ├── CardEditorModal.tsx     # Модалка создания/редактирования отдельной карточки
│   │   ├── CreateEditDeckModal.tsx # Создание/редактирование метаданных колоды
│   │   ├── DeckCard.tsx            # Карточка колоды в списке библиотек
│   │   ├── DeckDetailView.tsx      # Детальный вид колоды
│   │   ├── FSRSAnalyticsModal.tsx  # Аналитика удержания памяти и FSRS-графики
│   │   ├── MarkdownMath.tsx        # Компонент рендеринга Markdown и LaTeX через KaTeX
│   │   ├── SettingsModal.tsx       # Настройки (тема, retention rate, свой ключ Gemini)
│   │   └── ZinapseLogo.tsx         # Векторный синаптический логотип
│   └── lib/
│       ├── __tests__/              # Vitest тесты (fsrs, cloze, levenshtein, analytics, etc.)
│       ├── ai.ts                   # Клиентская обертка генерации через Gemini
│       ├── analytics.ts            # Расчет метрик удержания памяти и интервалов FSRS
│       ├── cloze.ts                # Парсинг пропусков слов (Cloze deletion: {{c1::ответ}})
│       ├── db.ts                   # Dexie.js база данных, типы моделей, сидирование данных
│       ├── firebase.ts             # Инициализация Firebase Auth + Firestore с IndexedDB-кешем
│       ├── fsrs.ts                 # Обертка алгоритма ts-fsrs (расчет интервалов, оценок)
│       ├── image-compression.ts    # Сжатие картинок в WebP Base64 <= 40 КБ
│       ├── importer.ts             # Импорт из Quizlet / CSV / TSV / Anki текстов
│       ├── levenshtein.ts          # Расчет расстояния Левенштейна для нечеткого сравнения
│       ├── sound.ts                # Web Audio API синтезатор звуков (клик, успех, ошибка)
│       ├── speech.ts               # Web Speech API синтез речи (TTS озвучка терминов)
│       ├── sync.ts                 # Двусторонняя синхронизация Dexie <-> Firestore
│       ├── updater.ts              # Проверка релизов GitHub для Android APK
│       └── utils.ts                # Хелперы (clsx, twMerge, generateId, generateShareCode)
├── capacitor.config.ts             # Конфиг мобильного приложения Capacitor
├── firestore.rules                 # Production-правила безопасности Cloud Firestore
├── next.config.ts                  # Конфиг Next.js (COOP заголовки для Google Auth, rewrites)
├── package.json                    # Зависимости и npm-скрипты
└── tsconfig.json                   # TypeScript конфиг
```

---

## 9. Важные инженерные соглашения и тонкости (Gotchas)

1. **Next.js 15 App Router & Async Page Props:**
   * В Next.js 15 `params` и `searchParams` в компонентах страниц являются `Promise`. Всегда используйте:
     ```tsx
     interface PageProps {
       params: Promise<{ id: string }>;
     }
     export default async function Page({ params }: PageProps) {
       const { id } = await params;
       // ...
     }
     ```
2. **Google OAuth & COOP Headers (`next.config.ts`):**
   * Для предотвращения ошибки `auth/popup-closed-by-user` и блокировки взаимодействия между окнами Firebase Auth настроен заголовок:
     ```ts
     Cross-Origin-Opener-Policy: same-origin-allow-popups
     ```
   * В `src/lib/firebase.ts` встроена защита: если попап блокируется браузером мобильного устройства или WebView, авторизация автоматически переключается на `signInWithRedirect`.
3. **Хранение изображений карточек:**
   * Категорически **не использовать** платные хранилища файлов.
   * Функция `compressImageToWebP(file)` из `src/lib/image-compression.ts` ужимает картинку до WebP с максимальным размером 40 КБ и отдает `data:image/webp;base64,...`. Строка сохраняется в поле `imageData` объекта `Card`.
4. **Безопасность FSRS-состояний в Firestore:**
   * В `firestore.rules` состояния FSRS (`fsrs_states`) и логи (`review_logs`) жестко привязаны к `request.auth.uid`. Пользователи не могут читать или модифицировать чужие интервалы и историю тренировок.
5. **Тестирование:**
   * Перед любым коммитом или передачей фичи обязательно запускать:
     ```bash
     npm test
     ```
   * Конфигурация Vitest покрывает ключевые критические алгоритмы: FSRS расчеты, Cloze-пропуски, расстояние Левенштейна, парсер импорта и Firebase-хелперы.

---

## 10. Переменные окружения (`.env.local`)

Для полноценной работы необходимы следующие переменные (шаблон в `.env.example`):

```env
# Google Gemini API Key (для генерации колод через ИИ)
GEMINI_API_KEY=AIzaSy...

# Firebase Web App Config (для авторизации и облачной синхронизации)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zinapse-b4d7a.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zinapse-b4d7a
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zinapse-b4d7a.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=88469881505
NEXT_PUBLIC_FIREBASE_APP_ID=1:88469881505:web:3634e1caec75846cca66e0
```

---

## 11. Базовые команды разработки

```bash
# Установка зависимостей
npm install

# Запуск локального сервера разработки (http://localhost:3000)
npm run dev

# Запуск тестов Vitest
npm test

# Сборка production-бандла Next.js
npm run build

# Синхронизация веб-проекта с нативным проектом Android
npx cap sync android

# Открытие Android Studio для сборки/отладки
npx cap open android
```

---

## 12. Текущий статус и бэклог будущих доработок

### ✅ Что уже готово и протестировано:
* 100% Local-first архитектура на Dexie.js (IndexedDB).
* 4 режима обучения: Карточки, Заучивание, Подбор, Тест.
* Алгоритм интервальных повторений FSRS v5 + Cram Mode.
* Генерация колод через Google Gemini 3.5 Flash-Lite / 3.8 Flash с загрузкой файлов конспектов и фото (OCR).
* Облачная синхронизация Firestore + Firebase Authentication (Google 1-click + Email).
* Мультиплеерный лидерборд в реальном времени для режима «Подбор».
* Сжатие изображений в WebP $\le 40$ КБ.
* KaTeX рендеринг математических и физических формул.
* Полная русскоязычная локализация UI.
* Сборка Android APK через Capacitor 8 и GitHub Actions CI/CD.
* Встроенная проверка автообновлений APK через GitHub Releases API.
* Набор unit-тестов Vitest (все 38 тестов пройдены успешно).
* Единая архитектура учебных движков в `src/components/study/` с поддержкой Levenshtein, звуков Web Audio, мультиплеера Firestore и 4 типов тестов.
* Очередь синхронизации `src/lib/sync.ts` с пакетным опустошением и защитой от poison pill.

### 💡 Возможные направления развития (Backlog для нового ИИ):
1. **Экспорт и импорт Anki `.apkg`:** Прямой бинарный парсер пакетов Anki (SQLite + медиа в ZIP) для легкого переезда с Anki.
2. **Голосовой ввод ответов (Speech-to-Text):** Проверка устного ответа через Web Speech Recognition API при заучивании иностранных слов.
3. **Совместное редактирование колод (Коллаборация):** Возможность добавлять соавторов по email к приватной колоде.
4. **Виджеты на рабочий стол Android:** Нативный Android-виджет через Capacitor для отображения количества карточек, запланированных на сегодня.
