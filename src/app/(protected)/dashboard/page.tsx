import { redirect } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { Role } from "@/lib/prismaEnums";

export default async function DashboardPage() {
  const { user } = await getCurrentProjectContext();

  if (!user) {
    redirect("/login");
  }

  const isLeadership = user.role === Role.ADMIN || user.role === Role.PO;

  if (!isLeadership) {
    redirect("/my-projects");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Leadership insights will live here soon. For now, use this space to keep an eye on your workspace.
        </p>
      </div>
    </div>
  );
}
