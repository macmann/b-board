import { redirect } from "next/navigation";

import ReportCard, { reportModules } from "@/components/reports/ReportCard";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { Role } from "@/lib/prismaEnums";
import { routes } from "@/lib/routes";

export default async function ReportsPage() {
  const { user } = await getCurrentProjectContext();

  if (!user) {
    redirect(routes.login());
  }

  const isLeadership = user.role === Role.ADMIN || user.role === Role.PO;

  if (!isLeadership) {
    redirect(routes.myProjects());
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Reports</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Workspace and portfolio reporting for admins and product owners. Explore adoption, governance, and delivery health
          without assuming synchronized sprints.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reportModules.map((module) => (
          <ReportCard key={module.key} module={module} scope="workspace" ctaHref={module.href} />
        ))}
      </div>
    </div>
  );
}
