import Link from "next/link";

import ProjectStandupSettings from "@/components/projects/ProjectStandupSettings";
import { Button } from "@/components/ui/Button";
import { ProjectRole } from "@/lib/roles";

type FeaturesTabProps = {
  isAdmin: boolean;
  backlogGroomingEnabled: boolean;
  setBacklogGroomingEnabled: (value: boolean) => void;
  enableResearchBoard: boolean;
  setEnableResearchBoard: (value: boolean) => void;
  isSaving: boolean;
  status: string | null;
  onSave: () => void;
  projectId: string;
  projectRole: ProjectRole | null;
};

const toggleBaseClasses =
  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900";

const indicatorClasses =
  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200";

export default function FeaturesTab({
  isAdmin,
  backlogGroomingEnabled,
  setBacklogGroomingEnabled,
  enableResearchBoard,
  setEnableResearchBoard,
  isSaving,
  status,
  onSave,
  projectId,
  projectRole,
}: FeaturesTabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Features
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enable the building blocks for your project.
            </p>
          </div>
          {status && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Backlog Grooming AI
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    backlogGroomingEnabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {backlogGroomingEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Turn on AI-assisted grooming suggestions across your backlog.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={backlogGroomingEnabled}
              aria-label="Toggle backlog grooming AI"
              disabled={!isAdmin}
              onClick={() =>
                isAdmin && setBacklogGroomingEnabled(!backlogGroomingEnabled)
              }
              className={`${toggleBaseClasses} ${
                backlogGroomingEnabled
                  ? "bg-primary"
                  : "bg-slate-200 dark:bg-slate-700"
              } ${!isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`${indicatorClasses} ${
                  backlogGroomingEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Research Board
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    enableResearchBoard
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {enableResearchBoard ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allow research items to be created and managed for this project.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableResearchBoard}
              aria-label="Toggle research board"
              disabled={!isAdmin}
              onClick={() => isAdmin && setEnableResearchBoard(!enableResearchBoard)}
              className={`${toggleBaseClasses} ${
                enableResearchBoard
                  ? "bg-primary"
                  : "bg-slate-200 dark:bg-slate-700"
              } ${!isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`${indicatorClasses} ${
                  enableResearchBoard ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 flex justify-end">
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save feature settings"}
            </Button>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
              <Link href={`/projects/${projectId}/settings/import`}>Open import</Link>
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Available to workspace admins and product owners.
          </p>
        </section>
      )}

      <ProjectStandupSettings projectId={projectId} projectRole={projectRole} />
    </div>
  );
}
