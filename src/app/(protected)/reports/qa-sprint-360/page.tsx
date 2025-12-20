import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function QASprint360ReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="QA Sprint 360"
      description="Workspace view of sprint QA readiness, execution results, and open bugs by project."
      placeholderLabel="QA Sprint 360"
      placeholderDetail="Latest sprint QA coverage and defect follow-up across your projects."
      reportKey="qaSprint360"
    />
  );
}
