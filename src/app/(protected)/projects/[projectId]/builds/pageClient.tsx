"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

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

type Filters = {
  status: string;
  environment: string;
  search: string;
  onlyMine: boolean;
};

type BuildFormState = {
  key: string;
  name: string;
  description: string;
  status: BuildItem["status"];
  environment: BuildItem["environment"];
  plannedAt: string;
  deployedAt: string;
};

type BuildFormErrors = Partial<
  Record<keyof BuildFormState | "form", string>
>;

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
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateInput = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

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
  const [filters, setFilters] = useState<Filters>({
    status: "",
    environment: "",
    search: "",
    onlyMine: false,
  });
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [activeBuild, setActiveBuild] = useState<BuildItem | null>(null);
  const [formState, setFormState] = useState<BuildFormState>({
    key: "",
    name: "",
    description: "",
    status: BuildStatus.PLANNED,
    environment: BuildEnvironment.DEV,
    plannedAt: "",
    deployedAt: "",
  });
  const [formErrors, setFormErrors] = useState<BuildFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    setItems(initialBuilds);
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

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => setToastMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const closeModal = () => {
    setModalOpen(false);
    setFormErrors({});
    setActiveBuild(null);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setActiveBuild(null);
    setFormErrors({});
    setFormState({
      key: "",
      name: "",
      description: "",
      status: BuildStatus.PLANNED,
      environment: BuildEnvironment.DEV,
      plannedAt: "",
      deployedAt: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (build: BuildItem) => {
    setModalMode("edit");
    setActiveBuild(build);
    setFormErrors({});
    setFormState({
      key: build.key,
      name: build.name,
      description: build.description,
      status: build.status,
      environment: build.environment,
      plannedAt: formatDateInput(build.plannedAt),
      deployedAt: formatDateInput(build.deployedAt),
    });
    setModalOpen(true);
  };

  const validateForm = (state: BuildFormState) => {
    const errors: BuildFormErrors = {};

    if (!state.key.trim()) {
      errors.key = "Key is required";
    }

    if (!state.environment) {
      errors.environment = "Environment is required";
    }

    if (!state.status) {
      errors.status = "Status is required";
    }

    if (state.deployedAt && state.status !== BuildStatus.DEPLOYED) {
      errors.deployedAt = "Deployment date is only allowed for deployed builds";
    }

    return errors;
  };

  const toIsoDate = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateForm(formState);

    const plannedAtIso = toIsoDate(formState.plannedAt);
    const deployedAtIso =
      formState.status === BuildStatus.DEPLOYED ? toIsoDate(formState.deployedAt) : null;

    if (formState.plannedAt && !plannedAtIso) {
      errors.plannedAt = "Enter a valid planned date";
    }

    if (formState.deployedAt && formState.status === BuildStatus.DEPLOYED && !deployedAtIso) {
      errors.deployedAt = "Enter a valid deployed date";
    }

    setFormErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    const payload = {
      key: formState.key.trim(),
      name: formState.name.trim() || null,
      description: formState.description.trim() || null,
      status: formState.status,
      environment: formState.environment,
      plannedAt: plannedAtIso,
      deployedAt: deployedAtIso,
    };

    try {
      const endpoint =
        modalMode === "edit" && activeBuild
          ? `/api/projects/${projectId}/builds/${activeBuild.id}`
          : `/api/projects/${projectId}/builds`;

      const response = await fetch(endpoint, {
        method: modalMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFormErrors({ form: body?.message ?? "Unable to save build" });
        return;
      }

      await loadBuilds({ silent: true });
      setToastMessage(modalMode === "edit" ? "Build updated" : "Build created");
      closeModal();
    } finally {
      setSubmitting(false);
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
            <Button onClick={openCreateModal}>Create build</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderRows = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-2 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/40 dark:text-slate-300 sm:grid-cols-7">
        <div className="col-span-1 sm:col-span-2">Build</div>
        <div>Status</div>
        <div>Environment</div>
        <div className="hidden sm:block">Planned</div>
        <div className="hidden sm:block">Deployed</div>
        <div className="col-span-1 sm:col-span-1 sm:text-right">Issues</div>
        <div className="hidden sm:block text-right">Actions</div>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((build) => (
          <div key={build.id} className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-7">
            <div className="col-span-2 space-y-1 sm:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span>{build.key}</span>
                {build.createdById === currentUserId && <Badge variant="outline">Mine</Badge>}
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

            <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{build.issueCount}</div>
              {canEdit && (
                <Button variant="secondary" onClick={() => openEditModal(build)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        ))}
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
          <Button onClick={openCreateModal}>Create build</Button>
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

        <Dialog.Root
          open={modalOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeModal();
            } else {
              setModalOpen(true);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30" />
            <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl bg-white p-6 shadow-xl focus:outline-none dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {modalMode === "edit" ? "Edit build" : "Create build"}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400">
                    {modalMode === "edit"
                      ? "Update build details, status, and deployment timing."
                      : "Add a new release for this project."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close"
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </div>

              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Key *</label>
                  <input
                    required
                    value={formState.key}
                    onChange={(e) => setFormState((prev) => ({ ...prev, key: e.target.value }))}
                    placeholder="v1.4.0"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                  {formErrors.key && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">{formErrors.key}</span>
                  )}
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
                    onChange={(e) => {
                      const nextStatus = e.target.value as BuildItem["status"];
                      setFormState((prev) => ({
                        ...prev,
                        status: nextStatus,
                        deployedAt: nextStatus === BuildStatus.DEPLOYED ? prev.deployedAt : "",
                      }));
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  >
                    {Object.values(BuildStatus).map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                  {formErrors.status && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">{formErrors.status}</span>
                  )}
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
                  {formErrors.environment && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">{formErrors.environment}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Planned date</label>
                  <input
                    type="date"
                    value={formState.plannedAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, plannedAt: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                  {formErrors.plannedAt && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">{formErrors.plannedAt}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Deployed date</label>
                  <input
                    type="date"
                    value={formState.deployedAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, deployedAt: e.target.value }))}
                    disabled={formState.status !== BuildStatus.DEPLOYED}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Only enabled when status is Deployed.
                  </span>
                  {formErrors.deployedAt && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">{formErrors.deployedAt}</span>
                  )}
                </div>

                {formErrors.form && (
                  <div className="md:col-span-2 text-sm text-rose-600 dark:text-rose-400">{formErrors.form}</div>
                )}

                <div className="md:col-span-2 flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary" disabled={submitting}>
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : modalMode === "edit" ? "Save changes" : "Create build"}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {toastMessage && (
          <div className="fixed bottom-6 right-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {toastMessage}
          </div>
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
