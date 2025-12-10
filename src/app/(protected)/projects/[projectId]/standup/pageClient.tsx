"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Button from "@/components/ui/Button";
import { ProjectRole } from "@/lib/roles";

type StandupIssue = {
  id: string;
  key?: string | null;
  title: string;
  assignee?: { id: string; name: string | null } | null;
  status?: string | null;
};

type StandupEntry = {
  id: string;
  date: string;
  summaryToday: string | null;
  progressSinceYesterday: string | null;
  blockers: string | null;
  dependencies: string | null;
  notes: string | null;
  isComplete: boolean;
  issues: { issue: StandupIssue }[];
};

type StandupEntryWithUser = StandupEntry & {
  user: { id: string; name: string; email: string | null };
};

type StandupSummaryMember = {
  userId: string;
  name: string;
  role: string;
  status: "submitted" | "missing";
  isComplete: boolean;
  entryId: string | null;
  date: string | null;
  issues: StandupIssue[];
};

type StandupSummaryResponse = {
  date: string | null;
  startDate: string | null;
  endDate: string | null;
  members: StandupSummaryMember[];
  totalEntries: number;
};

type StandupFormState = {
  summaryToday: string;
  progressSinceYesterday: string;
  blockers: string;
  dependencies: string;
  notes: string;
};

type ToastMessage = {
  id: string;
  type: "success" | "error" | "warning";
  message: string;
};

const toDateInput = (date: Date) => date.toISOString().split("T")[0];

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDisplayDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getMyStandupEntryForDate = async (projectId: string, date: string) => {
  const response = await fetch(
    `/api/projects/${projectId}/standup/my?date=${encodeURIComponent(date)}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup entry");
  }

  return (await response.json()) as StandupEntry | null;
};

const upsertMyStandupEntry = async (
  projectId: string,
  payload: {
    date: string;
    summaryToday: string | null;
    progressSinceYesterday: string | null;
    blockers: string | null;
    dependencies: string | null;
    notes: string | null;
    issueIds: string[];
  }
) => {
  const response = await fetch(`/api/projects/${projectId}/standup/my`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to save standup entry");
  }

  return (await response.json()) as StandupEntry;
};

const searchIssuesInProject = async (projectId: string, query: string) => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);

  const response = await fetch(
    `/api/projects/${projectId}/standup/search-issues?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to search issues");
  }

  return (await response.json()) as StandupIssue[];
};

const getStandupSummaryForProjectAndDate = async (
  projectId: string,
  options: { date?: string; startDate?: string; endDate?: string }
) => {
  const params = new URLSearchParams();
  if (options.date) params.set("date", options.date);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);

  const response = await fetch(
    `/api/projects/${projectId}/standup/summary?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup summary");
  }

  return (await response.json()) as StandupSummaryResponse;
};

const listStandupEntriesByProjectAndDate = async (
  projectId: string,
  options: { date?: string; startDate?: string; endDate?: string; userId?: string }
) => {
  const params = new URLSearchParams();
  if (options.date) params.set("date", options.date);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  if (options.userId) params.set("userId", options.userId);

  const response = await fetch(
    `/api/projects/${projectId}/standup/entries?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup entries");
  }

  return (await response.json()) as StandupEntryWithUser[];
};

type StandupPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  currentUserName: string;
  currentUserEmail: string;
  projectName: string;
};

