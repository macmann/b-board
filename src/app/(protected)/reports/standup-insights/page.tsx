import ReportPageLayout from "@/components/reports/ReportPageLayout";
import StandupInsightsReport from "@/components/reports/StandupInsightsReport";

import { requireLeadershipUser } from "../reportAccess";

export default async function StandupInsightsReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Standup insights"
      description="Summarize daily updates to highlight progress, risks, and help needed across teams."
      placeholderLabel="Standup insights chart placeholder"
      placeholderDetail="Aggregated standup signals will be visualized here to call out trends and blockers raised in daily updates."
      renderContent={(filters) => <StandupInsightsReport filters={filters} />}
    />
  );
}
