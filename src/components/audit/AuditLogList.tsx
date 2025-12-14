"use client";

import { useEffect, useMemo, useState } from "react";

type AuditLog = {
  id: string;
  projectId: string | null;
  actorType: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: string;
};

type AuditLogResponse = {
  logs: AuditLog[];
  page: number;
  pageSize: number;
  total: number;
};

type AuditLogListProps = {
  fetchUrl: string;
  emptyMessage?: string;
};

export default function AuditLogList({ fetchUrl, emptyMessage }: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [actorType, setActorType] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

        if (actorType !== "ALL") params.set("actorType", actorType);
        if (actionFilter.trim()) params.set("action", actionFilter.trim());
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);

        const response = await fetch(`${fetchUrl}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setError("Unable to load audit logs");
          setLogs([]);
          setTotal(0);
          return;
        }

        const data = (await response.json()) as AuditLogResponse;
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Unable to load audit logs");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, [fetchUrl, page, pageSize, actorType, actionFilter, fromDate, toDate]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Actor
          </label>
          <select
            value={actorType}
            onChange={(event) => {
              setPage(1);
              setActorType(event.target.value);
            }}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="ALL">All</option>
            <option value="USER">User</option>
            <option value="SYSTEM">System</option>
            <option value="AI">AI</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Action
          </label>
          <input
            type="text"
            value={actionFilter}
            onChange={(event) => {
              setPage(1);
              setActionFilter(event.target.value);
            }}
            placeholder="Filter"
            className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPage(1);
              setFromDate(event.target.value);
            }}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setPage(1);
              setToDate(event.target.value);
            }}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading audit logs...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{emptyMessage ?? "No audit entries yet."}</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log, index) => (
            <li key={log.id} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="absolute left-[-14px] top-5 h-3 w-3 rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
              {index !== logs.length - 1 && (
                <div className="absolute left-[-8px] top-7 h-full w-px bg-slate-200 dark:bg-slate-800" aria-hidden />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {log.actorName ?? log.actorType}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{log.action}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{log.summary}</p>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <p>{new Date(log.createdAt).toLocaleString()}</p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-primary hover:underline"
                    onClick={() => toggleExpanded(log.id)}
                  >
                    {expanded[log.id] ? "Hide details" : "View details"}
                  </button>
                </div>
              </div>
              {expanded[log.id] && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Before
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                      {log.before ? JSON.stringify(log.before, null, 2) : "—"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      After
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                      {log.after ? JSON.stringify(log.after, null, 2) : "—"}
                    </pre>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {logs.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>
            Page {page} of {totalPages} ({total} records)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
