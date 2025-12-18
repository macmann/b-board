"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { BuildEnvironment, BuildStatus } from "@/lib/prismaEnums";
import { PROJECT_ADMIN_ROLES, type ProjectRole } from "@/lib/roles";

type BuildItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: (typeof BuildStatus)[keyof typeof BuildStatus];
  environment: (typeof BuildEnvironment)[keyof typeof BuildEnvironment];
  plannedAt: string | null;
  deployedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
};

type Draft = {
  status: BuildItem["status"];
  environment: BuildItem["environment"];
  description: string;
};

type Props = {
  projectId: string;
  projectRole: ProjectRole | null;
  builds: BuildItem[];
};

type ApiBuild = BuildItem & { issueIds?: string[] };

const statusLabels: Record<BuildItem["status"], string> = {
  [BuildStatus.PLANNED]: "Planned",
  [BuildStatus.IN_PROGRESS]: "In progress",
  [BuildStatus.DEPLOYED]: "Deployed",
  [BuildStatus.ROLLED_BACK]: "Rolled back",
  [BuildStatus.CANCELLED]: "Cancelled",
};

const environmentLabels: Record<BuildItem["environment"], string> = {
  [BuildEnvironment.DEV]: "Dev",
  [BuildEnvironment.STAGING]: "Staging",
  [BuildEnvironment.UAT]: "UAT",
  [BuildEnvironment.PROD]: "Prod",
};

const badgeVariants: Partial<Record<BuildItem["status"], "neutral" | "success" | "info">> = {
  [BuildStatus.DEPLOYED]: "success",
  [BuildStatus.IN_PROGRESS]: "info",
};

const normalizeBuild = (build: ApiBuild): BuildItem => ({
  ...build,
  plannedAt: build.plannedAt ?? null,
  deployedAt: build.deployedAt ?? null,
  issueCount: build.issueIds ? build.issueIds.length : build.issueCount,
});

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const toDraftMap = (builds: BuildItem[]): Record<string, Draft> =>
  builds.reduce<Record<string, Draft>>((acc, build) => {
    acc[build.id] = {
      status: build.status,
      environment: build.environment,
      description: build.description,
    };
    return acc;
  }, {});

export default function BuildsPageClient({ projectId, projectRole, builds }: Props) {
  const canEdit = useMemo(
    () => (projectRole ? PROJECT_ADMIN_ROLES.includes(projectRole) : false),
    [projectRole]
  );

  const [items, setItems] = useState<BuildItem[]>(builds);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => toDraftMap(builds));
  const [formState, setFormState] = useState({
    key: "",
    name: "",
    description: "",
    status: BuildStatus.PLANNED as BuildItem["status"],
    environment: BuildEnvironment.DEV as BuildItem["environment"],
    plannedAt: "",
    deployedAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(builds);
    setDrafts(toDraftMap(builds));
  }, [builds]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      key: formState.key.trim(),
      name: formState.name.trim() || null,
      description: formState.description.trim() || null,
      status: formState.status,
      environment: formState.environment,
      plannedAt: formState.plannedAt || null,
      deployedAt: formState.deployedAt || null,
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/builds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Unable to create build");
        return;
      }

      const data = (await response.json()) as ApiBuild;
      const build = normalizeBuild(data);

      setItems((prev) => [build, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [build.id]: {
          status: build.status,
          environment: build.environment,
          description: build.description,
        },
      }));
      setFormState({
        key: "",
        name: "",
        description: "",
        status: BuildStatus.PLANNED,
        environment: BuildEnvironment.DEV,
        plannedAt: "",
        deployedAt: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftChange = (buildId: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [buildId]: {
        ...prev[buildId],
        [field]: value,
      },
    }));
  };

  const handleUpdate = async (buildId: string) => {
    const draft = drafts[buildId];
    if (!draft) return;

    setSavingId(buildId);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/builds/${buildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          environment: draft.environment,
          description: draft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Unable to update build");
        return;
      }

      const data = (await response.json()) as ApiBuild;
      const updated = normalizeBuild(data);

      setItems((prev) => prev.map((build) => (build.id === updated.id ? updated : build)));
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: {
          status: updated.status,
          environment: updated.environment,
          description: updated.description,
        },
      }));
    } finally {
      setSavingId(null);
    }
  };

  const renderEmptyState = () => (
    <Card>
      <CardContent className="py-6 text-sm text-slate-600 dark:text-slate-300">
        No builds yet. {canEdit ? "Create the first build to track releases." : "Builds will appear here once created."}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Builds</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Track project releases and deployments.</p>
              </div>
              <Badge variant="outline">Admin/PM only</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Key *</label>
                <input
                  required
                  value={formState.key}
                  onChange={(e) => setFormState((prev) => ({ ...prev, key: e.target.value }))}
                  placeholder="v1.4.0"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Name</label>
                <input
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="June release"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Scope, risks, and deployment notes"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Status</label>
                <select
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, status: e.target.value as BuildItem["status"] }))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                >
                  {Object.values(BuildStatus).map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Environment</label>
                <select
                  value={formState.environment}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, environment: e.target.value as BuildItem["environment"] }))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                >
                  {Object.values(BuildEnvironment).map((value) => (
                    <option key={value} value={value}>
                      {environmentLabels[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Planned date</label>
                <input
                  type="date"
                  value={formState.plannedAt}
                  onChange={(e) => setFormState((prev) => ({ ...prev, plannedAt: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Deployed date</label>
                <input
                  type="date"
                  value={formState.deployedAt}
                  onChange={(e) => setFormState((prev) => ({ ...prev, deployedAt: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              {error && (
                <div className="md:col-span-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>
              )}

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create build"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((build) => {
            const draft = drafts[build.id];
            const isSaving = savingId === build.id;

            return (
              <Card key={build.id} className="flex flex-col">
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{build.key}</div>
                      <div className="text-base font-semibold text-slate-800 dark:text-slate-200">{build.name || "Untitled build"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={badgeVariants[build.status] ?? "neutral"}>{statusLabels[build.status]}</Badge>
                      <Badge variant="outline">{environmentLabels[build.environment]}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                    {build.description || "No description provided."}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Planned</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatDate(build.plannedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Deployed</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatDate(build.deployedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Issues linked</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{build.issueCount}</span>
                  </div>
                </CardContent>
                {canEdit && draft && (
                  <CardFooter className="flex flex-col gap-3">
                    <div className="grid w-full gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</label>
                        <select
                          value={draft.status}
                          onChange={(e) => handleDraftChange(build.id, "status", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                        >
                          {Object.values(BuildStatus).map((value) => (
                            <option key={value} value={value}>
                              {statusLabels[value]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Environment</label>
                        <select
                          value={draft.environment}
                          onChange={(e) => handleDraftChange(build.id, "environment", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                        >
                          {Object.values(BuildEnvironment).map((value) => (
                            <option key={value} value={value}>
                              {environmentLabels[value]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2 flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Description</label>
                        <textarea
                          value={draft.description}
                          onChange={(e) => handleDraftChange(build.id, "description", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Updated {formatDate(build.updatedAt)}</span>
                      <div className="flex items-center gap-2">
                        {error && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
                        <Button variant="primary" onClick={() => handleUpdate(build.id)} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
