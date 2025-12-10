type ProjectHeaderProps = {
  projectName: string;
  projectKey: string;
  projectDescription?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  roleLabel?: string | null;
  className?: string;
};

export default function ProjectHeader({
  projectName,
  projectKey,
  projectDescription,
  currentUserName,
  currentUserEmail,
  roleLabel,
  className,
}: ProjectHeaderProps) {
  const displayName = currentUserName || "You";
  const displayEmail = currentUserEmail || "";
  const displayRole = roleLabel || "Member";

  return (
    <div
      className={`mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="space-y-1">
        <div className="text-lg font-semibold text-slate-900">
          {projectKey} · {projectName}
        </div>
        {projectDescription && (
          <p className="text-sm text-slate-500">{projectDescription}</p>
        )}
      </div>

      <div className="text-right text-sm text-slate-600">
        <div className="font-semibold text-slate-900">{displayName}</div>
        {displayEmail && <div>{displayEmail}</div>}
        <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700">
          Role: {displayRole}
        </div>
      </div>
    </div>
  );
}
