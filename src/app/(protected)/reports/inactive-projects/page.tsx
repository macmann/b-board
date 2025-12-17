import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function InactiveProjectsPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Inactive projects"
      description="Surface projects without recent activity so leaders can decide whether to pause or re-staff."
      placeholderLabel="Inactive projects"
      placeholderDetail="Portfolio view of stalled projects and time since last movement."
      reportKey="inactiveProjects"
    />
  );
}
