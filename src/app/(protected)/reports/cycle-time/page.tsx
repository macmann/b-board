import CycleTimeReport from "@/components/reports/CycleTimeReport";
import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function CycleTimeReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Cycle time"
      description="Measure how long work takes from start to finish to surface bottlenecks."
      placeholderLabel="Cycle time chart placeholder"
      placeholderDetail="Cycle time distributions will appear here to spotlight wait states and opportunities to streamline delivery."
      renderContent={(filters) => <CycleTimeReport filters={filters} />}
    />
  );
}
