import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
            MJ
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Mini Jira</span>
            <span className="text-xs text-slate-500">Plan and ship with confidence</span>
          </div>
        </div>

        <div className="mb-6 space-y-2">
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>

        {children}
      </div>
    </main>
  );
}
