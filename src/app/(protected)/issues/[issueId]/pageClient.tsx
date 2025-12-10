"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

import {
  IssuePriority,
  IssueStatus,
  IssueType,
  SprintStatus,
} from "../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../lib/roles";
import { canDeleteIssue, canEditIssue } from "../../../../lib/uiPermissions";

type UserSummary = { id: string; name: string } | null;

type IssueDetails = {
  id: string;
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints: number | null;
  description: string | null;
  key?: string;
  updatedAt?: string;
  project: { id: string; name: string; key?: string };
  sprint: { id: string; name: string } | null;
  epic: { id: string; title: string } | null;
  assignee: UserSummary;
  reporter: UserSummary;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: UserSummary;
};

type SprintSummary = {
  id: string;
  name: string;
  status: SprintStatus;
};

type IssueDetailsPageClientProps = {
  issueId: string;
  projectRole: ProjectRole | null;
  currentUserId: string | null;
  initialSprints: SprintSummary[];
};

export default function IssueDetailsPageClient({
  issueId,
  projectRole,
  currentUserId,
  initialSprints,
}: IssueDetailsPageClientProps) {
  const router = useRouter();

  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sprints, setSprints] = useState<SprintSummary[]>(initialSprints);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<IssueStatus>(IssueStatus.TODO);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [description, setDescription] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const assigneeOptions = useMemo(() => {
    const options = [] as Array<{ id: string; label: string }>;
    if (issue?.assignee) {
      options.push({ id: issue.assignee.id, label: issue.assignee.name });
    }
    return options;
  }, [issue]);

  const epicOptions = useMemo(() => {
    const options = [] as Array<{ id: string; label: string }>;
    if (issue?.epic) {
      options.push({ id: issue.epic.id, label: issue.epic.title });
    }
    return options;
  }, [issue]);

  const sprintOptions = useMemo(() => {
    const options = [] as Array<{ id: string; label: string }>;
    const seen = new Set<string>();

    if (issue?.sprint) {
      options.push({ id: issue.sprint.id, label: issue.sprint.name });
      seen.add(issue.sprint.id);
    }

    sprints.forEach((sprint) => {
      if (
        !seen.has(sprint.id) &&
        (sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE)
      ) {
        options.push({ id: sprint.id, label: sprint.name });
        seen.add(sprint.id);
      }
    });

    return options;
  }, [issue, sprints]);

  const issueIdentifiers = issue
    ? {
        assigneeId: issue.assignee?.id ?? null,
        reporterId: issue.reporter?.id ?? null,
      }
    : null;

  const allowEditing = canEditIssue(projectRole, issueIdentifiers, currentUserId);
  const isViewer = projectRole === "VIEWER";
  const disableEditing = isViewer || !allowEditing;
  const allowDelete = canDeleteIssue(projectRole);

  const baseFieldClasses =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
  const pillBaseClasses =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide";
  const statusPillStyles: Record<IssueStatus, string> = {
    TODO:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
    IN_PROGRESS:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
    IN_REVIEW:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100",
    DONE:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100",
  };
  const priorityPillStyles: Record<IssuePriority, string> = {
    LOW:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
    MEDIUM:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-100",
    HIGH:
      "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-100",
    CRITICAL:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100",
  };
  const formattedUpdatedAt = issue?.updatedAt
    ? new Date(issue.updatedAt).toLocaleString()
    : "Recently";
  const issueKey = issue?.key ?? issue?.id ?? issueId;
  const projectKey = issue?.project?.key ?? issue?.project?.name ?? "Project";

  const fetchIssue = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/issues/${issueId}`);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to load issue.");
        return;
      }

      const data = (await response.json()) as IssueDetails;
      setIssue(data);
      setTitle(data.title);
      setStatus(data.status);
      setPriority(data.priority);
      setStoryPoints(data.storyPoints?.toString() ?? "");
      setAssigneeId(data.assignee?.id ?? "");
      setEpicId(data.epic?.id ?? "");
      setSprintId(data.sprint?.id ?? "");
      setDescription(data.description ?? "");

    } catch (err) {
      setError("An unexpected error occurred while loading the issue.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/comments`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as Comment[];
      setComments(data);
    } catch (err) {
      // ignore comment loading errors in UI
    }
  };

  useEffect(() => {
    if (!issueId) return;
    fetchIssue();
    fetchComments();
  }, [issueId]);

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          priority,
          storyPoints: storyPoints === "" ? null : Number(storyPoints),
          assigneeId: assigneeId || null,
          epicId: epicId || null,
          sprintId: sprintId || null,
          description,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to update issue.");
        return;
      }

      const data = (await response.json()) as IssueDetails;
      setIssue(data);
      setTitle(data.title);
      setStatus(data.status);
      setPriority(data.priority);
      setStoryPoints(data.storyPoints?.toString() ?? "");
      setAssigneeId(data.assignee?.id ?? "");
      setEpicId(data.epic?.id ?? "");
      setSprintId(data.sprint?.id ?? "");
      setDescription(data.description ?? "");
    } catch (err) {
      setError("An unexpected error occurred while updating the issue.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!issue) return;
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/issues/${issueId}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to delete issue.");
        return;
      }

      router.push(`/projects/${issue.project.id}/backlog`);
    } catch (err) {
      setError("An unexpected error occurred while deleting the issue.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentBody.trim()) return;

    setIsSubmittingComment(true);

    try {
      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });

      if (response.ok) {
        setCommentBody("");
        await fetchComments();
      }
    } catch (err) {
      // ignore errors for now
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Issue</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            {issue?.title || title || "Untitled issue"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{issueKey} · {projectKey}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          {isLoading ? (
            <p className="text-sm text-slate-700 dark:text-slate-200">Loading issue...</p>
          ) : error && !issue ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : issue ? (
            <>
              <form
                onSubmit={handleUpdate}
                className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]"
              >
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white/60 p-6 shadow-inner dark:border-slate-800 dark:bg-slate-900">
                    <div className="space-y-2">
                      <label
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        htmlFor="title"
                      >
                        Title
                      </label>
                      <input
                        id="title"
                        name="title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        disabled={disableEditing}
                        className={`${baseFieldClasses} text-lg font-semibold`}
                        placeholder="Add a concise issue title"
                      />
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{issueKey}</p>
                    </div>

                    <div className="mt-6 space-y-2">
                      <label
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        htmlFor="description"
                      >
                        Description
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Supports Markdown for rich formatting. Try **bold**, _italic_, bullet lists, and links.
                      </p>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                          <span className="inline-flex h-2 w-2 rounded-full bg-slate-300" />
                          <span>Markdown supported</span>
                          <span className="hidden text-[11px] sm:inline">Use # headings, * lists, and `code`</span>
                        </div>
                        <textarea
                          id="description"
                          name="description"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          rows={7}
                          disabled={disableEditing}
                          className="w-full border-none bg-transparent px-3 pb-3 pt-3 text-sm text-slate-900 outline-none focus:ring-0 dark:text-slate-50"
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
                          <span className="font-semibold uppercase tracking-wide">Preview</span>
                          <span className="text-[11px]">Rendered Markdown</span>
                        </div>
                        <div className="markdown-content px-3 pb-3 pt-2 text-sm text-slate-900 dark:text-slate-100">
                          {description.trim() ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                          ) : (
                            <p className="text-slate-500 dark:text-slate-400">Nothing to preview yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <div>Last updated {formattedUpdatedAt}</div>
                        {disableEditing && <div className="text-[11px]">Editing disabled based on your role.</div>}
                        {error && <div className="text-[11px] text-red-500">{error}</div>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {allowDelete && (
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="inline-flex items-center rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60"
                          >
                            {isDeleting ? "Deleting..." : "Delete issue"}
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={disableEditing || isSaving}
                          className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                        >
                          {isSaving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Status & Workflow
                    </p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="type">
                          Type
                        </label>
                        <input
                          id="type"
                          name="type"
                          value={issue.type}
                          readOnly
                          className={`${baseFieldClasses} bg-slate-50 dark:bg-slate-800`}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="status">
                            Status
                          </label>
                          <span className={`${pillBaseClasses} ${statusPillStyles[status]}`}>{status}</span>
                        </div>
                        <select
                          id="status"
                          name="status"
                          value={status}
                          onChange={(event) => setStatus(event.target.value as IssueStatus)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        >
                          {Object.values(IssueStatus).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="priority">
                            Priority
                          </label>
                          <span className={`${pillBaseClasses} ${priorityPillStyles[priority]}`}>{priority}</span>
                        </div>
                        <select
                          id="priority"
                          name="priority"
                          value={priority}
                          onChange={(event) => setPriority(event.target.value as IssuePriority)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        >
                          {Object.values(IssuePriority).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="sprint">
                          Sprint
                        </label>
                        <select
                          id="sprint"
                          name="sprint"
                          value={sprintId}
                          onChange={(event) => setSprintId(event.target.value)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        >
                          <option value="">No sprint</option>
                          {sprintOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assignment</p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="assignee">
                          Assignee
                        </label>
                        <select
                          id="assignee"
                          name="assignee"
                          value={assigneeId}
                          onChange={(event) => setAssigneeId(event.target.value)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        >
                          <option value="">Unassigned</option>
                          {assigneeOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="epic">
                          Epic
                        </label>
                        <select
                          id="epic"
                          name="epic"
                          value={epicId}
                          onChange={(event) => setEpicId(event.target.value)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        >
                          <option value="">No epic</option>
                          {epicOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Estimation</p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="storyPoints">
                          Story Points
                        </label>
                        <input
                          id="storyPoints"
                          name="storyPoints"
                          type="number"
                          min="0"
                          value={storyPoints}
                          onChange={(event) => setStoryPoints(event.target.value)}
                          disabled={disableEditing}
                          className={baseFieldClasses}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Comments</h2>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Conversation</p>
                    </div>
                    <div className="mt-4">
                      {comments.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">No comments yet.</p>
                      ) : (
                        <ul className="space-y-3">
                          {comments.map((comment) => (
                            <li
                              key={comment.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                                <span>{comment.author?.name ?? "Unknown"}</span>
                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                              <div className="markdown-content mt-2 text-slate-900 dark:text-slate-100">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <form className="mt-6 space-y-3" onSubmit={handleCommentSubmit}>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="newComment">
                          Add a comment
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Use Markdown to add emphasis, lists, and links.</p>
                        <textarea
                          id="newComment"
                          name="newComment"
                          value={commentBody}
                          onChange={(event) => setCommentBody(event.target.value)}
                          rows={3}
                          className={baseFieldClasses}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingComment || !commentBody.trim()}
                        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {isSubmittingComment ? "Posting..." : "Post comment"}
                      </button>
                    </form>
                  </section>
                </div>

                <div className="hidden md:block" />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-200">Issue not found.</p>
          )}
        </section>
      </div>
    </main>
  );
}
