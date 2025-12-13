import type { ReactNode } from "react";

import Logo from "../branding/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <Logo subtitle="Plan and ship with confidence" className="mb-6" />

        <div className="mb-6 space-y-2">
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        </div>

        {children}
      </div>
    </main>
  );
}
