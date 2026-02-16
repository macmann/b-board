"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type NotificationItem = {
  id: string;
  triggerId: string;
  relatedEntityId: string | null;
  type: "PERSISTENT_BLOCKER" | "MISSING_STANDUP" | "UNANSWERED_QUESTION" | "ACTION_OVERDUE" | "ESCALATION";
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  body: string;
  status: "UNREAD" | "READ" | "DISMISSED";
  createdAt: string;
  trigger: { projectId: string };
};

type Props = {
  projectId?: string;
};

const GROUPS: Array<{ title: string; types: NotificationItem["type"][] }> = [
  { title: "Blockers", types: ["PERSISTENT_BLOCKER"] },
  { title: "Questions", types: ["UNANSWERED_QUESTION"] },
  { title: "Missing standups", types: ["MISSING_STANDUP"] },
  { title: "Escalations", types: ["ACTION_OVERDUE", "ESCALATION"] },
];

export default function ExecutionAlertsPageClient({ projectId }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { notifications: NotificationItem[] };
        setNotifications(data.notifications ?? []);
      })
      .catch(() => undefined);
  }, [projectId]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: notifications.filter((item) => group.types.includes(item.type)),
      })),
    [notifications]
  );

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <section key={group.title} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{group.title}</h2>
          <div className="space-y-3">
            {group.items.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No alerts in this group.</p>
            ) : (
              group.items.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                  {item.relatedEntityId && (
                    <Link href={`/issues/${item.relatedEntityId}`} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
                      Link to evidence
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
