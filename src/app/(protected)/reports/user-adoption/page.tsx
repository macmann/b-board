import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function UserAdoptionReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="User adoption"
      description="Workspace adoption signals for admins and leadership: reach, engagement, and acknowledgement trends."
      placeholderLabel="User adoption metrics"
      placeholderDetail="Track active usage, update coverage, and responsiveness across your portfolio."
      reportKey="userAdoption"
    />
  );
}
