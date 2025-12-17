import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function BlockerAggregationPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Blocker aggregation"
      description="Portfolio-level blocker themes to guide leadership intervention and sequencing."
      placeholderLabel="Blocker aggregation"
      placeholderDetail="Aggregate blockers across projects to identify systemic impediments."
      reportKey="blockerAggregation"
    />
  );
}
