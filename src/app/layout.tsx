import type { ReactNode } from "react";
import type { Metadata } from "next";

import AppThemeProvider from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "B Board",
  description: "Lightweight agile board and backlog manager.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
