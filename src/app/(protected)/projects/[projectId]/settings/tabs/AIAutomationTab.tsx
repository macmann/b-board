import Button from "@/components/ui/Button";

type AIAutomationTabProps = {
  isAdmin: boolean;
  backlogGroomingEnabled: boolean;
  setBacklogGroomingEnabled: (value: boolean) => void;
  aiSuggestionScope: "backlog" | "sprint" | "research";
  setAiSuggestionScope: (value: "backlog" | "sprint" | "research") => void;
  isSaving: boolean;
  status: string | null;
  onSave: () => void;
};

const toggleBaseClasses =
  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900";

const indicatorClasses =
  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200";

export default function AIAutomationTab({
  isAdmin,
  backlogGroomingEnabled,
  setBacklogGroomingEnabled,
  aiSuggestionScope,
  setAiSuggestionScope,
  isSaving,
  status,
  onSave,
}: AIAutomationTabProps) {
  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            AI & Automation
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure how AI supports your delivery process.
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
              Control whether AI-powered grooming suggestions are available.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={backlogGroomingEnabled}
            aria-label="Toggle backlog grooming AI"
            disabled={!isAdmin}
            onClick={() => isAdmin && setBacklogGroomingEnabled(!backlogGroomingEnabled)}
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

        <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Suggestion scope
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose which workstreams AI suggestions should prioritize.
              </p>
            </div>
            <select
              value={aiSuggestionScope}
              onChange={(event) =>
                isAdmin && setAiSuggestionScope(event.target.value as typeof aiSuggestionScope)
              }
              disabled={!isAdmin}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
            >
              <option value="backlog">Backlog</option>
              <option value="sprint">Sprint</option>
              <option value="research">Research</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Current preference is remembered for this session; backend support is coming soon.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save AI settings"}
          </Button>
        </div>
      )}
    </section>
  );
}
