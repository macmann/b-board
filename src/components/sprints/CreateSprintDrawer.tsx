"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";

type CreateSprintDrawerProps = {
  projectId: string;
  onSprintCreated?: () => Promise<void> | void;
  onError?: (message: string) => void;
};

export default function CreateSprintDrawer({
  projectId,
  onSprintCreated,
  onError,
}: CreateSprintDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    onError?.("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goal: goal || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? "Unable to create sprint.";
        setError(message);
        onError?.(message);
        return;
      }

      resetForm();
      setOpen(false);
      await onSprintCreated?.();
      router.refresh();
    } catch (err) {
      const message = "An unexpected error occurred while creating the sprint.";
      setError(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
          Create sprint
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fadeIn" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl animate-slideIn">
          <Dialog.Title className="text-lg font-semibold">Create new sprint</Dialog.Title>

          <form className="flex flex-1 flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Sprint name</label>
              <input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Goal (optional)</label>
              <textarea
                name="goal"
                rows={3}
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Start date</label>
                <input
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">End date</label>
                <input
                  type="date"
                  name="endDate"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create sprint"}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">✕</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
