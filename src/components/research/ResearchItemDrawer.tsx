"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ResearchDecision, ResearchPriority } from "@prisma/client";

import { ResearchStatus } from "@/lib/prismaEnums";
import { Button } from "../ui/Button";

type Attachment = {
  id: string;
  fileName: string;
  url: string;
};

type MemberOption = { id: string; name: string };

type ResearchItemDrawerProps = {
  projectId: string;
  isReadOnly: boolean;
  mode: "create" | "edit";
  trigger: React.ReactNode;
  researchItemId?: string;
  initialValues?: {
    title: string;
    description: string | null;
    type: string | null;
    priority: ResearchPriority | null;
    status: ResearchStatus;
    decision: ResearchDecision | null;
    assigneeId: string | null;
    dueDate: string | null;
    attachments?: Attachment[];
  };
  onSuccess?: () => Promise<void> | void;
  onForbidden?: () => void;
};

export default function ResearchItemDrawer({
  projectId,
  isReadOnly,
  mode,
  trigger,
  researchItemId,
  initialValues,
  onSuccess,
  onForbidden,
}: ResearchItemDrawerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [type, setType] = useState(initialValues?.type ?? "");
  const [priority, setPriority] = useState<ResearchPriority>(
    initialValues?.priority ?? ResearchPriority.MEDIUM
  );
  const [status, setStatus] = useState<ResearchStatus>(
    initialValues?.status ?? ResearchStatus.BACKLOG
  );
  const [decision, setDecision] = useState<ResearchDecision>(
    initialValues?.decision ?? ResearchDecision.PENDING
  );
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>(initialValues?.attachments ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");

  useEffect(() => {
    if (!open || members.length > 0) return;

    const loadMembers = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/members`);

        if (!response.ok) {
          return;
        }

        const data: { user: { id: string; name: string } }[] = await response.json();
        setMembers(
          data.map((member) => ({
            id: member.user.id,
            name: member.user.name ?? "Unknown User",
          }))
        );
      } catch (err) {
        // noop
      }
    };

    loadMembers();
  }, [members.length, open, projectId]);

  useEffect(() => {
    if (!open && mode === "edit" && initialValues) {
      setTitle(initialValues.title ?? "");
      setDescription(initialValues.description ?? "");
      setType(initialValues.type ?? "");
      setPriority(initialValues.priority ?? ResearchPriority.MEDIUM);
      setStatus(initialValues.status);
      setDecision(initialValues.decision ?? ResearchDecision.PENDING);
      setAssigneeId(initialValues.assigneeId ?? "");
      setDueDate(initialValues.dueDate ?? "");
      setAttachments(initialValues.attachments ?? []);
    }

    if (!open && mode === "create") {
      setTitle(initialValues?.title ?? "");
      setDescription(initialValues?.description ?? "");
      setType(initialValues?.type ?? "");
      setPriority(initialValues?.priority ?? ResearchPriority.MEDIUM);
      setDecision(initialValues?.decision ?? ResearchDecision.PENDING);
      setAssigneeId(initialValues?.assigneeId ?? "");
      setDueDate(initialValues?.dueDate ?? "");
      setAttachments(initialValues?.attachments ?? []);
      setAttachmentError("");
    }
  }, [initialValues, mode, open]);

  const isEdit = mode === "edit";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setAttachmentError("");

    try {
      const body = {
        title,
        description: description || null,
        priority,
        decision,
        type: type || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        attachmentIds: attachments.map((file) => file.id),
        ...(isEdit ? { status } : {}),
      };

      const endpoint = isEdit
        ? `/api/research-items/${researchItemId}`
        : `/api/projects/${projectId}/research-items`;
      const response = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 403) {
          onForbidden?.();
          return;
        }

        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to save research item.");
        return;
      }

      setOpen(false);
      await onSuccess?.();
    } catch (err) {
      setError("An unexpected error occurred while saving the research item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentsUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      formData.append("projectId", projectId);

      if (isEdit && researchItemId) {
        formData.append("researchItemId", researchItemId);
      }

      const response = await fetch("/api/uploads", { method: "POST", body: formData });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setAttachmentError(data?.message ?? "Unable to upload attachments.");
        return;
      }

      const data = await response.json();
      setAttachments((prev) => [...prev, ...(data.attachments ?? [])]);
    } catch (err) {
      setAttachmentError("An unexpected error occurred while uploading attachments.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setAttachmentError(data?.message ?? "Unable to delete attachment.");
        return;
      }

      setAttachments((prev) => prev.filter((file) => file.id !== attachmentId));
    } catch (err) {
      setAttachmentError("An unexpected error occurred while deleting the attachment.");
    }
  };

  const memberOptions = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const inputClass =
    "rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:disabled:bg-slate-800";
  const labelClass = "text-sm font-medium text-gray-700 dark:text-slate-200";

  return (
    <Dialog.Root open={open} onOpenChange={(value) => setOpen(!isReadOnly && value)}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fade-in" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-[440px] flex-col gap-4 overflow-hidden bg-white p-6 shadow-xl animate-slide-in-right dark:bg-slate-950 dark:text-slate-50">
          <Dialog.Title className="mb-2 text-lg font-semibold">
            {isEdit ? "Edit Research Item" : "Create Research Item"}
          </Dialog.Title>

          <form className="grid flex-1 gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={isReadOnly}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={description ?? ""}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                disabled={isReadOnly}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Attachments</label>
                <input
                  type="file"
                  multiple
                  disabled={isReadOnly || isUploading}
                  onChange={(event) => handleAttachmentsUpload(event.target.files)}
                  className="text-xs"
                />
              </div>
              {attachments.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {attachments.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 text-gray-800 dark:border-slate-700 dark:text-slate-100"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-medium text-blue-600 hover:underline dark:text-blue-300"
                      >
                        {file.fileName}
                      </a>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-400">No attachments</p>
              )}
              {attachmentError && (
                <p className="text-xs text-red-500">{attachmentError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="type">
                Research Type
              </label>
              <input
                id="type"
                name="type"
                value={type ?? ""}
                onChange={(event) => setType(event.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. User Interview"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as ResearchPriority)}
                disabled={isReadOnly}
                className={inputClass}
              >
                {Object.values(ResearchPriority).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {isEdit && (
              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ResearchStatus)}
                  disabled={isReadOnly}
                  className={inputClass}
                >
                  {Object.values(ResearchStatus).map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="decision">
                Outcome
              </label>
              <select
                id="decision"
                name="decision"
                value={decision}
                onChange={(event) => setDecision(event.target.value as ResearchDecision)}
                disabled={isReadOnly}
                className={inputClass}
              >
                {Object.values(ResearchDecision).map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="assignee">
                Assignee
              </label>
              <select
                id="assignee"
                name="assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={isReadOnly}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="dueDate">
                Due Date
              </label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                value={dueDate ?? ""}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={isReadOnly}
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-950 dark:text-red-100">
                {error}
              </div>
            )}

            <div className="mt-2 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" type="button">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
