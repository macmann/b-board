import DeliveryHealthSummaryReport from "@/components/reports/DeliveryHealthSummaryReport";
import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function DeliveryHealthSummaryPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Delivery health summary"
      description="Aggregate throughput, predictability, and lead time trends without relying on shared sprints."
      placeholderLabel="Delivery health summary"
      placeholderDetail="This module surfaces portfolio delivery signals that work across varied cadences."
      renderContent={(filters) => <DeliveryHealthSummaryReport filters={filters} />}
    />
  );
}
