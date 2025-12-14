import ReportPageLayout from "@/components/reports/ReportPageLayout";
import VelocityTrendChart from "@/components/reports/VelocityTrendChart";

import { requireLeadershipUser } from "../reportAccess";

export default async function VelocityTrendReportPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Velocity trend"
      description="Monitor how much work the team completes each sprint to inform forecasting."
      placeholderLabel="Velocity trend chart placeholder"
      placeholderDetail="This view will display velocity by sprint to highlight momentum shifts and support capacity planning."
      renderContent={(filters) => <VelocityTrendChart filters={filters} />}
    />
  );
}
