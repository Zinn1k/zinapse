# Zinapse — Free Quizlet Analog (Local-First PWA)

Современный, бесплатный и полностью автономный Local-First аналог Quizlet для эффективного запоминания информации на базе научно обоснованного алгоритма интервальных повторений **FSRS** (*Free Spaced Repetition Scheduler*), искусственного интеллекта **Google Gemini 2.5 Flash** и облачной синхронизации **Firebase** (бесплатный тариф Spark Plan).

---

## ⚡ Ключевые возможности

- 🚀 **Local-First архитектура (0ms UI):** Все операции чтения, создания и тренировки выполняются мгновенно в локальной базе данных браузера **Dexie.js (IndexedDB)**. Приложение работает на 100% офлайн даже в самолете или метро.
- 🧠 **Движок FSRS (ts-fsrs):** Продвинутый алгоритм расчета оптимальных интервалов повторений (эффективнее классического SM-2). Отдельный режим **Cram Mode (Быстрая зубрежка)** для подготовки перед экзаменом без искажения долгосрочных весов FSRS.
- 🤖 **AI-генерация колод (`/create-ai`):** Генерация колод из конспектов, учебников и лекций через официальный SDK `@google/genai` с поддержкой перетаскивания файлов `.txt` и `.md`, выбором стиля и уровня сложности.
- 📐 **Математика и наука (LaTeX + KaTeX):** Полноценный рендеринг математических, физических и химических формул (`$E=mc^2$` и `$$\int f(x)dx$$`).
- 🔊 **Озвучка (TTS):** Озвучивание терминов и определений на русском и английском через Web Speech API без обращений к платным облачным сервисам.
- 👥 **Шеринг и мультиплеер:**
  - Короткие ссылки на колоды: `/share/[shareCode]`.
  - Возможность проходить чужие колоды без авторизации либо в 1 клик скопировать в свою библиотеку (с чистым FSRS-прогрессом).
  - Онлайн-лидерборд в реальном времени в игре «Подбор» (`match_scores` по `onSnapshot`).
- 📱 **Progressive Web App (PWA):** Установка на домашний экран iOS/Android/Windows («На экран Домой») с Service Worker кешированием.

---

## 🎮 4 Режима обучения

1. **Карточки (`/deck/[id]/flashcards`):**
   - 3D-переворот карточки по клику или `Space`.
   - Оценки FSRS (`1: Снова`, `2: Трудно`, `3: Хорошо`, `4: Легко`) с расчетом интервалов.
   - Свайпы на мобильных устройствах и горячие клавиши `1–4` / `Стрелки`.
2. **Заучивание (`/deck/[id]/learn`):**
   - Адаптивная сессия до 100% усвоения.
   - Этап 1: тест из 4 вариантов с дистракторами.
   - Этап 2: письменный ввод термина с проверкой опечаток по алгоритму Левенштейна и кнопкой «Засчитать мой ответ».
3. **Подбор (`/deck/[id]/match`):**
   - Сетка из 12 плиток (6 пар термин–определение).
   - Высокоточный таймер (0.1с), штраф `+1.0с` за неверную пару и звуковые эффекты (Web Audio API).
   - Живой онлайн-лидерборд друзей (Firebase) + локальная таблица рекордов.
4. **Тест (`/deck/[id]/test`):**
   - Выбор количества вопросов (5, 10, 20, Все) и 4 типов заданий (Выбор варианта, Верно/Неверно, Письменный ввод, Сопоставление).
   - Детальный разбор ошибок и результатов.

---

## 🛠 Технологический стек

- **Фреймворк:** Next.js 15 (App Router), React 19, TypeScript (strict)
- **Стилизация:** Tailwind CSS v4, Lucide React, Framer Motion
- **Локальная БД:** Dexie.js (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`)
- **Алгоритм повторений:** `ts-fsrs`
- **Искусственный интеллект:** `@google/genai` (Google Gemini 2.5 Flash)
- **Облако и Auth:** Firebase (Authentication + Cloud Firestore на бесплатном Spark Plan)
- **Формулы:** `katex`, `remark-math`, `rehype-katex`

---

## ⚙️ Установка и локальный запуск

1. **Клонируйте репозиторий и установите зависимости:**
   ```bash
   npm install
   ```

2. **Создайте файл `.env.local`** (скопируйте из `.env.example`):
   ```bash
   cp .env.example .env.local
   ```

3. **Заполните переменные окружения в `.env.local`:**
   ```env
   # Google Gemini API Key (бесплатно в https://aistudio.google.com/app/apikey)
   GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

   # Firebase Web App Config (бесплатно в https://console.firebase.google.com/)
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyYourFirebaseApiKey
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

4. **Запустите сервер разработки:**
   ```bash
   npm run dev
   ```
   Откройте [http://localhost:3000](http://localhost:3000) в браузере.

---

## 🔒 Правила безопасности Firestore (`firestore.rules`)

В корне проекта подготовлен production-grade файл [`firestore.rules`](./firestore.rules):
- **Принцип разделения данных:** Персональный прогресс (`fsrs_states`) и логи повторений (`review_logs`) доступны **только** их владельцу (`request.auth.uid == resource.data.userId`).
- **Публичные колоды:** Коллекция `decks` и `cards` открыты на чтение, если `isPublic == true`, либо для зарегистрированного владельца.
- **Мультиплеерный лидерборд:** Коллекция `match_scores` доступна для чтения всем пользователям колоды, а создание записей разрешено авторизованным игрокам со строгой валидацией полей и числового диапазона времени.
- **Default Deny:** Любые неописанные пути и операции строго запрещены (`match /{document=**} { allow read, write: if false; }`).

### Развертывание правил в Firebase:
Установите Firebase CLI и задеплойте правила:
```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```
Либо скопируйте содержимое `firestore.rules` напрямую в [Firebase Console](https://console.firebase.google.com/) $\rightarrow$ Firestore Database $\rightarrow$ вкладка **Rules**.

---

## 🚀 Бесплатный деплой

### 1. Деплой на Vercel (Рекомендуется)
1. Загрузите проект в репозиторий GitHub / GitLab.
2. Перейдите на [vercel.com](https://vercel.com/) и нажмите **Add New Project**.
3. Добавьте переменные окружения из `.env.local` (`GEMINI_API_KEY`, `NEXT_PUBLIC_FIREBASE_*`).
4. Нажмите **Deploy**. Проект соберется автоматически.

Либо через Vercel CLI:
```bash
npm install -g vercel
vercel
```

### 2. Деплой на Cloudflare Pages
1. В настройках Cloudflare Pages выберите сборщик **Next.js**.
2. Команда сборки: `npm run build`.
3. Папка вывода: `.vercel/output/static` (или используйте `@cloudflare/next-on-pages`).
4. Добавьте переменные окружения в разделе **Settings $\rightarrow$ Environment variables**.

---

## 📱 Установка как PWA

1. Откройте развернутое приложение в браузере (Safari на iOS, Chrome на Android / Windows / macOS).
2. Нажмите **Поделиться** $\rightarrow$ **«На экран Домой»** (iOS) либо иконку установки в адресной строке Chrome.
3. Приложение откроется в отдельном окне без адресной строки и будет доступно офлайн через встроенный Service Worker.
