import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Firebase config from environment variables (Spark Plan friendly: Auth + Firestore only, zero paid storage)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let dbFirestore: Firestore | null = null;

if (typeof window !== "undefined" && isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);

    try {
      // Enable multi-tab persistent offline IndexedDB cache for Firestore
      dbFirestore = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Fallback if already initialized
      dbFirestore = getFirestore(app);
    }
  } catch (error) {
    console.warn("Failed to initialize Firebase:", error);
  }
}

export { app, auth, dbFirestore };

/**
 * 1-click Google Sign-in
 */
export async function signInWithGoogle(): Promise<User | null> {
  if (!auth) {
    throw new Error(
      "Firebase не настроен. Укажите ключи NEXT_PUBLIC_FIREBASE_* в файле .env.local"
    );
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

/**
 * Anonymous / Guest sign-in for viewing public decks without an account
 */
export async function signInAsGuest(): Promise<User | null> {
  if (!auth) {
    return null;
  }
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  if (auth) {
    await firebaseSignOut(auth);
  }
}

/**
 * Email & Password Registration
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<User> {
  if (!auth) {
    throw new Error(
      "Firebase не настроен. Добавьте ключи NEXT_PUBLIC_FIREBASE_* в .env.local"
    );
  }
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    } catch {
      // ignore
    }
  }
  return credential.user;
}

/**
 * Email & Password Sign-in
 */
export async function signInWithEmail(
  email: string,
  pass: string
): Promise<User> {
  if (!auth) {
    throw new Error(
      "Firebase не настроен. Добавьте ключи NEXT_PUBLIC_FIREBASE_* в .env.local"
    );
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

/**
 * Send Password Reset Email
 */
export async function sendResetPassword(email: string): Promise<void> {
  if (!auth) {
    throw new Error(
      "Firebase не настроен. Добавьте ключи NEXT_PUBLIC_FIREBASE_* в .env.local"
    );
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Maps Firebase auth error codes to friendly Russian error messages
 */
export function getFirebaseErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Произошла неизвестная ошибка.";
  const code = "code" in err ? String(err.code) : "";
  const message = "message" in err ? String(err.message) : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Пользователь с таким email уже зарегистрирован. Попробуйте войти.";
    case "auth/invalid-email":
      return "Введён некорректный адрес электронной почты.";
    case "auth/operation-not-allowed":
      return "Этот метод входа отключён в настройках проекта Firebase.";
    case "auth/weak-password":
      return "Пароль слишком простой. Придумайте пароль длиной не менее 6 символов.";
    case "auth/user-disabled":
      return "Данная учётная запись заблокирована администратором.";
    case "auth/user-not-found":
      return "Пользователь с таким email не найден.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Неверный email или пароль.";
    case "auth/too-many-requests":
      return "Слишком много неудачных попыток входа. Попробуйте позже или сбросьте пароль.";
    case "auth/popup-closed-by-user":
      return "Окно входа Google было закрыто до завершения авторизации.";
    case "auth/network-request-failed":
      return "Ошибка сети. Проверьте интернет-соединение.";
    default:
      return message || "Ошибка при обращении к сервису авторизации.";
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
