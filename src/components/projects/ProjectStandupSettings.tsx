"use client";

import { useEffect, useMemo, useState } from "react";

import { ProjectRole } from "@/lib/roles";

type StandupSettingsResponse = {
  standupWindowStart: string | null;
  standupWindowEnd: string | null;
  enabled?: boolean;
};

type ProjectStandupSettingsProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50";
const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
const toMinutes = (value: string) => {
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number.parseInt(hoursStr ?? "", 10);
  const minutes = Number.parseInt(minutesStr ?? "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

export default function ProjectStandupSettings({
  projectId,
  projectRole,
}: ProjectStandupSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/settings/standup`
        );
        const data: StandupSettingsResponse | null = await response
          .json()
          .catch(() => null);

        if (!response.ok || !data) {
          throw new Error(
            (data as { message?: string } | null)?.message ??
              "Unable to load stand-up settings."
          );
        }

        if (!isMounted) return;

        const nextEnabled =
          data.enabled ??
          Boolean(data.standupWindowStart && data.standupWindowEnd);

        setEnabled(nextEnabled);
        setStartTime(data.standupWindowStart ?? "09:00");
        setEndTime(data.standupWindowEnd ?? "09:30");
        setStatus(null);
      } catch (fetchError) {
        if (!isMounted) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load stand-up settings."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const validate = (): boolean => {
    if (!enabled) return true;

    if (!startTime || !endTime) {
      setError("Start time and end time are required when enabled.");
      return false;
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setError("Times must be in HH:mm format.");
      return false;
    }

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      setError("End time must be later than start time.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    const isValid = validate();
    if (!isValid) return;

    setIsSaving(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/settings/standup`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled,
            standupWindowStart: enabled ? startTime : null,
            standupWindowEnd: enabled ? endTime : null,
          }),
        }
      );

      const data: StandupSettingsResponse | { message?: string } | null =
        await response.json().catch(() => null);

      if (!response.ok || !data || typeof data !== "object") {
        throw new Error(
          (data as { message?: string } | null)?.message ??
            "Unable to save stand-up settings. Please try again."
        );
      }

      const nextEnabled =
        "enabled" in data
          ? Boolean((data as StandupSettingsResponse).enabled)
          : enabled;

      setEnabled(nextEnabled);
      setStartTime(
        (data as StandupSettingsResponse).standupWindowStart ??
          (enabled ? startTime : "09:00")
      );
      setEndTime(
        (data as StandupSettingsResponse).standupWindowEnd ??
          (enabled ? endTime : "09:30")
      );
      setStatus("Stand-up settings updated successfully.");
    } catch (submitError) {
      setStatus(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save stand-up settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Stand-up Settings
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure the daily stand-up time window for this project.
          </p>
        </div>
        {status && (
          <p className="text-xs text-green-600 dark:text-green-400">{status}</p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Loading stand-up settings...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                Enforce daily stand-up time window
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                When enabled, team members can submit stand-ups only within the configured time range.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle stand-up window enforcement"
              disabled={!canManage}
              onClick={() => canManage && setEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                enabled
                  ? "bg-primary"
                  : "bg-slate-200 dark:bg-slate-700"
              } ${
                !canManage ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  enabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="standup-start-time">
                Start time
              </label>
              <input
                id="standup-start-time"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={!enabled || !canManage}
                className={`${inputClasses} ${
                  !enabled || !canManage
                    ? "cursor-not-allowed bg-slate-50 dark:bg-slate-800"
                    : ""
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="standup-end-time">
                End time
              </label>
              <input
                id="standup-end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                disabled={!enabled || !canManage}
                className={`${inputClasses} ${
                  !enabled || !canManage
                    ? "cursor-not-allowed bg-slate-50 dark:bg-slate-800"
                    : ""
                }`}
              />
            </div>
          </div>

          {!canManage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You do not have permission to manage stand-up settings for this project.
            </p>
          )}

          {canManage && (
            <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
