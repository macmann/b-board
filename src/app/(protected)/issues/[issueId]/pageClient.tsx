"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  project: { id: string; name: string };
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
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Issue Details</h1>
          {issue ? (
            <p className="text-gray-600">{issue.id}</p>
          ) : (
            <p className="text-gray-600">Loading issue information</p>
          )}
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          {isLoading ? (
            <p className="text-gray-700">Loading issue...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : issue ? (
            <form className="grid gap-4" onSubmit={handleUpdate}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={disableEditing}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="type">
                    Type
                  </label>
                  <input
                    id="type"
                    name="type"
                    value={issue.type}
                    readOnly
                    className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as IssueStatus)}
                    disabled={disableEditing}
                    className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {Object.values(IssueStatus).map((option) => (
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
                    disabled={disableEditing}
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
                    disabled={disableEditing}
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
                    disabled={disableEditing}
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
                    disabled={disableEditing}
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

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="sprint">
                    Sprint
                  </label>
                  <select
                    id="sprint"
                    name="sprint"
                    value={sprintId}
                    onChange={(event) => setSprintId(event.target.value)}
                    disabled={disableEditing}
                    className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
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

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  disabled={disableEditing}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={disableEditing || isSaving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
                {allowDelete && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                  >
                    {isDeleting ? "Deleting..." : "Delete issue"}
                  </button>
                )}
                {error && <span className="text-sm text-red-600">{error}</span>}
                {disableEditing && (
                  <span className="text-sm text-gray-500">Editing disabled based on your role.</span>
                )}
              </div>
            </form>
          ) : (
            <p className="text-gray-700">Issue not found.</p>
          )}
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
          <div className="mt-4 flex flex-col gap-4">
            {comments.length === 0 ? (
              <p className="text-gray-600">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{comment.author?.name ?? "Unknown"}</span>
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-gray-900">{comment.body}</p>
                </div>
              ))
            )}
          </div>

          <form className="mt-6 flex flex-col gap-3" onSubmit={handleCommentSubmit}>
            <label className="text-sm font-medium text-gray-700" htmlFor="newComment">
              Add a comment
            </label>
            <textarea
              id="newComment"
              name="newComment"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !commentBody.trim()}
              className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmittingComment ? "Posting..." : "Post comment"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
