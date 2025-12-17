type DangerZoneTabProps = {
  keyValue: string;
  confirmKey: string;
  onConfirmKeyChange: (value: string) => void;
  onDelete: () => void;
  isDeleting: boolean;
  status: string | null;
};

export default function DangerZoneTab({
  keyValue,
  confirmKey,
  onConfirmKeyChange,
  onDelete,
  isDeleting,
  status,
}: DangerZoneTabProps) {
  return (
    <section className="rounded-xl border border-red-200 bg-red-50/60 p-6 shadow-sm dark:border-red-900/60 dark:bg-red-950/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
            Danger Zone
          </h2>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Deleting this project will permanently remove all its sprints, issues, and settings. This action cannot be undone.
          </p>
        </div>
        {status && (
          <p className="text-xs text-red-700 dark:text-red-300">{status}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-red-700 dark:text-red-300">
          Type the project key (<span className="font-semibold">{keyValue}</span>) to confirm.
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={confirmKey}
            onChange={(e) => onConfirmKeyChange(e.target.value)}
            placeholder={keyValue}
            className="w-32 rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-900 shadow-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-red-800 dark:bg-red-950 dark:text-red-50"
          />
          <button
            type="button"
            disabled={confirmKey !== keyValue || isDeleting}
            onClick={onDelete}
            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-red-950"
          >
            {isDeleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </div>
    </section>
  );
}
