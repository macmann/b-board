import AuditLogList from "@/components/audit/AuditLogList";

type AuditSecurityTabProps = {
  isAdmin: boolean;
  projectId: string;
};

export default function AuditSecurityTab({
  isAdmin,
  projectId,
}: AuditSecurityTabProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Audit & Security
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Track changes across this project with before/after context.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <AuditLogList
          fetchUrl={`/api/projects/${projectId}/audit-logs`}
          emptyMessage="No audit entries yet for this project."
        />
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only admins and product owners can view the audit log.
        </p>
      )}
    </section>
  );
}
