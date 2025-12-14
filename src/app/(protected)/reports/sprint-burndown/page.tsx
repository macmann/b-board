import ReportPageLayout from "@/components/reports/ReportPageLayout";
import SprintBurndownChart from "@/components/reports/SprintBurndownChart";

import { requireLeadershipUser } from "../reportAccess";

export default async function SprintBurndownReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Sprint burndown"
      description="Visualize remaining work against time to catch schedule risk early."
      showSprintSelect
      placeholderLabel="Burndown chart placeholder"
      placeholderDetail="This chart will plot remaining story points per day to show whether the team is trending toward completion."
      renderContent={(filters) => <SprintBurndownChart filters={filters} />}
    />
  );
}