export default function StandupPageClient({
  projectId,
  projectRole,
  currentUserName,
  currentUserEmail,
  projectName,
}: StandupPageClientProps) {
  const [activeTab, setActiveTab] = useState<"my" | "dashboard">("my");
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(new Date()));
  const [weekStart, setWeekStart] = useState(() =>
    toDateInput(startOfWeek(new Date()))
  );
  const [dateMode, setDateMode] = useState<"day" | "week">("day");

  const [formState, setFormState] = useState<StandupFormState>({
    summaryToday: "",
    progressSinceYesterday: "",
    blockers: "",
    dependencies: "",
    notes: "",
  });
  const [selectedIssues, setSelectedIssues] = useState<StandupIssue[]>([]);
  const [issueQuery, setIssueQuery] = useState("");
  const [issueOptions, setIssueOptions] = useState<StandupIssue[]>([]);
  const [issueSearchError, setIssueSearchError] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isLoadingEntry, setIsLoadingEntry] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [currentEntry, setCurrentEntry] = useState<StandupEntry | null>(null);

  const [summary, setSummary] = useState<StandupSummaryResponse | null>(null);
  const [entries, setEntries] = useState<StandupEntryWithUser[]>([]);
  const [dashboardError, setDashboardError] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [memberFilter, setMemberFilter] = useState("all");
  const [showMissing, setShowMissing] = useState(true);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const canViewDashboard = projectRole === "ADMIN" || projectRole === "PO";

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    if (!projectId || !selectedDate) return;

    const loadEntry = async () => {
      setIsLoadingEntry(true);
      setEntryError("");

      try {
        const entry = await getMyStandupEntryForDate(projectId, selectedDate);
        setCurrentEntry(entry);
        setFormState({
          summaryToday: entry?.summaryToday ?? "",
          progressSinceYesterday: entry?.progressSinceYesterday ?? "",
          blockers: entry?.blockers ?? "",
          dependencies: entry?.dependencies ?? "",
          notes: entry?.notes ?? "",
        });
        setSelectedIssues(entry?.issues.map((link) => link.issue) ?? []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load standup";
        setEntryError(message);
      } finally {
        setIsLoadingEntry(false);
      }
    };

    loadEntry();
  }, [projectId, selectedDate]);

  useEffect(() => {
    if (!projectId) return;

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (!issueQuery.trim()) {
        setIssueOptions([]);
        return;
      }

      try {
        const results = await searchIssuesInProject(projectId, issueQuery.trim());
        setIssueOptions(results);
        setIssueSearchError("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to search issues";
        setIssueSearchError(message);
      }
    }, 250);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [issueQuery, projectId]);

  const handleIssueAdd = (issue: StandupIssue) => {
    setSelectedIssues((prev) => {
      if (prev.find((item) => item.id === issue.id)) return prev;
      return [...prev, issue];
    });
    setIssueQuery("");
    setIssueOptions([]);
  };

  const handleIssueRemove = (issueId: string) => {
    setSelectedIssues((prev) => prev.filter((item) => item.id !== issueId));
  };

  const computedCompletion = useMemo(() => {
    return Boolean(formState.summaryToday.trim()) && selectedIssues.length > 0;
  }, [formState.summaryToday, selectedIssues]);

  const handleSaveEntry = async () => {
    if (!projectId || !selectedDate) return;

    if (!computedCompletion) {
      const proceed = window.confirm(
        "Your entry is marked incomplete (need today's plan and at least one linked issue). Save anyway?"
      );
      if (!proceed) return;
    }

    setIsSavingEntry(true);
    setEntryError("");

    try {
      const payload = {
        date: selectedDate,
        summaryToday: formState.summaryToday.trim() || null,
        progressSinceYesterday: formState.progressSinceYesterday.trim() || null,
        blockers: formState.blockers.trim() || null,
        dependencies: formState.dependencies.trim() || null,
        notes: formState.notes.trim() || null,
        issueIds: selectedIssues.map((issue) => issue.id),
      };

      const saved = await upsertMyStandupEntry(projectId, payload);
      setCurrentEntry(saved);
      setSelectedIssues(saved.issues.map((link) => link.issue));
      addToast({ type: "success", message: "Standup entry saved." });

      if (!saved.isComplete) {
        addToast({
          type: "warning",
          message: "Entry saved but still incomplete. Add today's plan and linked issues to complete it.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save standup entry";
      setEntryError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const activeDateRange = useMemo(() => {
    if (dateMode === "day") {
      return { date: selectedDate, startDate: null, endDate: null };
    }

    const start = weekStart;
    const end = toDateInput(addDays(new Date(weekStart), 6));

    return { date: null, startDate: start, endDate: end };
  }, [dateMode, selectedDate, weekStart]);

  useEffect(() => {
    if (!projectId) return;
    if (!canViewDashboard) return;

    const loadDashboard = async () => {
      setIsLoadingDashboard(true);
      setDashboardError("");

      try {
        const summaryResult = await getStandupSummaryForProjectAndDate(projectId, {
          date: activeDateRange.date ?? undefined,
          startDate: activeDateRange.startDate ?? undefined,
          endDate: activeDateRange.endDate ?? undefined,
        });
        setSummary(summaryResult);

        const entriesResult = await listStandupEntriesByProjectAndDate(projectId, {
          date: activeDateRange.date ?? undefined,
          startDate: activeDateRange.startDate ?? undefined,
          endDate: activeDateRange.endDate ?? undefined,
          userId: memberFilter !== "all" ? memberFilter : undefined,
        });

        setEntries(entriesResult);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load dashboard";
        setDashboardError(message);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    loadDashboard();
  }, [activeDateRange, canViewDashboard, memberFilter, projectId]);

  const filteredMembers = useMemo(() => {
    if (!summary) return [];

    return summary.members.filter((member) => {
      if (!showMissing && member.status === "missing") return false;
      if (showIncompleteOnly && member.isComplete) return false;
      if (memberFilter !== "all" && member.userId !== memberFilter) return false;
      return true;
    });
  }, [memberFilter, showIncompleteOnly, showMissing, summary]);

  const groupedEntries = useMemo(() => {
    const map = new Map<string, StandupEntryWithUser[]>();
    entries.forEach((entry) => {
      if (showIncompleteOnly && entry.isComplete) return;
      const key = activeDateRange.date ? "single" : entry.date;
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return map;
  }, [activeDateRange.date, entries, showIncompleteOnly]);

  const statusChipClasses = (status: "missing" | "incomplete" | "complete") => {
    if (status === "complete")
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    if (status === "incomplete")
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
            {projectName} standup
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Capture your update and (if you're an admin or PO) review the daily summary for the team.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium shadow-inner dark:border-slate-800 dark:bg-slate-800/70">
          <button
            className={`rounded-full px-3 py-1 transition ${
              activeTab === "my"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
            onClick={() => setActiveTab("my")}
          >
            My update
          </button>
          {canViewDashboard && (
            <button
              className={`rounded-full px-3 py-1 transition ${
                activeTab === "dashboard"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              Team dashboard
            </button>
          )}
        </div>
      </div>

      {activeTab === "my" && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Your standup for {formatDisplayDate(selectedDate)}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {currentUserName} · {currentUserEmail}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              />
            </div>
          </div>

          {entryError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              {entryError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Progress since yesterday
                  </label>
                  {currentEntry?.isComplete && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                      Complete
                    </span>
                  )}
                </div>
                <textarea
                  value={formState.progressSinceYesterday}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      progressSinceYesterday: event.target.value,
                    }))
                  }
                  placeholder="Yesterday I finished..."
                  rows={4}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Today's plan
                </label>
                <textarea
                  value={formState.summaryToday}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      summaryToday: event.target.value,
                    }))
                  }
                  placeholder="Today I'll..."
                  rows={4}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
                {!computedCompletion && (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    Add a plan for today and at least one linked issue to mark this entry complete.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Blockers
                </label>
                <textarea
                  value={formState.blockers}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      blockers: event.target.value,
                    }))
                  }
                  placeholder="Any blockers to call out?"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Dependencies
                </label>
                <textarea
                  value={formState.dependencies}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      dependencies: event.target.value,
                    }))
                  }
                  placeholder="Any dependencies to track?"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Notes
                </label>
                <textarea
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Anything else to capture?"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Linked issues
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Uses project issue search
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={issueQuery}
                    onChange={(event) => setIssueQuery(event.target.value)}
                    placeholder="Search issues by key or title"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                  {issueQuery && issueOptions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {issueOptions.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                          onClick={() => handleIssueAdd(issue)}
                        >
                          <span className="min-w-[70px] text-xs font-semibold text-slate-500 dark:text-slate-300">
                            {issue.key ?? "ISSUE"}
                          </span>
                          <span>{issue.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {issueSearchError && (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                      {issueSearchError}
                    </p>
                  )}
                </div>

                {selectedIssues.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedIssues.map((issue) => (
                      <span
                        key={issue.id}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                      >
                        <Link
                          href={`/issues/${issue.id}`}
                          className="hover:underline"
                        >
                          {issue.key ? `${issue.key}: ${issue.title}` : issue.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleIssueRemove(issue.id)}
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          aria-label="Remove issue"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Link at least one issue to complete your standup.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setFormState({
                  summaryToday: "",
                  progressSinceYesterday: "",
                  blockers: "",
                  dependencies: "",
                  notes: "",
                });
                setSelectedIssues([]);
              }}
            >
              Clear
            </Button>
            <Button onClick={handleSaveEntry} disabled={isSavingEntry || isLoadingEntry}>
              {isSavingEntry ? "Saving..." : "Save standup"}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && canViewDashboard && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Team standup dashboard
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose a day or week to review submissions and statuses. Missing entries and incomplete updates are highlighted.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium shadow-inner dark:border-slate-800 dark:bg-slate-800/70">
                <button
                  className={`rounded-full px-3 py-1 transition ${
                    dateMode === "day"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                  onClick={() => setDateMode("day")}
                >
                  Day
                </button>
                <button
                  className={`rounded-full px-3 py-1 transition ${
                    dateMode === "week"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                  onClick={() => setDateMode("week")}
                >
                  Week
                </button>
              </div>
              {dateMode === "day" ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Week starting
                  </label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(event) => setWeekStart(event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-md bg-slate-50 p-4 dark:bg-slate-800/50 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Member
              </p>
              <select
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              >
                <option value="all">All members</option>
                {summary?.members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={showMissing}
                onChange={(event) => setShowMissing(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Show missing
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={showIncompleteOnly}
                onChange={(event) => setShowIncompleteOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Only incomplete
            </label>
          </div>

          {dashboardError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              {dashboardError}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Issues
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
                  {isLoadingDashboard && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                        Loading summary...
                      </td>
                    </tr>
                  )}
                  {!isLoadingDashboard && filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                        No matching members for this view.
                      </td>
                    </tr>
                  )}
                  {!isLoadingDashboard &&
                    filteredMembers.map((member) => {
                      const status: "missing" | "incomplete" | "complete" =
                        member.status === "missing"
                          ? "missing"
                          : member.isComplete
                            ? "complete"
                            : "incomplete";

                      return (
                        <tr key={member.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex flex-col">
                              <span>{member.name}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {member.role}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${statusChipClasses(status)}`}
                            >
                              {status === "missing"
                                ? "Missing"
                                : status === "complete"
                                  ? "Complete"
                                  : "Incomplete"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {member.issues.length ? (
                              <div className="flex flex-wrap gap-2 text-xs">
                                {member.issues.map((issue) => (
                                  <Link
                                    key={issue.id}
                                    href={`/issues/${issue.id}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:underline dark:bg-blue-900/30 dark:text-blue-200"
                                  >
                                    {issue.key ?? "ISSUE"}
                                    <span className="text-slate-500 dark:text-slate-300">
                                      · {issue.title}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                0 linked issues
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            {!isLoadingDashboard && groupedEntries.size === 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                No standup entries for the selected filters yet.
              </div>
            )}
            {[...groupedEntries.entries()].map(([dateKey, list]) => {
              const showHeading = dateMode === "week" || !activeDateRange.date;
              return (
                <div key={dateKey} className="space-y-2">
                  {showHeading && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {dateKey === "single"
                          ? formatDisplayDate(selectedDate)
                          : formatDisplayDate(dateKey)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {list.length} entr{list.length === 1 ? "y" : "ies"}
                      </span>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((entry) => {
                      const status: "missing" | "incomplete" | "complete" = entry.isComplete
                        ? "complete"
                        : "incomplete";
                      return (
                        <div
                          key={entry.id}
                          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {entry.user.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {entry.user.email}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${statusChipClasses(status)}`}
                            >
                              {status === "complete" ? "Complete" : "Incomplete"}
                            </span>
                          </div>

                          <div className="grid gap-3 text-sm text-slate-800 dark:text-slate-100">
                            {entry.progressSinceYesterday && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Progress
                                </p>
                                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                  {entry.progressSinceYesterday}
                                </p>
                              </div>
                            )}
                            {entry.summaryToday && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Today
                                </p>
                                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                  {entry.summaryToday}
                                </p>
                              </div>
                            )}
                            {entry.blockers && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Blockers
                                </p>
                                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                  {entry.blockers}
                                </p>
                              </div>
                            )}
                            {entry.dependencies && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Dependencies
                                </p>
                                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                  {entry.dependencies}
                                </p>
                              </div>
                            )}
                            {entry.notes && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Notes
                                </p>
                                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                  {entry.notes}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs">
                            {entry.issues.length ? (
                              entry.issues.map((link) => (
                                <Link
                                  key={link.issue.id}
                                  href={`/issues/${link.issue.id}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:underline dark:bg-blue-900/30 dark:text-blue-200"
                                >
                                  {link.issue.key ?? "ISSUE"}
                                  <span className="text-slate-500 dark:text-slate-300">
                                    · {link.issue.title}
                                  </span>
                                </Link>
                              ))
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">
                                No linked issues
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-3 text-sm shadow-lg ${
              toast.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                : toast.type === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
