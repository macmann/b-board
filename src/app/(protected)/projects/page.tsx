"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CreateProjectDrawer from "@/components/projects/CreateProjectDrawer";

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

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}/backlog`);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
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
            <p className="mt-4 text-gray-600">No projects found.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Key
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {project.key}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{project.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {project.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
