import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function DeliveryHealthPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Delivery health"
      description="Aggregate throughput, predictability, and lead time trends without relying on shared sprints."
      placeholderLabel="Delivery health"
      placeholderDetail="This module surfaces portfolio delivery signals that work across varied cadences."
      reportKey="deliveryHealth"
    />
  );
}
