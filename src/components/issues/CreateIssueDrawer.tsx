"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { IssuePriority, IssueType } from "@/lib/prismaEnums";
import { Button } from "../ui/Button";

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
  const [secondaryAssigneeId, setSecondaryAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const resetForm = () => {
    setTitle("");
    setType(IssueType.STORY);
    setPriority(IssuePriority.MEDIUM);
    setStoryPoints("");
    setAssigneeId("");
    setSecondaryAssigneeId("");
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
          secondaryAssigneeId: secondaryAssigneeId || undefined,
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
        <Button disabled={isReadOnly}>Create Issue</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fade-in" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-[420px] flex-col gap-4 bg-white p-6 shadow-xl animate-slide-in-right dark:bg-slate-950 dark:text-slate-50">
          <div className="space-y-1">
            <Dialog.Title className="text-lg font-semibold">Create New Issue</Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 dark:text-slate-300">
              Capture a new issue for this project.
            </Dialog.Description>
          </div>

          <form className="flex flex-1 flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:disabled:bg-slate-800"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="type">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as IssueType)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
              >
                {Object.values(IssueType).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
              >
                {Object.values(IssuePriority).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="storyPoints">
                Story Points
              </label>
              <input
                id="storyPoints"
                name="storyPoints"
                type="number"
                min="0"
                step="0.1"
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:disabled:bg-slate-800"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="assignee">
                Assignee
              </label>
              <select
                id="assignee"
                name="assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
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
              <label
                className="text-sm font-medium text-gray-700 dark:text-slate-200"
                htmlFor="secondaryAssignee"
              >
                Secondary assignee
              </label>
              <select
                id="secondaryAssignee"
                name="secondaryAssignee"
                value={secondaryAssigneeId}
                onChange={(event) => setSecondaryAssigneeId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
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
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="epic">
                Epic
              </label>
              <select
                id="epic"
                name="epic"
                value={epicId}
                onChange={(event) => setEpicId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:disabled:bg-slate-800"
              >
                <option value="">No epic</option>
                {epicOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? "Creating..." : "Create issue"}
              </Button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 text-gray-500 hover:text-black dark:text-slate-500 dark:hover:text-slate-300" aria-label="Close">
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
