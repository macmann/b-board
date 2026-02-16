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

type Preferences = {
  mutedCategories: Array<"BLOCKERS" | "QUESTIONS" | "STANDUPS" | "OVERDUE_ACTIONS">;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezoneOffsetMinutes: number;
  maxNudgesPerDay: number;
  channels: Array<"IN_APP">;
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

const defaultPreferences: Preferences = {
  mutedCategories: [],
  quietHoursStart: null,
  quietHoursEnd: null,
  timezoneOffsetMinutes: 0,
  maxNudgesPerDay: 5,
  channels: ["IN_APP"],
};

export default function ExecutionAlertsPageClient({ projectId }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}/coordination-preferences`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { preferences?: Preferences };
        if (data.preferences) setPreferences(data.preferences);
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

  const toggleMutedCategory = (category: Preferences["mutedCategories"][number]) => {
    setPreferences((current) => ({
      ...current,
      mutedCategories: current.mutedCategories.includes(category)
        ? current.mutedCategories.filter((item) => item !== category)
        : [...current.mutedCategories, category],
    }));
  };

  const savePreferences = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/coordination-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { preferences: Preferences };
      setPreferences(data.preferences);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {projectId && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Nudge preferences</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["BLOCKERS", "Mute blocker nudges"],
              ["QUESTIONS", "Mute unanswered question nudges"],
              ["STANDUPS", "Mute missing standup nudges"],
              ["OVERDUE_ACTIONS", "Mute overdue action nudges"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={preferences.mutedCategories.includes(value as Preferences["mutedCategories"][number])}
                  onChange={() => toggleMutedCategory(value as Preferences["mutedCategories"][number])}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm text-slate-700 dark:text-slate-200">
              Quiet start (hour)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                type="number"
                min={0}
                max={23}
                value={preferences.quietHoursStart ?? ""}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    quietHoursStart: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm text-slate-700 dark:text-slate-200">
              Quiet end (hour)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                type="number"
                min={0}
                max={23}
                value={preferences.quietHoursEnd ?? ""}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    quietHoursEnd: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm text-slate-700 dark:text-slate-200">
              Timezone offset minutes
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                type="number"
                min={-720}
                max={840}
                value={preferences.timezoneOffsetMinutes}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    timezoneOffsetMinutes: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm text-slate-700 dark:text-slate-200">
              Max nudges / day
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                type="number"
                min={1}
                max={20}
                value={preferences.maxNudgesPerDay}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    maxNudgesPerDay: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Channel: in-app notifications only (email/SMS not enabled yet).</p>
          <button
            type="button"
            onClick={() => void savePreferences()}
            disabled={saving}
            className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </section>
      )}

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
