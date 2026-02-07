"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EpicStatus, IssueStatus, IssueType } from "@/lib/prismaEnums";

type EpicStory = {
  id: string;
  key: string | null;
  title: string;
  status: IssueStatus;
  type: IssueType;
};

type EpicSummary = {
  id: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  stories: EpicStory[];
};

type EpicsPageClientProps = {
  projectId: string;
  canManageEpics: boolean;
};

const statusLabels: Record<EpicStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const statusVariants: Record<EpicStatus, "neutral" | "info" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
};

const storyStatusVariants: Record<IssueStatus, "neutral" | "info" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  IN_REVIEW: "info",
  DONE: "success",
};

const initialStatus = EpicStatus.TODO;

export default function EpicsPageClient({
  projectId,
  canManageEpics,
}: EpicsPageClientProps) {
  const [epics, setEpics] = useState<EpicSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicStatus, setEpicStatus] = useState<EpicStatus>(initialStatus);

  const storyCount = useMemo(
    () => epics.reduce((total, epic) => total + epic.stories.length, 0),
    [epics]
  );

  const fetchEpics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/epics`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to load epics.");
      }

      const nextEpics = (data?.epics ?? []).map((epic: EpicSummary & { issues?: EpicStory[] }) => ({
        ...epic,
        stories: epic.stories ?? epic.issues ?? [],
      }));
      setEpics(nextEpics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load epics.");
      setEpics([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEpics();
  }, [fetchEpics]);

  const handleCreateEpic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageEpics) {
      setError("You do not have permission to create epics.");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Epic title is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/epics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
          status: epicStatus,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to create epic.");
      }

      setTitle("");
      setDescription("");
      setEpicStatus(initialStatus);
      setStatus("Epic created successfully.");
      await fetchEpics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create epic.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Create epic
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Group related stories under an epic to track progress.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateEpic}>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="epic-title">
                  Epic title
                </label>
                <input
                  id="epic-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Add a concise epic title"
                  disabled={!canManageEpics || isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="epic-status">
                  Status
                </label>
                <select
                  id="epic-status"
                  value={epicStatus}
                  onChange={(event) => setEpicStatus(event.target.value as EpicStatus)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  disabled={!canManageEpics || isSaving}
                >
                  {Object.values(EpicStatus).map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusLabels[statusOption]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="epic-description">
                Description
              </label>
              <textarea
                id="epic-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[90px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Add context or goals for the epic."
                disabled={!canManageEpics || isSaving}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canManageEpics || isSaving}>
                {isSaving ? "Creating..." : "Create epic"}
              </Button>
              {!canManageEpics && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You do not have permission to create epics.
                </p>
              )}
              {status && <p className="text-xs text-emerald-600">{status}</p>}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Epics overview
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {epics.length} epics · {storyCount} linked stories
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchEpics}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading epics...</p>
          ) : error && epics.length === 0 ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : epics.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No epics yet. Create one to start grouping stories.
            </p>
          ) : (
            <div className="space-y-4">
              {epics.map((epic) => (
                <div
                  key={epic.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
                        {epic.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {epic.stories.length} linked {epic.stories.length === 1 ? "story" : "stories"}
                      </p>
                    </div>
                    <Badge variant={statusVariants[epic.status]}>
                      {statusLabels[epic.status]}
                    </Badge>
                  </div>
                  {epic.description && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {epic.description}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Linked stories
                    </p>
                    {epic.stories.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No stories linked yet.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {epic.stories.map((story) => (
                          <li
                            key={story.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/issues/${story.id}`}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {story.key ?? "Story"}
                              </Link>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {story.title}
                              </p>
                            </div>
                            <Badge variant={storyStatusVariants[story.status]}>
                              {story.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
