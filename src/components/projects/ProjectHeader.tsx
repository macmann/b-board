"use client";

import { useEffect, useMemo, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ProjectHeaderProps = {
  projectName: string;
  projectKey: string;
  projectDescription?: string | null;
  projectIconUrl?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  roleLabel?: string | null;
  className?: string;
};

export default function ProjectHeader({
  projectName,
  projectKey,
  projectDescription,
  projectIconUrl,
  currentUserName,
  currentUserEmail,
  roleLabel,
  className,
}: ProjectHeaderProps) {
  const displayName = currentUserName || "You";
  const displayEmail = currentUserEmail || "";
  const displayRole = roleLabel || "Member";
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    setIconError(false);
  }, [projectIconUrl]);

  const fallbackInitial = useMemo(() => {
    const source = projectKey || projectName;
    return source ? source.charAt(0).toUpperCase() : "?";
  }, [projectKey, projectName]);

  const shouldShowIcon = Boolean(projectIconUrl && !iconError);

  return (
    <div
      className={`mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {shouldShowIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={projectIconUrl ?? undefined}
              alt={`${projectName} icon`}
              className="h-full w-full object-cover"
              onError={() => setIconError(true)}
            />
          ) : (
            <span>{fallbackInitial}</span>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {projectKey} · {projectName}
          </div>
          {projectDescription && (
            <div className="markdown-content text-sm text-slate-500 dark:text-slate-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {projectDescription}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      <div className="text-right text-sm text-slate-600 dark:text-slate-300">
        <div className="font-semibold text-slate-900 dark:text-slate-50">{displayName}</div>
        {displayEmail && <div>{displayEmail}</div>}
        <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
          Role: {displayRole}
        </div>
      </div>
    </div>
  );
}
