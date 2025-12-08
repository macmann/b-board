"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateSprint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          goal: goal || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to create sprint.");
        return;
      }

      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      await fetchSprints();
    } catch (err) {
      setError("An unexpected error occurred while creating the sprint.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {allowSprintManagement && (
          <section className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Sprint</h2>
            </div>
            <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreateSprint}>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="startDate">
                  Start Date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="endDate">
                  End Date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
                <label className="text-sm font-medium text-gray-700" htmlFor="goal">
                  Goal
                </label>
                <textarea
                  id="goal"
                  name="goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  rows={3}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create sprint"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Sprints</h2>
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
