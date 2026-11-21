import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppUpdateNotification } from "@/components/AppUpdateNotification";
import { getThemeInitScript } from "@/lib/theme";

// Inter has a full Cyrillic set, which Geist lacks — the Russian UI would
// otherwise fall back to the OS font mid-sentence.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zinapse — бесплатный аналог Quizlet с FSRS и AI",
    template: "%s · Zinapse",
  },
  description:
    "Local-first карточки с алгоритмом интервального повторения FSRS, формулами KaTeX и генерацией колод через Gemini. Работает офлайн, данные хранятся на устройстве.",
  applicationName: "Zinapse",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zinapse",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#08080c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-ink">
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
          >
            Перейти к содержимому
          </a>
          <ServiceWorkerRegister />
          <AppUpdateNotification />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
