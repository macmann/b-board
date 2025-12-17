import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function AgingIssuesPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Aging issues"
      description="Identify work that has stalled across projects regardless of sprint cadence."
      placeholderLabel="Aging issues"
      placeholderDetail="See how aging work is distributed and where to intervene."
      reportKey="agingIssues"
    />
  );
}
