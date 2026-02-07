"use client";

import {
  ChangeEvent,
  Fragment,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BuildEnvironment,
  BuildStatus,
  IssuePriority,
  IssueStatus,
  IssueType,
  SprintStatus,
} from "../../../../lib/prismaEnums";
import IssueTypeIcon, {
  ISSUE_TYPE_METADATA,
} from "../../../../components/issues/IssueTypeIcon";

import { Badge } from "@/components/ui/Badge";
import { routes } from "@/lib/routes";
import { PROJECT_CONTRIBUTOR_ROLES } from "@/lib/roles";
import { ProjectRole } from "../../../../lib/roles";
import { canDeleteIssue, canEditIssue } from "../../../../lib/uiPermissions";
import AuditLogList from "@/components/audit/AuditLogList";
import InlineMarkdownField from "@/components/markdown/InlineMarkdownField";

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
  secondaryAssignee: UserSummary;
  reporter: UserSummary;
  attachments: Attachment[];
  buildLinks?: IssueBuildLink[];
};

type AssigneeOption = { id: string; label: string };

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: UserSummary;
  attachments: Attachment[];
};

type Attachment = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type BuildSummary = {
  id: string;
  key: string;
  name: string | null;
  status: BuildStatus;
  environment: BuildEnvironment;
  plannedAt: string | null;
  deployedAt: string | null;
  projectId: string;
};

type IssueBuildLink = { build: BuildSummary | null };

type UserStoryDraft = {
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  outOfScope?: string[];
};

type AISuggestionPayload = {
  recommendedTitle?: string;
  recommendedDescription?: string;
  recommendedAcceptanceCriteria?: string[];
  notes?: string[];
} & UserStoryDraft;

type AISuggestion = {
  id: string;
  targetId: string;
  suggestionType: string;
  title: string;
  rationaleBullets?: string[] | null;
  confidence?: number | null;
  payload: AISuggestionPayload;
  status?: string;
};

type SuggestionGroup = { targetId: string; suggestions: AISuggestion[] };

type SprintSummary = {
  id: string;
  name: string;
  status: SprintStatus;
};

type EpicSummary = {
  id: string;
  title: string;
};

type IssueDetailsPageClientProps = {
  issueId: string;
  projectRole: ProjectRole | null;
  currentUserId: string | null;
  initialSprints: SprintSummary[];
  initialEpics: EpicSummary[];
};

type AISuggestionCardProps = {
  suggestion: AISuggestion;
  decisionLoadingId: string | null;
  onAccept?: () => void;
  onReject: () => void;
  onSnooze: (days: number) => void;
  onPreview?: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  disableActions?: boolean;
  caption?: ReactNode;
};

function AISuggestionRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
      {children}
    </div>
  );
}

function getSuggestionSummary(suggestion: AISuggestion) {
  if (suggestion.payload?.recommendedDescription) {
    return suggestion.payload.recommendedDescription;
  }

  if (suggestion.payload?.description) {
    return suggestion.payload.description;
  }

  if (suggestion.payload?.notes?.length) {
    return suggestion.payload.notes[0];
  }

  if (suggestion.rationaleBullets?.length) {
    return suggestion.rationaleBullets[0];
  }

  return "";
}

