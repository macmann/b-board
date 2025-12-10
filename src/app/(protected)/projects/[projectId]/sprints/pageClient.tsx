"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateSprintDrawer from "@/components/sprints/CreateSprintDrawer";

import { SprintStatus } from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";
import { canManageSprints } from "../../../../../lib/uiPermissions";

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
};

type ProjectSprintsPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

export default function ProjectSprintsPageClient({
  projectId,
  projectRole,
}: ProjectSprintsPageClientProps) {
  const router = useRouter();

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const allowSprintManagement = canManageSprints(projectRole);

  const fetchSprints = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to load sprints.");
        return;
      }

      const data = await response.json();
      setSprints(data);
    } catch (err) {
      setError("An unexpected error occurred while loading sprints.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchSprints();
  }, [projectId]);

  const handleStartSprint = async (sprintId: string) => {
    setError("");

    const response = await fetch(`/api/sprints/${sprintId}/start`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Unable to start sprint.");
      return;
    }

    await fetchSprints();
  };

  const handleCompleteSprint = async (sprintId: string) => {
    setError("");

    const response = await fetch(`/api/sprints/${sprintId}/complete`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Unable to complete sprint.");
      return;
    }

    await fetchSprints();
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const navigateToSprintBoard = (sprintId: string) => {
    router.push(`/projects/${projectId}/board?sprintId=${sprintId}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Sprints</h1>
          <p className="text-gray-600">
            Manage sprints for this project. Plan, start, and complete sprints.
          </p>
        </header>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Sprints</h2>
          {allowSprintManagement && (
            <CreateSprintDrawer
              projectId={projectId}
              onSprintCreated={fetchSprints}
              onError={setError}
            />
          )}
        </div>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Sprint list</h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {isLoading ? (
            <p className="text-gray-600">Loading sprints...</p>
          ) : sprints.length === 0 ? (
            <p className="text-gray-600">No sprints have been created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Goal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sprints.map((sprint) => (
                    <tr key={sprint.id} className="hover:bg-gray-50">
                      <td
                        className="cursor-pointer px-4 py-3 text-sm font-medium text-blue-700 hover:underline"
                        onClick={() => navigateToSprintBoard(sprint.id)}
                      >
                        {sprint.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sprint.status}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(sprint.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(sprint.endDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sprint.goal || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex gap-2">
                          {allowSprintManagement && sprint.status === SprintStatus.PLANNED && (
                            <button
                              type="button"
                              onClick={() => handleStartSprint(sprint.id)}
                              className="rounded-md bg-green-600 px-3 py-1 text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            >
                              Start
                            </button>
                          )}
                          {allowSprintManagement && sprint.status === SprintStatus.ACTIVE && (
                            <button
                              type="button"
                              onClick={() => handleCompleteSprint(sprint.id)}
                              className="rounded-md bg-indigo-600 px-3 py-1 text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                              Complete
                            </button>
                          )}
                        </div>
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
