"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ProjectOption = {
  id: string;
  name: string;
  key: string;
};

type ImportSummary = {
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

export default function JiraImportPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError("");

      const projectIdFromQuery = searchParams?.get("projectId") ?? "";

      try {
        const response = await fetch("/api/projects");

        if (!response.ok) {
          setError("Unable to load projects.");
          return;
        }

        const data: ProjectOption[] = await response.json();
        setProjects(data);
        setSelectedProjectId((current) => {
          if (current) return current;
          if (projectIdFromQuery) return projectIdFromQuery;
          return data[0]?.id || "";
        });
      } catch (err) {
        setError("Failed to fetch projects. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSummary(null);

    if (!selectedProjectId) {
      setError("Please select a project.");
      return;
    }

    if (!file) {
      setError("Please choose a CSV file to import.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("projectId", selectedProjectId);
      formData.append("file", file);

      const response = await fetch("/api/import/jira/issues", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.message ?? "Import failed. Please try again.");
        return;
      }

      setSummary(data as ImportSummary);
    } catch (err) {
      setError("Import failed due to an unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">
            Import Jira Issues
          </h1>
          <p className="text-gray-600">
            Upload a Jira CSV export to quickly create issues in your project.
          </p>
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">Upload CSV</h2>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="project">
                Project
              </label>
              <select
                id="project"
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                disabled={isLoading || isSubmitting}
              >
                {isLoading ? (
                  <option>Loading projects...</option>
                ) : projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.key})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="file">
                CSV File
              </label>
              <input
                id="file"
                type="file"
                accept=".csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSubmitting ? "Importing..." : "Import"}
              </button>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
          </form>
        </section>

        {summary && (
          <section className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">Import Summary</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              <p>
                <span className="font-semibold">Imported:</span> {summary.importedCount}
              </p>
              <p>
                <span className="font-semibold">Skipped:</span> {summary.skippedCount}
              </p>
              {summary.errors.length > 0 && (
                <div className="rounded-md bg-red-50 p-3 text-red-700">
                  <p className="font-semibold">Errors</p>
                  <ul className="list-disc pl-5">
                    {summary.errors.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
