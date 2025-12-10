"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ProjectTeamSettings from "@/components/projects/ProjectTeamSettings";
import { Role } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50";

const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

type ProjectSettingsPageClientProps = {
  project: {
    id: string;
    key: string;
    name: string;
    description: string;
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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState("");

  const isAdmin = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  const formattedCreatedAt = useMemo(() => {
    const parsed = new Date(project.createdAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString();
  }, [project.createdAt]);

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
      body: JSON.stringify({ name, key, description }),
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

    router.push("/projects");
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
        <section className="rounded-xl border border-red-200 bg-red-50/60 p-6 shadow-sm dark:border-red-900/60 dark:bg-red-950/40">
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