function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onSnooze,
  onPreview,
  onPrimaryAction,
  primaryActionLabel,
  decisionLoadingId,
  disableActions,
  caption,
}: AISuggestionCardProps) {
  const confidenceLabel =
    typeof suggestion.confidence === "number"
      ? `${Math.round(suggestion.confidence * 100)}%`
      : null;

  const summary = getSuggestionSummary(suggestion);

  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-shrink-0 flex-col justify-between rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {suggestion.suggestionType}
            </span>
            {confidenceLabel ? (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-inner dark:bg-emerald-900/50 dark:text-emerald-100">
                {confidenceLabel}
              </span>
            ) : null}
          </div>
          {caption}
        </div>

        <div className="space-y-1">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {suggestion.title}
          </p>
          {summary ? (
            <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No preview available.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {onPrimaryAction && primaryActionLabel ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={disableActions}
            className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {primaryActionLabel}
          </button>
        ) : null}

        {onAccept ? (
          <button
            type="button"
            onClick={onAccept}
            disabled={disableActions || decisionLoadingId === suggestion.id}
            className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {decisionLoadingId === suggestion.id ? "Saving..." : "Accept"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onReject}
          disabled={disableActions || decisionLoadingId === suggestion.id}
          className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Reject
        </button>

        {[7, 14, 30].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onSnooze(days)}
            disabled={disableActions || decisionLoadingId === suggestion.id}
            className="inline-flex items-center rounded-full border border-amber-200 px-3 py-1 text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/30"
          >
            Snooze {days}d
          </button>
        ))}

        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Preview
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function IssueDetailsPageClient({
  issueId,
  projectRole,
  currentUserId,
  initialSprints,
  initialEpics,
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
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
  const [linkedBuilds, setLinkedBuilds] = useState<BuildSummary[]>([]);
  const [buildSearch, setBuildSearch] = useState("");
  const [buildResults, setBuildResults] = useState<BuildSummary[]>([]);
  const [isSearchingBuilds, setIsSearchingBuilds] = useState(false);
  const [linkingBuildId, setLinkingBuildId] = useState<string | null>(null);
  const [removingBuildId, setRemovingBuildId] = useState<string | null>(null);
  const [buildActionMessage, setBuildActionMessage] = useState("");
  const [isUploadingIssueFiles, setIsUploadingIssueFiles] = useState(false);
  const [isUploadingCommentFiles, setIsUploadingCommentFiles] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [suggestionError, setSuggestionError] = useState("");
  const [autofillError, setAutofillError] = useState("");
  const [autofillActionError, setAutofillActionError] = useState("");
  const [isGeneratingAutofill, setIsGeneratingAutofill] = useState(false);
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [applyModalSuggestion, setApplyModalSuggestion] = useState<
    AISuggestion | null
  >(null);
  const [applySelection, setApplySelection] = useState({
    title: true,
    description: true,
    criteria: true,
  });
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [previewSuggestion, setPreviewSuggestion] = useState<AISuggestion | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>(IssueType.STORY);
  const [status, setStatus] = useState<IssueStatus>(IssueStatus.TODO);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [secondaryAssigneeId, setSecondaryAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [description, setDescription] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [activityTab, setActivityTab] = useState<"comments" | "audit">("comments");
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  const epicOptions = useMemo(() => {
    const options = [] as Array<{ id: string; label: string }>;
    const seen = new Set<string>();

    initialEpics.forEach((epic) => {
      if (!seen.has(epic.id)) {
        options.push({ id: epic.id, label: epic.title });
        seen.add(epic.id);
      }
    });

    if (issue?.epic && !seen.has(issue.epic.id)) {
      options.push({ id: issue.epic.id, label: issue.epic.title });
    }

    return options;
  }, [initialEpics, issue]);

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
        secondaryAssigneeId: issue.secondaryAssignee?.id ?? null,
        reporterId: issue.reporter?.id ?? null,
      }
    : null;

  const allowEditing = canEditIssue(projectRole, issueIdentifiers, currentUserId);
  const isViewer = projectRole === "VIEWER";
  const disableEditing = isViewer || !allowEditing;
  const allowDelete = canDeleteIssue(projectRole);
  const canEditBuildLinks = useMemo(
    () => (projectRole ? PROJECT_CONTRIBUTOR_ROLES.includes(projectRole) : false),
    [projectRole]
  );
  const linkedBuildIds = useMemo(
    () => new Set(linkedBuilds.map((build) => build.id)),
    [linkedBuilds]
  );

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
  const reporterName = issue?.reporter?.name ?? "Unknown";

  const buildStatusLabels: Record<BuildStatus, string> = {
    [BuildStatus.PLANNED]: "Planned",
    [BuildStatus.IN_PROGRESS]: "In progress",
    [BuildStatus.DEPLOYED]: "Deployed",
    [BuildStatus.ROLLED_BACK]: "Rolled back",
    [BuildStatus.CANCELLED]: "Cancelled",
  };

  const buildEnvironmentLabels: Record<BuildEnvironment, string> = {
    [BuildEnvironment.DEV]: "Dev",
    [BuildEnvironment.STAGING]: "Staging",
    [BuildEnvironment.UAT]: "UAT",
    [BuildEnvironment.PROD]: "Prod",
  };

  const buildBadgeVariants: Partial<Record<BuildStatus, "neutral" | "success" | "info">> = {
    [BuildStatus.DEPLOYED]: "success",
    [BuildStatus.IN_PROGRESS]: "info",
  };
  const projectKey = issue?.project?.key ?? issue?.project?.name ?? "Project";
  const autofillSuggestion = useMemo(
    () =>
      suggestions.find((item) => item.suggestionType === "AUTOFILL_USER_STORY") ?? null,
    [suggestions]
  );
  const otherSuggestions = useMemo(
    () => suggestions.filter((item) => item.suggestionType !== "AUTOFILL_USER_STORY"),
    [suggestions]
  );
  const activityTabButton = (tab: "comments" | "audit") =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      activityTab === tab
        ? "bg-primary text-white shadow-sm"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    }`;
  const hasApplySelection =
    applySelection.title || applySelection.description || applySelection.criteria;

  const mapBuild = useCallback(
    (build: any, projectIdOverride?: string): BuildSummary => ({
      id: build.id,
      key: build.key ?? build.id,
      name: build.name ?? null,
      status: build.status as BuildStatus,
      environment: build.environment as BuildEnvironment,
      plannedAt: build.plannedAt ?? null,
      deployedAt: build.deployedAt ?? null,
      projectId: build.projectId ?? projectIdOverride ?? issue?.project?.id ?? "",
    }),
    [issue?.project?.id]
  );

  const sortedLinkedBuilds = useMemo(() => {
    const latestTimestamp = (build: BuildSummary) => {
      const deployed = build.deployedAt ? new Date(build.deployedAt).getTime() : -Infinity;
      const planned = build.plannedAt ? new Date(build.plannedAt).getTime() : -Infinity;
      return Math.max(deployed, planned);
    };

    return [...linkedBuilds].sort((a, b) => latestTimestamp(b) - latestTimestamp(a));
  }, [linkedBuilds]);

  const fetchAssignees = useCallback(
    async (projectId: string) => {
      try {
        const response = await fetch(`/api/projects/${projectId}/members`);

        if (!response.ok) {
          return;
        }

        const members = (await response.json()) as Array<{
          user: { id: string; name: string | null } | null;
        }>;

        setAssigneeOptions(
          members
            .map((member) => member.user)
            .filter(Boolean)
            .map((user) => ({ id: user!.id, label: user!.name ?? "Unassigned" }))
        );
      } catch (error) {
        // If we can't load project members, fall back to any existing assignee.
        if (issue?.assignee) {
          setAssigneeOptions([
            { id: issue.assignee.id, label: issue.assignee.name },
          ]);
        }
      }
    },
    [issue?.assignee]
  );

  const refreshBuildLinks = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as IssueDetails;
      const mappedBuilds = (data.buildLinks ?? [])
        .map((link) => (link.build ? mapBuild(link.build, data.project?.id) : null))
        .filter((build): build is BuildSummary => Boolean(build));
      setLinkedBuilds(mappedBuilds);
    } catch (error) {
      // ignore refresh errors
    }
  }, [issueId, mapBuild]);

  const fetchBuildSuggestions = useCallback(
    async (query: string) => {
      if (!issue?.project?.id) return;

      const trimmed = query.trim();
      if (!trimmed) {
        setBuildResults([]);
        return;
      }

      setIsSearchingBuilds(true);
      setBuildActionMessage("");

      try {
        const params = new URLSearchParams();
        params.set("search", trimmed);

        const response = await fetch(
          `/api/projects/${issue.project.id}/builds?${params.toString()}`
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setBuildActionMessage(body?.message ?? "Unable to search builds");
          return;
        }

        const data = (await response.json()) as any[];
        const mapped = data
          .map((build) => mapBuild(build, issue.project.id))
          .filter((build) => !linkedBuildIds.has(build.id));
        setBuildResults(mapped.slice(0, 8));
      } catch (error) {
        setBuildActionMessage("Unable to search builds");
      } finally {
        setIsSearchingBuilds(false);
      }
    },
    [issue?.project?.id, linkedBuildIds, mapBuild]
  );

  const handleLinkBuild = useCallback(
    async (buildId: string) => {
      if (!buildId) return;

      setLinkingBuildId(buildId);
      setBuildActionMessage("");

      try {
        const response = await fetch(`/api/builds/${buildId}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueIds: [issueId] }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setBuildActionMessage(body?.message ?? "Unable to link build");
          return;
        }

        const candidateBuild =
          linkedBuilds.find((build) => build.id === buildId) ||
          buildResults.find((build) => build.id === buildId);

        if (candidateBuild) {
          setLinkedBuilds((prev) =>
            prev.some((build) => build.id === candidateBuild.id)
              ? prev
              : [...prev, candidateBuild]
          );
          setBuildResults((prev) => prev.filter((build) => build.id !== buildId));
        } else {
          await refreshBuildLinks();
        }
      } catch (error) {
        setBuildActionMessage("Unable to link build");
      } finally {
        setLinkingBuildId(null);
      }
    },
    [buildResults, issueId, linkedBuilds, refreshBuildLinks]
  );

  const handleRemoveBuild = useCallback(
    async (buildId: string) => {
      if (!buildId) return;

      setRemovingBuildId(buildId);
      setBuildActionMessage("");

      try {
        const response = await fetch(`/api/builds/${buildId}/issues`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueIds: [issueId] }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setBuildActionMessage(body?.message ?? "Unable to remove build");
          return;
        }

        setLinkedBuilds((prev) => prev.filter((build) => build.id !== buildId));
      } catch (error) {
        setBuildActionMessage("Unable to remove build");
      } finally {
        setRemovingBuildId(null);
      }
    },
    [issueId]
  );

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
      setType(data.type);
      setStatus(data.status);
      setPriority(data.priority);
      setStoryPoints(data.storyPoints?.toString() ?? "");
      setAssigneeId(data.assignee?.id ?? "");
      setSecondaryAssigneeId(data.secondaryAssignee?.id ?? "");
      setEpicId(data.epic?.id ?? "");
      setSprintId(data.sprint?.id ?? "");
      setDescription(data.description ?? "");
      setAttachments(data.attachments ?? []);
      const mappedBuilds = (data.buildLinks ?? [])
        .map((link) => (link.build ? mapBuild(link.build, data.project?.id) : null))
        .filter((build): build is BuildSummary => Boolean(build));
      setLinkedBuilds(mappedBuilds);
      if (data.project?.id) {
        void fetchAssignees(data.project.id);
      }

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

  const fetchSuggestions = useCallback(
    async (projectId: string, targetId?: string) => {
      setIsLoadingSuggestions(true);
      setSuggestionError("");

      try {
        const params = new URLSearchParams({ excludeSnoozed: "true" });
        if (targetId) {
          params.set("targetId", targetId);
        }

        const response = await fetch(
          `/api/projects/${projectId}/ai-suggestions${
            params.toString() ? `?${params.toString()}` : ""
          }`
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setSuggestionError(
            data?.message ?? "Failed to load AI suggestions for this issue."
          );
          return;
        }

        const rawData = (await response.json()) as
          | AISuggestion[]
          | SuggestionGroup[];
        const normalizedSuggestions =
          Array.isArray(rawData) && rawData.length > 0 &&
          typeof (rawData[0] as SuggestionGroup).suggestions !== "undefined"
            ? (rawData as SuggestionGroup[]).flatMap((group) => group.suggestions ?? [])
            : (rawData as AISuggestion[]);

        setSuggestions(normalizedSuggestions ?? []);
      } catch (err) {
        setSuggestionError(
          "An unexpected error occurred while loading AI suggestions."
        );
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    []
  );

  const uploadAttachments = async (files: FileList, target: "issue" | "comment") => {
    if (!files.length) return;
    setError("");

    const setUploading = target === "issue" ? setIsUploadingIssueFiles : setIsUploadingCommentFiles;
    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      formData.append("issueId", issueId);

      const response = await fetch("/api/uploads", { method: "POST", body: formData });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to upload attachments.");
        return;
      }

      const data = await response.json();
      const uploaded = (data.attachments ?? []) as Attachment[];

      if (target === "issue") {
        setAttachments((prev) => [...prev, ...uploaded]);
      } else {
        setCommentAttachments((prev) => [...prev, ...uploaded]);
      }
    } catch (err) {
      setError("An unexpected error occurred while uploading attachments.");
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to delete attachment.");
        return;
      }

      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      setCommentAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      setComments((prev) =>
        prev.map((comment) => ({
          ...comment,
          attachments: comment.attachments?.filter((item) => item.id !== attachmentId) ?? [],
        }))
      );
    } catch (err) {
      setError("An unexpected error occurred while deleting the attachment.");
    }
  };

  useEffect(() => {
    if (!issueId) return;
    fetchIssue();
    fetchComments();
  }, [issueId]);

  useEffect(() => {
    if (!issue?.project?.id || !issue?.id) return;
    void fetchSuggestions(issue.project.id, issue.id);
  }, [fetchSuggestions, issue?.id, issue?.project?.id]);

  useEffect(() => {
    if (!canEditBuildLinks) return undefined;

    const handler = window.setTimeout(() => {
      void fetchBuildSuggestions(buildSearch);
    }, 250);

    return () => window.clearTimeout(handler);
  }, [buildSearch, canEditBuildLinks, fetchBuildSuggestions]);

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
          type,
          priority,
          storyPoints: storyPoints === "" ? null : Number(storyPoints),
          assigneeId: assigneeId || null,
          secondaryAssigneeId: secondaryAssigneeId || null,
          epicId: epicId || null,
          sprintId: sprintId || null,
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
      setType(data.type);
      setStatus(data.status);
      setPriority(data.priority);
      setStoryPoints(data.storyPoints?.toString() ?? "");
      setAssigneeId(data.assignee?.id ?? "");
      setSecondaryAssigneeId(data.secondaryAssignee?.id ?? "");
      setEpicId(data.epic?.id ?? "");
      setSprintId(data.sprint?.id ?? "");
      setDescription(data.description ?? "");
      if (data.project?.id) {
        void fetchAssignees(data.project.id);
      }
    } catch (err) {
      setError("An unexpected error occurred while updating the issue.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDescriptionSave = useCallback(
    async (nextValue: string) => {
      if (!issueId) return;
      setError("");

      try {
        const response = await fetch(`/api/issues/${issueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: nextValue }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? "Failed to update issue.";
          setError(message);
          throw new Error(message);
        }

        const data = (await response.json()) as IssueDetails;
        setIssue((prev) =>
          prev
            ? {
                ...prev,
                description: data.description,
                updatedAt: data.updatedAt ?? prev.updatedAt,
              }
            : data
        );
        setDescription(data.description ?? "");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred while updating the issue.";
        setError(message);
        throw new Error(message);
      }
    },
    [issueId]
  );

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
        body: JSON.stringify({
          body: commentBody,
          attachmentIds: commentAttachments.map((item) => item.id),
        }),
      });

      if (response.ok) {
        setCommentBody("");
        setCommentAttachments([]);
        await fetchComments();
      }
    } catch (err) {
      // ignore errors for now
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleIssueAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadAttachments(event.target.files, "issue");
      event.target.value = "";
    }
  };

  const handleCommentAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadAttachments(event.target.files, "comment");
      event.target.value = "";
    }
  };

  const handleDecision = async (
    suggestionId: string,
    action: "ACCEPT" | "REJECT" | "SNOOZE",
    snoozeDays?: number
  ) => {
    if (!issue?.project?.id) return;
    setDecisionLoadingId(suggestionId);
    setSuggestionError("");

    try {
      const response = await fetch(
        `/api/projects/${issue.project.id}/ai-suggestions/${suggestionId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, snoozeDays }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setSuggestionError(data?.message ?? "Failed to update suggestion.");
        return;
      }

      void fetchSuggestions(issue.project.id, issue.id);
    } catch (err) {
      setSuggestionError("An unexpected error occurred while updating the suggestion.");
    } finally {
      setDecisionLoadingId(null);
    }
  };

  const triggerAutofill = async () => {
    if (!issue?.project?.id || !issueKey) return;
    setAutofillError("");
    setAutofillActionError("");
    setIsGeneratingAutofill(true);

    try {
      const response = await fetch(
        `/api/projects/${issue.project.id}/issues/${issueKey}/ai/autofill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "ON_DEMAND" }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setAutofillError(
          data?.message ?? "Failed to generate an AI user story draft."
        );
        return;
      }

      const created = (await response.json()) as AISuggestion;
      setSuggestions((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    } catch (err) {
      setAutofillError("An unexpected error occurred while generating the draft.");
    } finally {
      setIsGeneratingAutofill(false);
    }
  };

  const applyAutofill = async (suggestion: AISuggestion) => {
    if (!issue?.project?.id) return;
    setIsApplying(true);
    setAutofillActionError("");

    try {
      const response = await fetch(
        `/api/projects/${issue.project.id}/ai-suggestions/${suggestion.id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applyDescription: true }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setAutofillActionError(data?.message ?? "Failed to apply AI draft.");
        return;
      }

      await fetchIssue();
      void fetchSuggestions(issue.project.id, issue.id);
    } catch (err) {
      setAutofillActionError("An unexpected error occurred while applying the draft.");
    } finally {
      setIsApplying(false);
    }
  };

  const openApplyModal = (suggestion: AISuggestion) => {
    const {
      recommendedTitle,
      recommendedDescription,
      recommendedAcceptanceCriteria,
    } = suggestion.payload ?? {};
    setApplySelection({
      title: Boolean(recommendedTitle),
      description: Boolean(recommendedDescription),
      criteria: (recommendedAcceptanceCriteria?.length ?? 0) > 0,
    });
    setApplyError("");
    setApplyModalSuggestion(suggestion);
  };

  const handleApplyEdits = async () => {
    if (!issue?.project?.id || !applyModalSuggestion) return;
    setIsApplying(true);
    setApplyError("");

    try {
      const response = await fetch(
        `/api/projects/${issue.project.id}/ai-suggestions/${applyModalSuggestion.id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applyTitle: applySelection.title,
            applyDescription: applySelection.description,
            applyAcceptanceCriteria: applySelection.criteria,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setApplyError(data?.message ?? "Failed to apply edits.");
        return;
      }

      await fetchIssue();
      void fetchSuggestions(issue.project.id, issue.id);
      setApplyModalSuggestion(null);
    } catch (err) {
      setApplyError("An unexpected error occurred while applying edits.");
    } finally {
      setIsApplying(false);
    }
  };

  const renderPreviewContent = (suggestion: AISuggestion) => {
    const sharedNotes = (
      <>
        {(suggestion.rationaleBullets?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rationale</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
              {suggestion.rationaleBullets?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {suggestion.payload?.notes?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
              {suggestion.payload.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    );

    if (suggestion.suggestionType === "AUTOFILL_USER_STORY") {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          {suggestion.payload.userStory ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">User Story</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                {suggestion.payload.userStory}
              </p>
            </div>
          ) : null}

          {suggestion.payload.description ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</p>
              <div className="prose prose-sm max-w-none rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {suggestion.payload.description}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}

          {suggestion.payload.acceptanceCriteria?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Acceptance Criteria
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
                {suggestion.payload.acceptanceCriteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestion.payload.assumptions?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assumptions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
                {suggestion.payload.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestion.payload.openQuestions?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Open Questions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
                {suggestion.payload.openQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestion.payload.outOfScope?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Out of Scope</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-100">
                {suggestion.payload.outOfScope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sharedNotes}
        </div>
      );
    }

    if (suggestion.suggestionType === "IMPROVE_TEXT") {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          {suggestion.payload?.recommendedTitle && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Proposed Title
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {suggestion.payload.recommendedTitle}
              </p>
            </div>
          )}

          {suggestion.payload?.recommendedDescription && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Proposed Description
              </p>
              <div className="rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {suggestion.payload.recommendedDescription}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {suggestion.payload?.recommendedAcceptanceCriteria?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Proposed Acceptance Criteria
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-100">
                {suggestion.payload.recommendedAcceptanceCriteria.map((criteria) => (
                  <li key={criteria}>{criteria}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sharedNotes}
        </div>
      );
    }

    return (
      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
        {getSuggestionSummary(suggestion) ? (
          <p className="leading-6 text-slate-700 dark:text-slate-200">{getSuggestionSummary(suggestion)}</p>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">No details provided.</p>
        )}
        {sharedNotes}
      </div>
    );
  };

  return (
    <>
      <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Issue</p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              {issue?.title || title || "Untitled issue"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{issueKey} · {projectKey}</p>
            {issue?.epic && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Epic: <span className="font-medium text-slate-800 dark:text-slate-100">{issue.epic.title}</span>
              </p>
            )}
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 w-1/3 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ) : error && !issue ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : issue ? (
              <Fragment>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <form onSubmit={handleUpdate} className="space-y-6">
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

                    <div className="mt-6 space-y-4">
                      <InlineMarkdownField
                        value={description}
                        placeholder="Add a description…"
                        canEdit={!disableEditing}
                        onSave={handleDescriptionSave}
                      />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Attachments</p>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100">
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={handleIssueAttachmentChange}
                              disabled={disableEditing || isUploadingIssueFiles}
                            />
                            {isUploadingIssueFiles ? "Uploading..." : "Add files"}
                          </label>
                        </div>
                        {attachments.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">No attachments yet.</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {attachments.map((file) => (
                              <li
                                key={file.id}
                                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-slate-700 shadow-sm dark:border-slate-800 dark:text-slate-100"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-sm font-medium text-primary hover:underline"
                                  >
                                    {file.fileName}
                                  </a>
                                  <a
                                    href={file.url}
                                    download={file.fileName}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                  >
                                    Download
                                  </a>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAttachmentDelete(file.id)}
                                  className="text-xs font-semibold text-red-500 hover:text-red-600"
                                  disabled={disableEditing}
                                >
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
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
                </form>

              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        AI Suggestions
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">AI drafts. Review before applying.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={triggerAutofill}
                        disabled={isGeneratingAutofill}
                        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {isGeneratingAutofill ? "Generating..." : "Generate draft"}
                      </button>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase text-slate-700 shadow-inner dark:bg-slate-800 dark:text-slate-200">
                        AI draft
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {autofillError && (
                      <p className="text-sm text-red-500">{autofillError}</p>
                    )}
                    {isLoadingSuggestions ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">Loading suggestions...</p>
                ) : suggestionError ? (
                      <p className="text-sm text-red-500">{suggestionError}</p>
                    ) : suggestions.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        No AI drafts yet. Trigger backlog grooming to see ideas here.
                      </p>
                    ) : (
                      <>
                        <AISuggestionRow>
                          {autofillSuggestion ? (
                            <AISuggestionCard
                              suggestion={autofillSuggestion}
                              onPrimaryAction={() => applyAutofill(autofillSuggestion)}
                              primaryActionLabel={
                                autofillSuggestion.status === "APPLIED"
                                  ? "Applied"
                                  : isApplying
                                    ? "Applying..."
                                    : "Apply"
                              }
                              onReject={() => handleDecision(autofillSuggestion.id, "REJECT")}
                              onSnooze={(days) => handleDecision(autofillSuggestion.id, "SNOOZE", days)}
                              onPreview={() => setPreviewSuggestion(autofillSuggestion)}
                              decisionLoadingId={decisionLoadingId}
                              disableActions={isApplying || autofillSuggestion.status === "APPLIED"}
                              caption={
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-inner dark:bg-emerald-900/50 dark:text-emerald-100">
                                  {autofillSuggestion.status ?? "PROPOSED"}
                                </span>
                              }
                            />
                          ) : (
                            <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-shrink-0 flex-col justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 shadow-inner dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-900 dark:text-slate-50">Generate a user story draft</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  Kickstart a user story with an AI-generated draft.
                                </p>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={triggerAutofill}
                                  disabled={isGeneratingAutofill}
                                  className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                                >
                                  {isGeneratingAutofill ? "Generating..." : "Generate"}
                                </button>
                              </div>
                            </div>
                          )}

                          {otherSuggestions.map((suggestion) => (
                            <AISuggestionCard
                              key={suggestion.id}
                              suggestion={suggestion}
                              onAccept={() => handleDecision(suggestion.id, "ACCEPT")}
                              onReject={() => handleDecision(suggestion.id, "REJECT")}
                              onSnooze={(days) => handleDecision(suggestion.id, "SNOOZE", days)}
                              decisionLoadingId={decisionLoadingId}
                              onPreview={
                                suggestion.suggestionType === "IMPROVE_TEXT"
                                  ? () => setPreviewSuggestion(suggestion)
                                  : undefined
                              }
                              onPrimaryAction={
                                suggestion.suggestionType === "IMPROVE_TEXT"
                                  ? () => openApplyModal(suggestion)
                                  : undefined
                              }
                              primaryActionLabel={
                                suggestion.suggestionType === "IMPROVE_TEXT" ? "Apply edits" : undefined
                              }
                            />
                          ))}
                        </AISuggestionRow>

                        {autofillActionError && (
                          <p className="text-sm text-red-500">{autofillActionError}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Activity</h2>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Conversation & audit trail</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActivityOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100"
                      aria-expanded={isActivityOpen}
                    >
                      {isActivityOpen ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {isActivityOpen ? (
                    <>
                      <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => setActivityTab("comments")}
                          className={activityTabButton("comments")}
                        >
                          Comments
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivityTab("audit")}
                          className={activityTabButton("audit")}
                        >
                          Audit
                        </button>
                      </div>
                      {activityTab === "comments" ? (
                        <>
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
                              {comment.attachments?.length ? (
                                <ul className="mt-2 space-y-1 text-xs">
                                  {comment.attachments.map((attachment) => (
                                    <li
                                      key={attachment.id}
                                      className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-slate-700 dark:border-slate-700 dark:text-slate-100"
                                    >
                                      <a
                                        className="truncate font-medium text-primary hover:underline"
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {attachment.fileName}
                                      </a>
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={attachment.url}
                                          download={attachment.fileName}
                                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                                        >
                                          Download
                                        </a>
                                        <button
                                          type="button"
                                          className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                                          onClick={() => handleAttachmentDelete(attachment.id)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
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

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment attachments</p>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100">
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleCommentAttachmentChange}
                                disabled={isUploadingCommentFiles}
                              />
                              {isUploadingCommentFiles ? "Uploading..." : "Add files"}
                            </label>
                          </div>
                          {commentAttachments.length > 0 && (
                            <ul className="space-y-1 text-xs">
                              {commentAttachments.map((attachment) => (
                                <li
                                  key={attachment.id}
                                  className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-slate-700 dark:border-slate-800 dark:text-slate-100"
                                >
                                  <span className="truncate font-medium">{attachment.fileName}</span>
                                  <button
                                    type="button"
                                    className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                                    onClick={() => handleAttachmentDelete(attachment.id)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingComment || !commentBody.trim()}
                          className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                        >
                          {isSubmittingComment ? "Posting..." : "Post comment"}
                        </button>
                      </form>
                    </>
                      ) : (
                        <div className="mt-4">
                          <AuditLogList
                            fetchUrl={`/api/issues/${issueId}/audit-logs`}
                            emptyMessage="No audit entries yet for this issue."
                          />
                        </div>
                      )}
                    </>
                  ) : null}
                </section>
              </div>

              </div>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status & Workflow
                  </p>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="type">
                          Type
                        </label>
                        <span
                          className={`${pillBaseClasses} border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
                        >
                          <IssueTypeIcon type={type} showLabel />
                        </span>
                      </div>
                      <select
                        id="type"
                        name="type"
                        value={type}
                        onChange={(event) => setType(event.target.value as IssueType)}
                        disabled={disableEditing}
                        className={baseFieldClasses}
                      >
                        {(Object.keys(ISSUE_TYPE_METADATA) as IssueType[]).map((option) => {
                          const { icon, label } = ISSUE_TYPE_METADATA[option];
                          return (
                            <option key={option} value={option}>
                              {icon} {label}
                            </option>
                          );
                        })}
                      </select>
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
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Reporter</p>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        {reporterName}
                      </div>
                    </div>

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
                      <label
                        className="text-sm font-medium text-slate-700 dark:text-slate-200"
                        htmlFor="secondaryAssignee"
                      >
                        Secondary assignee
                      </label>
                      <select
                        id="secondaryAssignee"
                        name="secondaryAssignee"
                        value={secondaryAssigneeId}
                        onChange={(event) => setSecondaryAssigneeId(event.target.value)}
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Builds</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Link this issue to project builds.</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {sortedLinkedBuilds.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No builds linked.</p>
                    ) : (
                      <ul className="space-y-2">
                        {sortedLinkedBuilds.map((build) => (
                          <li
                            key={build.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800"
                          >
                            <div className="space-y-1">
                              <Link
                                href={routes.project.build(build.projectId, build.id)}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {build.key}
                              </Link>
                              {build.name ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">{build.name}</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant={buildBadgeVariants[build.status] ?? "neutral"}>
                                  {buildStatusLabels[build.status] ?? build.status}
                                </Badge>
                                <Badge variant="outline">
                                  {buildEnvironmentLabels[build.environment] ?? build.environment}
                                </Badge>
                              </div>
                            </div>

                            {canEditBuildLinks ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveBuild(build.id)}
                                disabled={removingBuildId === build.id}
                                className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-60"
                              >
                                {removingBuildId === build.id ? "Removing..." : "Remove"}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    {buildActionMessage ? (
                      <p className="text-sm text-red-500">{buildActionMessage}</p>
                    ) : null}

                    {canEditBuildLinks ? (
                      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="build-search">
                          Link a build
                        </label>
                        <input
                          id="build-search"
                          type="text"
                          value={buildSearch}
                          onChange={(event) => setBuildSearch(event.target.value)}
                          placeholder="Search builds by key or name"
                          className={baseFieldClasses}
                        />

                        <div className="space-y-2 text-sm">
                          {isSearchingBuilds ? (
                            <p className="text-slate-600 dark:text-slate-300">Searching builds...</p>
                          ) : buildSearch.trim() && buildResults.length === 0 ? (
                            <p className="text-slate-600 dark:text-slate-300">No builds found for this search.</p>
                          ) : buildResults.length > 0 ? (
                            <ul className="space-y-2">
                              {buildResults.map((build) => (
                                <li
                                  key={build.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{build.key}</p>
                                    {build.name ? (
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{build.name}</p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <Badge variant={buildBadgeVariants[build.status] ?? "neutral"}>
                                        {buildStatusLabels[build.status] ?? build.status}
                                      </Badge>
                                      <Badge variant="outline">
                                        {buildEnvironmentLabels[build.environment] ?? build.environment}
                                      </Badge>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleLinkBuild(build.id)}
                                    disabled={linkingBuildId === build.id}
                                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                                  >
                                    {linkingBuildId === build.id ? "Linking..." : "Link"}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-600 dark:text-slate-300">Start typing to search project builds.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
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
                        step="0.1"
                        value={storyPoints}
                        onChange={(event) => setStoryPoints(event.target.value)}
                        disabled={disableEditing}
                        className={baseFieldClasses}
                      />
                    </div>
                  </div>
                </div>
              </aside>
            </div>
            </Fragment>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-200">Issue not found.</p>
          )}
        </section>
      </div>
    </main>

      {previewSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {previewSuggestion.suggestionType}
                  </span>
                  {typeof previewSuggestion.confidence === "number" && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-inner dark:bg-emerald-900/50 dark:text-emerald-100">
                      {Math.round(previewSuggestion.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{previewSuggestion.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSuggestion(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {renderPreviewContent(previewSuggestion)}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 text-xs font-semibold">
              {previewSuggestion.suggestionType === "IMPROVE_TEXT" && (
                <button
                  type="button"
                  onClick={() => {
                    openApplyModal(previewSuggestion);
                    setPreviewSuggestion(null);
                  }}
                  className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-white shadow-sm transition hover:bg-primary/90"
                >
                  Apply edits
                </button>
              )}

              {previewSuggestion.suggestionType === "AUTOFILL_USER_STORY" && (
                <button
                  type="button"
                  onClick={() => applyAutofill(previewSuggestion)}
                  disabled={isApplying || previewSuggestion.status === "APPLIED"}
                  className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {previewSuggestion.status === "APPLIED"
                    ? "Applied"
                    : isApplying
                      ? "Applying..."
                      : "Apply to description"}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDecision(previewSuggestion.id, "REJECT")}
                disabled={decisionLoadingId === previewSuggestion.id}
                className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleDecision(previewSuggestion.id, "ACCEPT")}
                disabled={decisionLoadingId === previewSuggestion.id}
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {decisionLoadingId === previewSuggestion.id ? "Saving..." : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {applyModalSuggestion && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Apply AI edits
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {applyModalSuggestion.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalSuggestion(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={applySelection.title}
                  onChange={(event) =>
                    setApplySelection((prev) => ({ ...prev, title: event.target.checked }))
                  }
                  disabled={!applyModalSuggestion.payload?.recommendedTitle}
                />
                <div>
                  <p className="font-semibold">Title</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {applyModalSuggestion.payload?.recommendedTitle ?? "No AI title provided."}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={applySelection.description}
                  onChange={(event) =>
                    setApplySelection((prev) => ({ ...prev, description: event.target.checked }))
                  }
                  disabled={!applyModalSuggestion.payload?.recommendedDescription}
                />
                <div className="space-y-1">
                  <p className="font-semibold">Description</p>
                  {applyModalSuggestion.payload?.recommendedDescription ? (
                    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {applyModalSuggestion.payload.recommendedDescription}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No AI description provided.</p>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={applySelection.criteria}
                  onChange={(event) =>
                    setApplySelection((prev) => ({ ...prev, criteria: event.target.checked }))
                  }
                  disabled={
                    !(applyModalSuggestion.payload?.recommendedAcceptanceCriteria?.length)
                  }
                />
                <div className="space-y-1">
                  <p className="font-semibold">Acceptance Criteria</p>
                  {applyModalSuggestion.payload?.recommendedAcceptanceCriteria?.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-200">
                      {applyModalSuggestion.payload.recommendedAcceptanceCriteria.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No AI criteria provided.</p>
                  )}
                </div>
              </label>

              {applyError && <p className="text-sm text-red-500">{applyError}</p>}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyModalSuggestion(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyEdits}
                disabled={isApplying || !hasApplySelection}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isApplying ? "Applying..." : "Apply selected edits"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
