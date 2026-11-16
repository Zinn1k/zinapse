"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Smartphone,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendResetPassword,
  getFirebaseErrorMessage,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { ZinapseLogo } from "@/components/ZinapseLogo";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthMode = "login" | "register" | "forgot";

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setSuccessMessage(null);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!isFirebaseConfigured()) {
        setError(
          "Облачная база ещё не подключена. Внесите ключи Firebase в .env.local для живой авторизации."
        );
        setIsLoading(false);
        return;
      }
      await signInWithGoogle();
      setSuccessMessage("Успешный вход через Google!");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError("Укажите адрес электронной почты.");
      return;
    }

    if (!isFirebaseConfigured()) {
      setError(
        "Сервис Firebase ещё не подключён ключами в .env.local. Форма авторизации готова к работе сразу после добавления ключей!"
      );
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "forgot") {
        await sendResetPassword(email);
        setSuccessMessage(
          `Инструкция по восстановлению пароля отправлена на почту ${email}.`
        );
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Пароль должен содержать не менее 6 символов.");
        setIsLoading(false);
        return;
      }

      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Пароли не совпадают. Пожалуйста, проверьте ввод.");
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
        setSuccessMessage("Аккаунт успешно создан! Синхронизация активирована.");
      } else {
        await signInWithEmail(email, password);
        setSuccessMessage("Успешный вход в аккаунт!");
      }

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <ZinapseLogo size={36} className="w-9 h-9 shadow-md shadow-indigo-500/20 rounded-xl" />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg text-zinc-900 dark:text-white">
                  Zinapse
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Cloud Sync
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Единый аккаунт для сайта и Android
              </p>
            </div>
          </div>

          {/* Sync advantages mini-card */}
          <div className="mt-3 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1.5">
            <div className="flex items-center space-x-2 font-medium text-indigo-900 dark:text-indigo-200">
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Сквозная синхронизация с мобильным приложением</span>
            </div>
            <div className="flex items-center space-x-2 font-medium text-zinc-600 dark:text-zinc-300">
              <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Офлайн-сохранение и резервная копия всех колод</span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs (Login / Register) */}
        {mode !== "forgot" && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`py-2 rounded-lg transition-all ${
                  mode === "register"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Создать аккаунт
              </button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`py-2 rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Войти в аккаунт
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Status Banners */}
          {error && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* 1-Click Google OAuth */}
          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Продолжить с Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
                <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  или по email
                </span>
                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Ваше имя (необязательно)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Александр"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Электронная почта
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Пароль
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Не менее 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Подтвердите пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Подождите...</span>
                </>
              ) : mode === "register" ? (
                <>
                  <span>Зарегистрироваться</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : mode === "login" ? (
                <>
                  <span>Войти в Zinapse</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <span>Отправить ссылку для сброса</span>
              )}
            </button>
          </form>

          {/* Forgot Mode Return Link */}
          {mode === "forgot" && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Вернуться ко входу
              </button>
            </div>
          )}

          {/* Footer Terms */}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              100% бесплатно • Никаких скрытых подписок • Все данные в безопасности
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
