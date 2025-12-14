import BlockerThemesReport from "@/components/reports/BlockerThemesReport";
import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function BlockerThemesReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Blocker themes"
      description="Aggregate blockers to reveal recurring impediments slowing delivery."
      placeholderLabel="Blocker themes chart"
      placeholderDetail="Blocker patterns and examples will render here to guide coaching and process improvements."
      renderContent={(filters) => <BlockerThemesReport filters={filters} />}
    />
  );
}
