import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function RoleDistributionReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Role distribution"
      description="Workforce mix across the portfolio to guide staffing, governance, and coverage decisions."
      placeholderLabel="Role distribution"
      placeholderDetail="See contributors by role across projects without assuming common team structures."
      reportKey="roleDistribution"
    />
  );
}
