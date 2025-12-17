import ProjectStatusOverviewReport from "@/components/reports/ProjectStatusOverviewReport";
import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function ProjectStatusOverviewPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Project status overview"
      description="Portfolio snapshot of project health, blockers, and lead time without sprint assumptions."
      placeholderLabel="Project status overview"
      placeholderDetail="This module aggregates project health and blockers across your workspace."
      renderContent={(filters) => <ProjectStatusOverviewReport filters={filters} />}
    />
  );
}
