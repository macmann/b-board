import ExecutionAlertsPageClient from "@/components/notifications/ExecutionAlertsPageClient";

export default function ExecutionAlertsPage() {
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Execution Alerts</h1>
      <ExecutionAlertsPageClient />
    </div>
  );
}
