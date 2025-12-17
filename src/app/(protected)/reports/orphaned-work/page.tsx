import ReportPageLayout from "@/components/reports/ReportPageLayout";

import { requireLeadershipUser } from "../reportAccess";

export default async function OrphanedWorkPage() {
  await requireLeadershipUser();

  return (
    <ReportPageLayout
      title="Orphaned work"
      description="Detect unassigned, stalled, or unaligned items across the workspace for rapid cleanup."
      placeholderLabel="Orphaned work"
      placeholderDetail="Find unowned or disconnected work items so teams can re-align."
      reportKey="orphanedWork"
    />
  );
}
