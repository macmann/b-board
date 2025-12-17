import CrossProjectIssueStatusReport from "@/components/reports/CrossProjectIssueStatusReport";
import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function CrossProjectIssuesPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Cross-project issue status"
      description="Status mix across projects to spotlight flow risk and throughput without sprint coupling."
      placeholderLabel="Cross-project issue status"
      placeholderDetail="Stacked distribution of backlog, in progress, blocked, and done work across your portfolio."
      renderContent={(filters) => <CrossProjectIssueStatusReport filters={filters} />}
    />
  );
}
