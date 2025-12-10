"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CreateProjectDrawer from "@/components/projects/CreateProjectDrawer";
import ProjectCard from "@/components/projects/ProjectCard";

type Project = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/projects");

      if (!response.ok) {
        setError("Failed to load projects. Please try again.");
        return;
      }

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError("An unexpected error occurred while loading projects.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500">
              Manage your projects and navigate to their backlogs.
            </p>
          </div>
          <CreateProjectDrawer onCreated={fetchProjects} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Project List</h2>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-4 text-gray-600">Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:bg-slate-900/40">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                No projects yet
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create a new project to start planning your work.
              </p>
              <div className="mt-4 flex justify-center">
                <CreateProjectDrawer onCreated={fetchProjects} />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  keyCode={project.key}
                  name={project.name}
                  description={project.description}
                  onClick={() => router.push(`/projects/${project.id}/backlog`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
