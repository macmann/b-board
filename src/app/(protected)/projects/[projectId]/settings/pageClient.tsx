"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ProjectTeamSettings from "@/components/projects/ProjectTeamSettings";
import ProjectStandupSettings from "@/components/projects/ProjectStandupSettings";
import ProjectEmailSettings from "@/components/projects/ProjectEmailSettings";
import Button from "@/components/ui/Button";
import { Role } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { routes } from "@/lib/routes";

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50";

const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

type ProjectSettingsPageClientProps = {
  project: {
    id: string;
    key: string;
    name: string;
    description: string;
    iconUrl: string | null;
    enableResearchBoard: boolean;
    createdAt: string;
    updatedAt: string;
  };
  members: {
    id: string;
    createdAt?: string;
    role: Role;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
  projectRole: ProjectRole | null;
};

export default function ProjectSettingsPageClient({
  project,
  members,
  projectRole,
}: ProjectSettingsPageClientProps) {
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description);
  const [enableResearchBoard, setEnableResearchBoard] = useState(
    project.enableResearchBoard
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState("");
  const [iconUrl, setIconUrl] = useState(project.iconUrl ?? "");
  const [iconError, setIconError] = useState<string | null>(null);
  const [iconMessage, setIconMessage] = useState<string | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconPreviewError, setIconPreviewError] = useState(false);

  const isAdmin = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  const formattedCreatedAt = useMemo(() => {
    const parsed = new Date(project.createdAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString();
  }, [project.createdAt]);

  const iconInitial = useMemo(() => {
    const source = project.key || project.name;
    return source ? source.charAt(0).toUpperCase() : "?";
  }, [project.key, project.name]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setStatus(null);

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, key, description, enableResearchBoard }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setStatus("Failed to update project. Please try again.");
      return;
    }

    setStatus("Project updated successfully.");
    router.refresh();
  };

  const handleDeleteProject = async () => {
    if (!isAdmin || confirmKey !== key) return;

    setIsDeleting(true);
    setStatus(null);

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });

    setIsDeleting(false);

    if (!response.ok) {
      setStatus("Failed to delete project. Please try again.");
      return;
    }

    router.push(routes.myProjects());
  };

  const handleIconUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!isAdmin) return;

    const file = event.target.files?.[0];
    setIconError(null);
    setIconMessage(null);

    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      setIconError("Please upload an image file (PNG, JPG, or GIF).");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setIconError("Images must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploadingIcon(true);

    try {
      const formData = new FormData();
      formData.append("icon", file);

      const response = await fetch(`/api/projects/${project.id}/icon`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIconError(data?.message ?? "Failed to upload project icon.");
        return;
      }

      const newUrl = (data?.iconUrl as string | null) ?? "";
      setIconUrl(newUrl);
      setIconMessage("Project icon updated.");
      setIconPreviewError(false);
    } catch (err) {
      setIconError("Unable to upload project icon. Please try again.");
    } finally {
      setIsUploadingIcon(false);
      event.target.value = "";
    }
  };

  const handleIconRemove = async () => {
    if (!isAdmin) return;

    setIconError(null);
    setIconMessage(null);
    setIsUploadingIcon(true);

    try {
      const response = await fetch(`/api/projects/${project.id}/icon`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIconError(data?.message ?? "Failed to remove project icon.");
        return;
      }

      setIconUrl("");
      setIconPreviewError(false);
      setIconMessage("Project icon removed.");
    } catch (err) {
      setIconError("Unable to remove project icon. Please try again.");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Project settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {project.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Key: {project.key} · Created {formattedCreatedAt}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              General
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Update the project name, key, and description.
            </p>
          </div>
          {status && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>
          )}
        </div>

        <form onSubmit={handleUpdateProject} className="space-y-6">
          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-icon">
              Project icon
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {iconUrl && !iconPreviewError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconUrl}
                    alt={`${project.name} icon`}
                    className="h-full w-full object-cover"
                    onError={() => setIconPreviewError(true)}
                  />
                ) : (
                  <span>{iconInitial}</span>
                )}
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  id="project-icon"
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  disabled={!isAdmin || isUploadingIcon}
                  className="text-xs text-slate-700 file:mr-3 file:rounded-md file:border-none file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary/90 disabled:cursor-not-allowed"
                />
                <p>PNG, JPG, or GIF up to 2MB.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleIconRemove}
                    disabled={!iconUrl || isUploadingIcon || !isAdmin}
                    className="px-3 py-1 text-xs"
                  >
                    Remove icon
                  </Button>
                  {isUploadingIcon && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Saving...
                    </span>
                  )}
                </div>
                {iconMessage && (
                  <p className="text-[11px] text-emerald-600">{iconMessage}</p>
                )}
                {iconError && <p className="text-[11px] text-red-600">{iconError}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-name">
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className={inputClasses}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="project-key">
                Key
              </label>
              <input
                id="project-key"
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!isAdmin}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="project-created">
                Created
              </label>
              <input
                id="project-created"
                type="text"
                value={formattedCreatedAt}
                readOnly
                className={`${inputClasses} cursor-not-allowed bg-slate-50 dark:bg-slate-800`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-description">
              Description
            </label>
            <textarea
              id="project-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              className={inputClasses}
            />
          </div>

          {isAdmin && (
            <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Research Board
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Allow research items to be created and managed for this project.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {enableResearchBoard ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enableResearchBoard}
              aria-label="Toggle research board"
              disabled={!isAdmin}
              onClick={() => isAdmin && setEnableResearchBoard((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                enableResearchBoard
                  ? "bg-primary"
                  : "bg-slate-200 dark:bg-slate-700"
              } ${!isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  enableResearchBoard ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
        {!isAdmin && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only admins and product owners can change this setting.
          </p>
        )}
      </section>

      {isAdmin && (
        <section
          id="import"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Import from Jira
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Move your backlog into B Board with a CSV export from Jira.
              </p>
            </div>
            <Button asChild>
              <Link href={`/projects/${project.id}/settings/import`}>Open import</Link>
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Available to workspace admins and product owners.
          </p>
        </section>
      )}

      <ProjectEmailSettings projectId={project.id} projectRole={projectRole} />

      <ProjectStandupSettings projectId={project.id} projectRole={projectRole} />

      <section
        id="team"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Team
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage who can access this project and their roles.
            </p>
          </div>
        </div>

        <ProjectTeamSettings
          projectId={project.id}
          projectRole={projectRole}
          showHeader={false}
          initialMembers={members}
        />
      </section>

      {isAdmin && (
        <section
          id="danger-zone"
          className="rounded-xl border border-red-200 bg-red-50/60 p-6 shadow-sm dark:border-red-900/60 dark:bg-red-950/40"
        >
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
            Danger zone
          </h2>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Deleting this project will permanently remove all its sprints, issues, and settings.
            This action cannot be undone.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-red-700 dark:text-red-300">
              Type the project key (<span className="font-semibold">{key}</span>) to confirm.
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={confirmKey}
                onChange={(e) => setConfirmKey(e.target.value)}
                placeholder={key}
                className="w-32 rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-900 shadow-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-red-800 dark:bg-red-950 dark:text-red-50"
              />
              <button
                type="button"
                disabled={confirmKey !== key || isDeleting}
                onClick={handleDeleteProject}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
