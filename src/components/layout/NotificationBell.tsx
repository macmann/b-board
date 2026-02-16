"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { routes } from "@/lib/routes";

type NotificationItem = {
  id: string;
  triggerId: string;
  relatedEntityId: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  body: string;
  status: "UNREAD" | "READ" | "DISMISSED";
  createdAt: string;
  trigger: { projectId: string };
};

const severityClass: Record<NotificationItem["severity"], string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  HIGH: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => items.filter((item) => item.status === "UNREAD").length, [items]);

  const fetchNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { notifications: NotificationItem[] };
    setItems(data.notifications ?? []);
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const updateStatus = async (notificationId: string, action: "read" | "dismiss") => {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) return;

    setItems((current) =>
      current.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              status: action === "dismiss" ? "DISMISSED" : "READ",
            }
          : item
      )
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[26rem] rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-300">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityClass[item.severity]}`}>
                      {item.severity}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{item.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {item.relatedEntityId && (
                      <Link className="text-primary underline-offset-2 hover:underline" href={`/issues/${item.relatedEntityId}`}>
                        Link to evidence
                      </Link>
                    )}
                    <button type="button" className="text-slate-600 hover:text-slate-900" onClick={() => updateStatus(item.id, "read")}>
                      Mark as read
                    </button>
                    <button type="button" className="text-rose-600 hover:text-rose-700" onClick={() => updateStatus(item.id, "dismiss")}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 border-t border-slate-200 px-2 pt-2 dark:border-slate-700">
            <Link href={routes.executionAlerts()} className="text-xs font-medium text-primary hover:underline">
              Open Execution Alerts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
