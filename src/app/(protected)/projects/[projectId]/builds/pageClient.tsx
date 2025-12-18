"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
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
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
};

type Draft = {
  status: BuildItem["status"];
  environment: BuildItem["environment"];
  description: string;
};

type Filters = {
  status: string;
  environment: string;
  search: string;
  onlyMine: boolean;
};

type Props = {
  projectId: string;
  projectRole: ProjectRole | null;
  builds: BuildItem[];
  currentUserId: string;
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

export default function BuildsPageClient({
  projectId,
  projectRole,
  builds,
  currentUserId,
}: Props) {
  const initialBuilds = useMemo(() => builds.map(normalizeBuild), [builds]);
  const canEdit = useMemo(
    () => (projectRole ? PROJECT_ADMIN_ROLES.includes(projectRole) : false),
    [projectRole]
  );

  const [items, setItems] = useState<BuildItem[]>(initialBuilds);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => toDraftMap(initialBuilds));
  const [filters, setFilters] = useState<Filters>({
    status: "",
    environment: "",
    search: "",
    onlyMine: false,
  });
  const [showCreate, setShowCreate] = useState(false);
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
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems(initialBuilds);
    setDrafts(toDraftMap(initialBuilds));
  }, [initialBuilds]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();

    if (filters.status) params.set("status", filters.status);
    if (filters.environment) params.set("environment", filters.environment);
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.onlyMine) params.set("createdBy", "me");

    return params.toString();
  }, [filters]);

  const loadBuilds = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      setItemsError(null);

      try {
        const query = buildQuery();
        const response = await fetch(
          `/api/projects/${projectId}/builds${query ? `?${query}` : ""}`,
          { signal: options?.signal }
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setItemsError(body?.message ?? "Unable to load builds");
          return;
        }

        const data = (await response.json()) as ApiBuild[];
        const normalized = data.map(normalizeBuild);
        setItems(normalized);
        setDrafts(toDraftMap(normalized));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setItemsError("Unable to load builds");
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [buildQuery, projectId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBuilds({ signal: controller.signal });

    return () => controller.abort();
  }, [loadBuilds]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);

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
        setActionError(body?.message ?? "Unable to create build");
        return;
      }

      setFormState({
        key: "",
        name: "",
        description: "",
        status: BuildStatus.PLANNED,
        environment: BuildEnvironment.DEV,
        plannedAt: "",
        deployedAt: "",
      });
      setShowCreate(false);
      await loadBuilds({ silent: true });
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
    setActionError(null);

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
        setActionError(body?.message ?? "Unable to update build");
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

  const renderSkeleton = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-lg border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap gap-3">
            <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6 text-sm text-slate-600 dark:text-slate-300">
        <div className="font-medium text-slate-800 dark:text-slate-100">No builds yet</div>
        <p>Track releases here. {canEdit ? "Create the first build to get started." : "Builds will appear once created."}</p>
        {canEdit && (
          <div>
            <Button onClick={() => setShowCreate(true)}>Create build</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderRows = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-2 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/40 dark:text-slate-300 sm:grid-cols-6">
        <div className="col-span-1 sm:col-span-2">Build</div>
        <div>Status</div>
        <div>Environment</div>
        <div className="hidden sm:block">Planned</div>
        <div className="hidden sm:block">Deployed</div>
        <div className="col-span-1 sm:col-span-1 sm:text-right">Issues</div>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((build) => {
          const draft = drafts[build.id];
          const isSaving = savingId === build.id;

          return (
            <div key={build.id} className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-6">
              <div className="col-span-2 space-y-1 sm:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <span>{build.key}</span>
                  {build.createdById === currentUserId && (
                    <Badge variant="outline">Mine</Badge>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{build.name || "Untitled build"}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {build.description || "No description provided."}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                  <span className="font-medium">Planned:</span> {formatDate(build.plannedAt)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                  <span className="font-medium">Deployed:</span> {formatDate(build.deployedAt)}
                </div>
              </div>

              <div className="flex items-center">
                <Badge variant={badgeVariants[build.status] ?? "neutral"}>{statusLabels[build.status]}</Badge>
              </div>

              <div className="flex items-center">
                <Badge variant="outline">{environmentLabels[build.environment]}</Badge>
              </div>

              <div className="hidden items-center sm:flex">{formatDate(build.plannedAt)}</div>
              <div className="hidden items-center sm:flex">{formatDate(build.deployedAt)}</div>

              <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{build.issueCount}</div>
              </div>

              {canEdit && draft && (
                <div className="col-span-2 space-y-3 sm:col-span-6">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1">
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

                    <div className="flex flex-col gap-1">
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

                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Description</label>
                      <textarea
                        value={draft.description}
                        onChange={(e) => handleDraftChange(build.id, "description", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Updated {formatDate(build.updatedAt)}</span>
                    <div className="flex items-center gap-3">
                      {actionError && <span className="text-rose-600 dark:text-rose-400">{actionError}</span>}
                      <Button variant="primary" onClick={() => handleUpdate(build.id)} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Builds</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Monitor releases across environments.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? "Hide form" : "Create build"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              >
                <option value="">All statuses</option>
                {Object.values(BuildStatus).map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ))}
              </select>

              <select
                value={filters.environment}
                onChange={(e) => setFilters((prev) => ({ ...prev, environment: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              >
                <option value="">All environments</option>
                {Object.values(BuildEnvironment).map((value) => (
                  <option key={value} value={value}>
                    {environmentLabels[value]}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.onlyMine}
                  onChange={(e) => setFilters((prev) => ({ ...prev, onlyMine: e.target.checked }))}
                />
                Only my builds
              </label>
            </div>
            <div className="flex flex-1 items-center gap-2 sm:justify-end">
              <input
                type="search"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search by key or name"
                className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
              <Button variant="secondary" onClick={() => setFilters({ status: "", environment: "", search: "", onlyMine: false })}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showCreate && canEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create build</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Add a new release for this project.</p>
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

              {actionError && (
                <div className="md:col-span-2 text-sm text-rose-600 dark:text-rose-400">{actionError}</div>
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

      {itemsError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4 text-sm text-rose-600 dark:text-rose-400">
            <span>{itemsError}</span>
            <Button variant="secondary" onClick={() => loadBuilds()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? renderSkeleton() : items.length === 0 ? renderEmptyState() : renderRows()}
    </div>
  );
}
