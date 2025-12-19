"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";

type ImportSummary = { importedCount: number; skippedCount: number; errors: string[] };

type JiraImportFormProps = {
  projectId: string;
  projectName: string;
};

export default function JiraImportForm({ projectId, projectName }: JiraImportFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSummary(null);

    if (!file) {
      setError("Please choose a CSV file to import.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Import from Jira</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Upload a Jira CSV export to create issues in {projectName}.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="file">
            CSV File
          </label>
          <input
            id="file"
            type="file"
            accept=".csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={isSubmitting}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Importing..." : "Start import"}
          </Button>
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        </div>

        {summary && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <p className="font-semibold text-slate-900 dark:text-slate-50">Import summary</p>
            <ul className="mt-2 space-y-1">
              <li>Imported: {summary.importedCount}</li>
              <li>Skipped: {summary.skippedCount}</li>
              {summary.errors.length > 0 && (
                <li className="text-red-600 dark:text-red-400">
                  Errors: {summary.errors.join(", ")}
                </li>
              )}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
