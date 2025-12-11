"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ResearchDecision, ResearchObservationType, ResearchPriority } from "@prisma/client";

import { ResearchStatus } from "@/lib/prismaEnums";
import type { BacklogTableIssue } from "../issues/BacklogTable";
import Button from "../ui/Button";
import ResearchItemDrawer from "./ResearchItemDrawer";

type ResearchObservation = {
  id: string;
  type: ResearchObservationType;
  content: string;
  createdAt: string;
};

type ResearchIssueLink = {
  id: string;
  issueId: string;
  key: string | null;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string; name: string } | null;
  createdAt: string;
};

type ResearchDetail = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  dueDate: string | null;
  status: ResearchStatus;
  priority: ResearchPriority;
  decision: ResearchDecision;
  tags: string[];
};

type ResearchDetailsDrawerProps = {
  researchItemId: string | null;
  isReadOnly: boolean;
  issues: BacklogTableIssue[];
  open: boolean;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
};

const statusStyles: Record<ResearchStatus, string> = {
  BACKLOG: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  REVIEW: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function ResearchDetailsDrawer({
  researchItemId,
  isReadOnly,
  issues,
  open,
  onClose,
  onUpdated,
}: ResearchDetailsDrawerProps) {
  const [detail, setDetail] = useState<ResearchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [observations, setObservations] = useState<ResearchObservation[]>([]);
  const [links, setLinks] = useState<ResearchIssueLink[]>([]);
  const [observationType, setObservationType] = useState<ResearchObservationType>(
    ResearchObservationType.NOTE
  );
  const [observationContent, setObservationContent] = useState("");
  const [isSavingObservation, setIsSavingObservation] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadDetail = async () => {
    if (!researchItemId) return;
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/research-items/${researchItemId}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to load research details.");
        return;
      }

      const data: ResearchDetail = await response.json();
      setDetail(data);
    } catch (err) {
      setError("An unexpected error occurred while loading details.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadObservations = async () => {
    if (!researchItemId) return;
    try {
      const response = await fetch(`/api/research-items/${researchItemId}/observations`);
      if (!response.ok) return;
      const data: ResearchObservation[] = await response.json();
      setObservations(data);
    } catch (err) {
      // ignore
    }
  };

  const loadLinks = async () => {
    if (!researchItemId) return;
    try {
      const response = await fetch(`/api/research-items/${researchItemId}/issues`);
      if (!response.ok) return;
      const data: ResearchIssueLink[] = await response.json();
      setLinks(data);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (!open || !researchItemId) return;
    loadDetail();
    loadObservations();
    loadLinks();
  }, [open, researchItemId]);

  const updateResearchItem = async (payload: Record<string, unknown>) => {
    if (!researchItemId) return false;
    setActionMessage("");

    try {
      const response = await fetch(`/api/research-items/${researchItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setActionMessage(data?.message ?? "Unable to update research item.");
        return false;
      }

      await loadDetail();
      await onUpdated?.();
      return true;
    } catch (err) {
      setActionMessage("An unexpected error occurred while updating the research item.");
      return false;
    }
  };

  const handleStatusUpdate = async (newStatus: ResearchStatus) => {
    if (isReadOnly) return;
    await updateResearchItem({ status: newStatus });
  };

  const handleObservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!researchItemId) return;

    setIsSavingObservation(true);
    setActionMessage("");

    try {
      const response = await fetch(`/api/research-items/${researchItemId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: observationType, content: observationContent }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setActionMessage(data?.message ?? "Unable to add observation.");
        return;
      }

      setObservationContent("");
      await loadObservations();
      await onUpdated?.();
    } catch (err) {
      setActionMessage("An unexpected error occurred while adding the observation.");
    } finally {
      setIsSavingObservation(false);
    }
  };

  const handleLinkIssue = async (issueId: string) => {
    if (!researchItemId) return;
    setIsLinking(true);
    setActionMessage("");

    try {
      const response = await fetch(`/api/research-items/${researchItemId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setActionMessage(data?.message ?? "Unable to link issue.");
        return;
      }

      await loadLinks();
      await onUpdated?.();
    } catch (err) {
      setActionMessage("An unexpected error occurred while linking the issue.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkIssue = async (issueId: string) => {
    if (!researchItemId) return;
    setIsLinking(true);
    setActionMessage("");

    try {
      const response = await fetch(`/api/research-items/${researchItemId}/issues`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setActionMessage(data?.message ?? "Unable to unlink issue.");
        return;
      }

      await loadLinks();
      await onUpdated?.();
    } catch (err) {
      setActionMessage("An unexpected error occurred while unlinking the issue.");
    } finally {
      setIsLinking(false);
    }
  };

  const formatTag = (tag: string) => tag.replace(/_/g, " ");

  const availableIssues = useMemo(() => {
    const linkedIds = new Set(links.map((link) => link.issueId));
    return issues
      .filter((issue) => !linkedIds.has(issue.id))
      .filter((issue) => {
        if (!issueSearch.trim()) return true;
        const searchTerm = issueSearch.toLowerCase();
        return (
          issue.title.toLowerCase().includes(searchTerm) ||
          issue.key?.toLowerCase().includes(searchTerm)
        );
      });
  }, [issues, issueSearch, links]);

  const initialValues = detail
    ? {
        title: detail.title,
        description: detail.description,
        type: detail.tags[0] ?? null,
        priority: detail.priority,
        status: detail.status,
        decision: detail.decision,
        assigneeId: detail.assigneeId,
        dueDate: detail.dueDate?.slice(0, 10) ?? null,
      }
    : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fade-in" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-[960px] max-w-full flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl animate-slide-in-right">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold text-slate-900">
                {detail?.title ?? "Research Details"}
              </Dialog.Title>
              {detail?.key && (
                <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {detail.key}
                </p>
              )}
              {detail?.status && (
                <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${detail?.status ? statusStyles[detail.status] : ""}`}
                  >
                    {detail?.status.replace(/_/g, " ")}
                  </span>
                  {detail?.dueDate && <span>Due {formatDate(detail.dueDate)}</span>}
                </div>
              )}
              {detail?.assignee && (
                <p className="mt-1 text-sm text-slate-600">Assignee: {detail.assignee.name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {detail && (
                <ResearchItemDrawer
                  projectId={detail.projectId}
                  isReadOnly={isReadOnly}
                  mode="edit"
                  trigger={
                    <Button variant="ghost" disabled={isReadOnly}>
                      Edit
                    </Button>
                  }
                  researchItemId={detail.id}
                  initialValues={initialValues}
                  onSuccess={async () => {
                    await loadDetail();
                    await onUpdated?.();
                  }}
                  onForbidden={() => setError("Forbidden")}
                />
              )}
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {isLoading ? (
            <div className="text-sm text-slate-600">Loading research details...</div>
          ) : detail ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Status & Outcome</h3>
                    <Button
                      variant="secondary"
                      disabled={isReadOnly || detail.status === ResearchStatus.COMPLETED}
                      onClick={() => handleStatusUpdate(ResearchStatus.COMPLETED)}
                    >
                      Mark as Complete
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="statusControl">
                        Status
                      </label>
                      <select
                        id="statusControl"
                        value={detail.status}
                        onChange={(event) => handleStatusUpdate(event.target.value as ResearchStatus)}
                        disabled={isReadOnly}
                        className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                      >
                        {Object.values(ResearchStatus).map((option) => (
                          <option key={option} value={option}>
                            {option.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="priorityControl">
                        Priority
                      </label>
                      <select
                        id="priorityControl"
                        value={detail.priority}
                        onChange={(event) => updateResearchItem({ priority: event.target.value as ResearchPriority })}
                        disabled={isReadOnly}
                        className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                      >
                        {Object.values(ResearchPriority).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="decisionControl">
                        Outcome
                      </label>
                      <select
                        id="decisionControl"
                        value={detail.decision}
                        onChange={(event) => updateResearchItem({ decision: event.target.value as ResearchDecision })}
                        disabled={isReadOnly}
                        className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                      >
                        {Object.values(ResearchDecision).map((option) => (
                          <option key={option} value={option}>
                            {option.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700">Research Type</label>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {detail.tags[0] ? formatTag(detail.tags[0]) : "—"}
                      </div>
                    </div>
                  </div>
                  {actionMessage && (
                    <p className="mt-3 text-sm text-red-600">{actionMessage}</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Description</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {detail.description || "No description provided."}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Observations</h3>
                    <span className="text-xs text-slate-500">{observations.length} entries</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {observations.map((observation) => (
                      <div key={observation.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{observation.type.replace(/_/g, " ")}</span>
                          <span>{formatDate(observation.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-slate-700">{observation.content}</p>
                      </div>
                    ))}
                    {!observations.length && (
                      <p className="text-sm text-slate-600">No observations yet.</p>
                    )}
                  </div>
                  {!isReadOnly && (
                    <form className="mt-4 grid gap-3" onSubmit={handleObservationSubmit}>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="observationType">
                          Type
                        </label>
                        <select
                          id="observationType"
                          value={observationType}
                          onChange={(event) => setObservationType(event.target.value as ResearchObservationType)}
                          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {Object.values(ResearchObservationType).map((option) => (
                            <option key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="observationContent">
                          Details
                        </label>
                        <textarea
                          id="observationContent"
                          value={observationContent}
                          onChange={(event) => setObservationContent(event.target.value)}
                          rows={3}
                          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={isSavingObservation}>
                          {isSavingObservation ? "Saving..." : "Add Observation"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Linked Issues</h3>
                    <span className="text-xs text-slate-500">{links.length} linked</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {links.map((link) => (
                      <div key={link.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{link.key ?? "Un-keyed"}</p>
                            <p className="text-slate-600">{link.title}</p>
                            <p className="text-xs text-slate-500">
                              {link.assignee?.name ? `Assignee: ${link.assignee.name}` : "Unassigned"}
                            </p>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleUnlinkIssue(link.issueId)}
                              className="text-sm text-red-600 hover:underline"
                              disabled={isLinking}
                            >
                              Unlink
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!links.length && <p className="text-sm text-slate-600">No issues linked yet.</p>}
                  </div>
                  {!isReadOnly && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="issueSearch">
                          Search Issues
                        </label>
                        <input
                          id="issueSearch"
                          value={issueSearch}
                          onChange={(event) => setIssueSearch(event.target.value)}
                          placeholder="Search by key or title"
                          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {availableIssues.map((issue) => (
                          <div key={issue.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <div>
                              <p className="font-semibold text-slate-900">{issue.key ?? "Un-keyed"}</p>
                              <p className="text-slate-600">{issue.title}</p>
                            </div>
                            <Button
                              variant="secondary"
                              className="px-3 py-1"
                              disabled={isLinking}
                              onClick={() => handleLinkIssue(issue.id)}
                            >
                              Link
                            </Button>
                          </div>
                        ))}
                        {!availableIssues.length && (
                          <p className="text-sm text-slate-600">No matching issues available.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Select a research item to see details.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
