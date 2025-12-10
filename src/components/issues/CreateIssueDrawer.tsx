"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { IssuePriority, IssueType } from "@/lib/prismaEnums";

type Option = { id: string; label: string };

type CreateIssueDrawerProps = {
  projectId: string;
  isReadOnly: boolean;
  assigneeOptions: Option[];
  epicOptions: Option[];
  onIssueCreated: () => Promise<void> | void;
  onForbidden: () => void;
};

export default function CreateIssueDrawer({
  projectId,
  isReadOnly,
  assigneeOptions,
  epicOptions,
  onIssueCreated,
  onForbidden,
}: CreateIssueDrawerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>(IssueType.STORY);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const resetForm = () => {
    setTitle("");
    setType(IssueType.STORY);
    setPriority(IssuePriority.MEDIUM);
    setStoryPoints("");
    setAssigneeId("");
    setEpicId("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          type,
          priority,
          storyPoints: storyPoints ? Number(storyPoints) : undefined,
          assigneeId: assigneeId || undefined,
          epicId: epicId || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          onForbidden();
          return;
        }

        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to create issue.");
        return;
      }

      resetForm();
      setOpen(false);
      await onIssueCreated();
    } catch (err) {
      setError("An unexpected error occurred while creating the issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => setOpen(!isReadOnly && value)}>
      <Dialog.Trigger asChild>
        <button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isReadOnly}
        >
          Create Issue
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fadeIn" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-[420px] flex-col gap-4 bg-white p-6 shadow-xl animate-slideIn">
          <Dialog.Title className="mb-2 text-lg font-semibold">Create New Issue</Dialog.Title>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="type">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as IssueType)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {Object.values(IssueType).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {Object.values(IssuePriority).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="storyPoints">
                Story Points
              </label>
              <input
                id="storyPoints"
                name="storyPoints"
                type="number"
                min="0"
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="assignee">
                Assignee
              </label>
              <select
                id="assignee"
                name="assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="epic">
                Epic
              </label>
              <select
                id="epic"
                name="epic"
                value={epicId}
                onChange={(event) => setEpicId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">No epic</option>
                {epicOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting || isReadOnly}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create issue"}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 text-gray-500 hover:text-black" aria-label="Close">
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
