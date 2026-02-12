"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import AIStandupAssistant from "@/components/standup/AIStandupAssistant";
import { Button } from "@/components/ui/Button";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { ProjectRole } from "@/lib/roles";
import { getPreviousStandupDate } from "@/lib/standupWindow";

type StandupIssue = {
  id: string;
  key?: string | null;
  title: string;
  assignee?: { id: string; name: string | null } | null;
  status?: string | null;
};

type StandupResearch = {
  id: string;
  key?: string | null;
  title: string;
  assignee?: { id: string; name: string | null } | null;
  status?: string | null;
};

type StandupEntry = {
  id: string;
  date: string;
  summaryToday: string | null;
  progressSinceYesterday: string | null;
  blockers: string | null;
  dependencies: string | null;
  notes: string | null;
  isComplete: boolean;
  issues: { issue: StandupIssue }[];
  research: { researchItem: StandupResearch }[];
};

type StandupEntryWithUser = StandupEntry & {
  user: { id: string; name: string; email: string | null };
};

type StandupSummaryResponse = {
  date: string;
  summary: string;
  entries: StandupEntryWithUser[];
};

type ProjectMemberSummary = {
  id: string;
  role: ProjectRole;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl?: string | null;
  };
};

type StandupUserViewResponse = {
  user: { id: string; name: string; avatarUrl?: string | null };
  today: StandupEntry[];
  yesterday: StandupEntry[];
  yesterdayDate: string;
};

type StandupFormState = {
  summaryToday: string;
  progressSinceYesterday: string;
  blockers: string;
  dependencies: string;
  notes: string;
};

type FacilitatorNote = {
  id: string;
  projectId: string;
  teammateId: string;
  authorId: string;
  date: string;
  text: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
};

type ToastMessage = {
  id: string;
  type: "success" | "error" | "warning";
  message: string;
};

type StandupEntryStatus = "missing" | "partial" | "updated";

const toDateInput = (date: Date) => date.toISOString().split("T")[0];

const formatDisplayDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatTimeOnly = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const getInitials = (value?: string | null) =>
  value
    ?.split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "";

const getMissingStandupSections = (entry?: StandupEntry | StandupEntryWithUser | null) => {
  if (!entry) {
    return {
      progress: true,
      today: true,
      blockers: false,
      dependencies: false,
      linkedWork: true,
    };
  }

  return {
    progress: !entry.progressSinceYesterday?.trim(),
    today: !entry.summaryToday?.trim(),
    blockers: false,
    dependencies: false,
    linkedWork: entry.issues.length + entry.research.length === 0,
  };
};

const getStandupEntryStatus = (
  entry?: StandupEntry | StandupEntryWithUser | null
): StandupEntryStatus => {
  if (!entry) return "missing";
  const missingSections = getMissingStandupSections(entry);
  const hasMissing =
    missingSections.progress ||
    missingSections.today ||
    missingSections.linkedWork;
  return hasMissing ? "partial" : "updated";
};

const getMyStandupEntryForDate = async (
  projectId: string,
  date: string,
  userId?: string | null
) => {
  const params = new URLSearchParams();
  params.set("date", date);
  if (userId) params.set("userId", userId);

  const response = await fetch(
    `/api/projects/${projectId}/standup/my?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup entry");
  }

  return (await response.json()) as StandupEntry | null;
};

const upsertMyStandupEntry = async (
  projectId: string,
  payload: {
    date: string;
    userId?: string;
    summaryToday: string | null;
    progressSinceYesterday: string | null;
    blockers: string | null;
    dependencies: string | null;
    notes: string | null;
    issueIds: string[];
    researchIds: string[];
  }
) => {
  const response = await fetch(`/api/projects/${projectId}/standup/my`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to save standup entry");
  }

  return (await response.json()) as StandupEntry;
};

const searchIssuesInProject = async (projectId: string, query: string) => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);

  const response = await fetch(
    `/api/projects/${projectId}/standup/search-issues?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to search issues");
  }

  return (await response.json()) as StandupIssue[];
};

const searchResearchInProject = async (projectId: string, query: string) => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);

  const response = await fetch(
    `/api/projects/${projectId}/standup/search-research?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to search research items");
  }

  return (await response.json()) as StandupResearch[];
};

const getProjectMembers = async (projectId: string) => {
  const response = await fetch(`/api/projects/${projectId}/members`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load project members");
  }

  return (await response.json()) as ProjectMemberSummary[];
};

const getFacilitatorNotes = async (
  projectId: string,
  options: { teammateId: string; date: string; authorId?: string }
) => {
  const params = new URLSearchParams();
  params.set("teammateId", options.teammateId);
  params.set("date", options.date);
  if (options.authorId) params.set("authorId", options.authorId);

  const response = await fetch(
    `/api/projects/${projectId}/standup/facilitator-notes?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load facilitator notes");
  }

  return (await response.json()) as FacilitatorNote[];
};

const createFacilitatorNote = async (
  projectId: string,
  payload: { teammateId: string; date: string; text: string }
) => {
  const response = await fetch(
    `/api/projects/${projectId}/standup/facilitator-notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to save facilitator note");
  }

  return (await response.json()) as FacilitatorNote;
};

const updateFacilitatorNote = async (
  projectId: string,
  noteId: string,
  payload: { text?: string; resolved?: boolean }
) => {
  const response = await fetch(
    `/api/projects/${projectId}/standup/facilitator-notes/${noteId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to update facilitator note");
  }

  return (await response.json()) as FacilitatorNote;
};

const deleteFacilitatorNote = async (projectId: string, noteId: string) => {
  const response = await fetch(
    `/api/projects/${projectId}/standup/facilitator-notes/${noteId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to delete facilitator note");
  }

  return (await response.json()) as { ok: boolean };
};

const getStandupUserView = async (
  projectId: string,
  userId: string,
  date: string
) => {
  const params = new URLSearchParams();
  params.set("userId", userId);
  params.set("date", date);

  const response = await fetch(
    `/api/projects/${projectId}/standup/user-view?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup view");
  }

  return (await response.json()) as StandupUserViewResponse;
};

const getStandupSummaryForProjectAndDate = async (
  projectId: string,
  options: { date: string; forceRefresh?: boolean }
) => {
  const params = new URLSearchParams();
  params.set("date", options.date);
  if (options.forceRefresh) params.set("forceRefresh", "true");

  const response = await fetch(
    `/api/projects/${projectId}/standup/summary?${params.toString()}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup summary");
  }

  return (await response.json()) as StandupSummaryResponse;
};

const getStandupSequence = async (projectId: string) => {
  const response = await fetch(`/api/projects/${projectId}/standup/sequence`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to load standup sequence");
  }

  return (await response.json()) as { sequenceUserIds: string[] };
};

const saveStandupSequence = async (projectId: string, sequenceUserIds: string[]) => {
  const response = await fetch(`/api/projects/${projectId}/standup/sequence`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequenceUserIds }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to save standup sequence");
  }

  return (await response.json()) as { sequenceUserIds: string[] };
};

type StandupPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  projectName: string;
};

export default function StandupPageClient({
  projectId,
  projectRole,
  currentUserId,
  currentUserName,
  currentUserEmail,
  projectName,
}: StandupPageClientProps) {
  const [activeTab, setActiveTab] = useState<
    "my-update" | "team-dashboard" | "standup-view"
  >("my-update");
  const [mySelectedDate, setMySelectedDate] = useState(() =>
    toDateInput(new Date())
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [standupMode, setStandupMode] = useState<"manual" | "ai">("manual");

  const [members, setMembers] = useState<ProjectMemberSummary[]>([]);
  const [membersError, setMembersError] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [standupViewData, setStandupViewData] =
    useState<StandupUserViewResponse | null>(null);
  const [isLoadingStandupView, setIsLoadingStandupView] = useState(false);
  const [standupViewError, setStandupViewError] = useState("");
  const [facilitatorNotes, setFacilitatorNotes] = useState<FacilitatorNote[]>([]);
  const [isLoadingFacilitatorNotes, setIsLoadingFacilitatorNotes] = useState(false);
  const [facilitatorNotesError, setFacilitatorNotesError] = useState("");
  const [newFacilitatorNote, setNewFacilitatorNote] = useState("");
  const [isSavingFacilitatorNote, setIsSavingFacilitatorNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [queueSortMode, setQueueSortMode] = useState<
    "suggested" | "alphabetical" | "custom"
  >("suggested");
  const [savedSequenceUserIds, setSavedSequenceUserIds] = useState<string[]>([]);
  const [customSequenceUserIds, setCustomSequenceUserIds] = useState<string[]>([]);
  const [draggedSequenceUserId, setDraggedSequenceUserId] = useState<string | null>(null);
  const [dragOverSequenceUserId, setDragOverSequenceUserId] = useState<string | null>(null);
  const [isSavingSequence, setIsSavingSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState("");
  const [queueIndex, setQueueIndex] = useState(0);
  const [standupQueueEntries, setStandupQueueEntries] = useState<
    StandupEntryWithUser[]
  >([]);
  const [isLoadingQueueEntries, setIsLoadingQueueEntries] = useState(false);
  const [queueEntriesError, setQueueEntriesError] = useState("");

  const [formState, setFormState] = useState<StandupFormState>({
    summaryToday: "",
    progressSinceYesterday: "",
    blockers: "",
    dependencies: "",
    notes: "",
  });
  const [selectedIssues, setSelectedIssues] = useState<StandupIssue[]>([]);
  const [issueQuery, setIssueQuery] = useState("");
  const [issueOptions, setIssueOptions] = useState<StandupIssue[]>([]);
  const [issueSearchError, setIssueSearchError] = useState("");
  const issueSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [selectedResearch, setSelectedResearch] = useState<StandupResearch[]>([]);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchOptions, setResearchOptions] = useState<StandupResearch[]>([]);
  const [researchSearchError, setResearchSearchError] = useState("");
  const researchSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isLoadingEntry, setIsLoadingEntry] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [currentEntry, setCurrentEntry] = useState<StandupEntry | null>(null);

  const [summaryDate, setSummaryDate] = useState(() => toDateInput(new Date()));
  const [summary, setSummary] = useState<StandupSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const canProxyStandup = projectRole === "ADMIN";
  const canViewDashboard = projectRole === "ADMIN" || projectRole === "PO";
  const canViewStandupView = canViewDashboard;
  const [actingUserId, setActingUserId] = useState(currentUserId);

  const fallbackYesterdayDate = useMemo(
    () => getPreviousStandupDate(selectedDate, false),
    [selectedDate]
  );
  const yesterdayDate = useMemo(() => {
    if (standupViewData?.yesterdayDate) {
      return new Date(standupViewData.yesterdayDate);
    }
    return fallbackYesterdayDate;
  }, [fallbackYesterdayDate, standupViewData?.yesterdayDate]);

  const standupDateInput = useMemo(
    () => toDateInput(selectedDate),
    [selectedDate]
  );
  const yesterdayDateInput = useMemo(
    () => toDateInput(yesterdayDate),
    [yesterdayDate]
  );
  const formattedStandupDate = useMemo(
    () => formatDisplayDate(standupDateInput),
    [standupDateInput]
  );
  const formattedYesterdayDate = useMemo(
    () => formatDisplayDate(yesterdayDateInput),
    [yesterdayDateInput]
  );
  const queueStatusByUserId = useMemo(() => {
    const statusMap = new Map<string, StandupEntryStatus>();
    standupQueueEntries.forEach((entry) => {
      statusMap.set(entry.user.id, getStandupEntryStatus(entry));
    });
    return statusMap;
  }, [standupQueueEntries]);
  const orderedQueue = useMemo(() => {
    const roleOrder: ProjectRole[] = ["ADMIN", "PO", "DEV", "QA", "VIEWER"];
    const statusPriority: Record<StandupEntryStatus, number> = {
      missing: 0,
      partial: 1,
      updated: 2,
    };
    const entries = members.map((member, index) => {
      const displayName =
        member.user.name ?? member.user.email ?? "Unnamed member";
      const roleIndex = roleOrder.indexOf(member.role);
      const status = queueStatusByUserId.get(member.user.id) ?? "missing";
      return {
        member,
        index,
        displayName,
        normalizedName: displayName.toLocaleLowerCase(),
        roleIndex: roleIndex === -1 ? roleOrder.length : roleIndex,
        statusPriority: statusPriority[status],
      };
    });

    const customIndexByUserId = new Map(
      customSequenceUserIds.map((userId, index) => [userId, index])
    );

    entries.sort((a, b) => {
      if (queueSortMode === "custom") {
        const aIndex = customIndexByUserId.get(a.member.user.id);
        const bIndex = customIndexByUserId.get(b.member.user.id);
        const aOrder = aIndex ?? Number.MAX_SAFE_INTEGER;
        const bOrder = bIndex ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }

      if (queueSortMode === "alphabetical") {
        const nameComparison = a.normalizedName.localeCompare(b.normalizedName);
        if (nameComparison !== 0) return nameComparison;
        return a.index - b.index;
      }

      const roleComparison = a.roleIndex - b.roleIndex;
      if (roleComparison !== 0) return roleComparison;
      const statusComparison = a.statusPriority - b.statusPriority;
      if (statusComparison !== 0) return statusComparison;
      const nameComparison = a.normalizedName.localeCompare(b.normalizedName);
      if (nameComparison !== 0) return nameComparison;
      return a.index - b.index;
    });

    return entries.map((entry) => entry.member);
  }, [customSequenceUserIds, members, queueSortMode, queueStatusByUserId]);
  const isSequenceDirty = useMemo(() => {
    if (customSequenceUserIds.length !== savedSequenceUserIds.length) return true;
    return customSequenceUserIds.some(
      (userId, index) => userId !== savedSequenceUserIds[index]
    );
  }, [customSequenceUserIds, savedSequenceUserIds]);
  const selectedMember = useMemo(
    () => orderedQueue.find((member) => member.user.id === selectedUserId),
    [orderedQueue, selectedUserId]
  );
  const actingMember = useMemo(
    () => members.find((member) => member.user.id === actingUserId),
    [actingUserId, members]
  );
  const actingUserName =
    actingMember?.user.name ?? actingMember?.user.email ?? currentUserName;
  const actingUserEmail =
    actingMember?.user.email ?? (actingMember ? "No email" : currentUserEmail);
  const yesterdayEntries = standupViewData?.yesterday ?? [];
  const todayEntries = standupViewData?.today ?? [];
  const todayEntry = todayEntries[0] ?? null;
  const todayMissingSections = useMemo(
    () => getMissingStandupSections(todayEntry),
    [todayEntry]
  );
  const todayStatus = useMemo(
    () => getStandupEntryStatus(todayEntry),
    [todayEntry]
  );
  const upcomingQueue = useMemo(() => {
    if (!orderedQueue.length) return [];
    const startIndex = Math.min(queueIndex + 1, orderedQueue.length);
    return orderedQueue.slice(startIndex, startIndex + 2);
  }, [orderedQueue, queueIndex]);
  const standupViewTopRef = useRef<HTMLDivElement | null>(null);
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const facilitatorNoteInputRef = useRef<HTMLTextAreaElement | null>(null);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    if (!canViewStandupView && activeTab !== "my-update") {
      setActiveTab("my-update");
    }
  }, [activeTab, canViewStandupView]);

  useEffect(() => {
    if (!projectId || !mySelectedDate) return;
    const targetUserId = canProxyStandup ? actingUserId : currentUserId;

    const loadEntry = async () => {
      setIsLoadingEntry(true);
      setEntryError("");

      try {
        const entry = await getMyStandupEntryForDate(
          projectId,
          mySelectedDate,
          targetUserId
        );
        setCurrentEntry(entry);
        setFormState({
          summaryToday: entry?.summaryToday ?? "",
          progressSinceYesterday: entry?.progressSinceYesterday ?? "",
          blockers: entry?.blockers ?? "",
          dependencies: entry?.dependencies ?? "",
          notes: entry?.notes ?? "",
        });
        setSelectedIssues(entry?.issues.map((link) => link.issue) ?? []);
        setSelectedResearch(entry?.research.map((link) => link.researchItem) ?? []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load standup";
        setEntryError(message);
      } finally {
        setIsLoadingEntry(false);
      }
    };

    loadEntry();
  }, [actingUserId, canProxyStandup, currentUserId, mySelectedDate, projectId]);

  useEffect(() => {
    if (!projectId || !canViewStandupView) return;

    const loadMembers = async () => {
      setIsLoadingMembers(true);
      setMembersError("");

      try {
        const memberList = await getProjectMembers(projectId);
        setMembers(memberList);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load project members";
        setMembersError(message);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembers();
  }, [canViewStandupView, projectId]);

  useEffect(() => {
    if (!projectId || !canViewStandupView) return;

    let isCancelled = false;

    getStandupSequence(projectId)
      .then((data) => {
        if (isCancelled) return;
        setSavedSequenceUserIds(data.sequenceUserIds);
      })
      .catch((error) => {
        if (isCancelled) return;
        setSequenceError(
          error instanceof Error ? error.message : "Unable to load standup sequence"
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [canViewStandupView, projectId]);

  useEffect(() => {
    if (!members.length) {
      setCustomSequenceUserIds([]);
      return;
    }

    const memberIds = new Set(members.map((member) => member.user.id));
    const normalizedSaved = savedSequenceUserIds.filter((userId) => memberIds.has(userId));
    const missingIds = members
      .map((member) => member.user.id)
      .filter((userId) => !normalizedSaved.includes(userId));

    setCustomSequenceUserIds([...normalizedSaved, ...missingIds]);
  }, [members, savedSequenceUserIds]);

  useEffect(() => {
    if (!canProxyStandup) {
      if (actingUserId !== currentUserId) {
        setActingUserId(currentUserId);
      }
      return;
    }

    if (!members.length) return;

    const hasActingMember = members.some(
      (member) => member.user.id === actingUserId
    );

    if (hasActingMember) return;

    const fallbackMember =
      members.find((member) => member.user.id === currentUserId) ??
      members[0] ??
      null;
    if (fallbackMember) {
      setActingUserId(fallbackMember.user.id);
    }
  }, [actingUserId, canProxyStandup, currentUserId, members]);

  useEffect(() => {
    if (!canViewStandupView || !orderedQueue.length) return;

    const hasSelectedMember = orderedQueue.some(
      (member) => member.user.id === selectedUserId
    );

    if (hasSelectedMember) return;

    const currentMember = orderedQueue.find(
      (member) => member.user.id === currentUserId
    );
    setSelectedUserId(
      currentMember?.user.id ?? orderedQueue[0]?.user.id ?? null
    );
  }, [canViewStandupView, currentUserId, orderedQueue, selectedUserId]);

  useEffect(() => {
    if (!orderedQueue.length) {
      setQueueIndex(0);
      return;
    }

    const nextIndex = orderedQueue.findIndex(
      (member) => member.user.id === selectedUserId
    );

    if (nextIndex === -1) {
      setSelectedUserId(orderedQueue[0].user.id);
      setQueueIndex(0);
      return;
    }

    if (nextIndex !== queueIndex) {
      setQueueIndex(nextIndex);
    }
  }, [orderedQueue, queueIndex, selectedUserId]);

  useEffect(() => {
    if (!projectId || !canViewStandupView || activeTab !== "standup-view") {
      return;
    }

    let isCancelled = false;
    setIsLoadingQueueEntries(true);
    setQueueEntriesError("");

    getStandupSummaryForProjectAndDate(projectId, { date: standupDateInput })
      .then((data) => {
        if (isCancelled) return;
        setStandupQueueEntries(data.entries);
      })
      .catch((error) => {
        if (isCancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load standup queue status";
        setQueueEntriesError(message);
        setStandupQueueEntries([]);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingQueueEntries(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, canViewStandupView, projectId, standupDateInput]);

  useEffect(() => {
    if (
      !projectId ||
      activeTab !== "standup-view" ||
      !canViewStandupView ||
      !selectedUserId
    ) {
      return;
    }

    const dateValue = standupDateInput;
    let isCancelled = false;
    setIsLoadingStandupView(true);
    setStandupViewError("");
    setStandupViewData(null);

    getStandupUserView(projectId, selectedUserId, dateValue)
      .then((data) => {
        if (!isCancelled) {
          setStandupViewData(data);
        }
      })
      .catch((error) => {
        if (isCancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load standup view";
        setStandupViewError(message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingStandupView(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, canViewStandupView, projectId, selectedUserId, standupDateInput]);

  useEffect(() => {
    if (
      !projectId ||
      activeTab !== "standup-view" ||
      !canViewStandupView ||
      !selectedUserId
    ) {
      setFacilitatorNotes([]);
      return;
    }

    let isCancelled = false;
    setIsLoadingFacilitatorNotes(true);
    setFacilitatorNotesError("");
    setEditingNoteId(null);
    setEditingNoteText("");

    getFacilitatorNotes(projectId, {
      teammateId: selectedUserId,
      date: standupDateInput,
      authorId: currentUserId,
    })
      .then((data) => {
        if (!isCancelled) {
          setFacilitatorNotes(data);
        }
      })
      .catch((error) => {
        if (isCancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load facilitator notes";
        setFacilitatorNotesError(message);
        setFacilitatorNotes([]);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingFacilitatorNotes(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    canViewStandupView,
    currentUserId,
    projectId,
    selectedUserId,
    standupDateInput,
  ]);

  useEffect(() => {
    if (!projectId) return;

    if (issueSearchTimeout.current) {
      clearTimeout(issueSearchTimeout.current);
    }

    issueSearchTimeout.current = setTimeout(async () => {
      if (!issueQuery.trim()) {
        setIssueOptions([]);
        return;
      }

      try {
        const results = await searchIssuesInProject(projectId, issueQuery.trim());
        setIssueOptions(results);
        setIssueSearchError("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to search issues";
        setIssueSearchError(message);
      }
    }, 250);

    return () => {
      if (issueSearchTimeout.current) clearTimeout(issueSearchTimeout.current);
    };
  }, [issueQuery, projectId]);

  useEffect(() => {
    if (!projectId) return;

    if (researchSearchTimeout.current) {
      clearTimeout(researchSearchTimeout.current);
    }

    researchSearchTimeout.current = setTimeout(async () => {
      if (!researchQuery.trim()) {
        setResearchOptions([]);
        return;
      }

      try {
        const results = await searchResearchInProject(projectId, researchQuery.trim());
        setResearchOptions(results);
        setResearchSearchError("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to search research items";
        setResearchSearchError(message);
      }
    }, 250);

    return () => {
      if (researchSearchTimeout.current) clearTimeout(researchSearchTimeout.current);
    };
  }, [projectId, researchQuery]);

  const handleIssueAdd = (issue: StandupIssue) => {
    setSelectedIssues((prev) => {
      if (prev.find((item) => item.id === issue.id)) return prev;
      return [...prev, issue];
    });
    setIssueQuery("");
    setIssueOptions([]);
  };

  const handleIssueRemove = (issueId: string) => {
    setSelectedIssues((prev) => prev.filter((item) => item.id !== issueId));
  };

  const handleResearchAdd = (researchItem: StandupResearch) => {
    setSelectedResearch((prev) => {
      if (prev.find((item) => item.id === researchItem.id)) return prev;
      return [...prev, researchItem];
    });
    setResearchQuery("");
    setResearchOptions([]);
  };

  const handleResearchRemove = (researchItemId: string) => {
    setSelectedResearch((prev) => prev.filter((item) => item.id !== researchItemId));
  };

  const handleCreateFacilitatorNote = async () => {
    if (!projectId || !selectedUserId) return;
    const trimmed = newFacilitatorNote.trim();
    if (!trimmed) {
      addToast({ type: "warning", message: "Add a note before saving." });
      facilitatorNoteInputRef.current?.focus();
      return;
    }

    setIsSavingFacilitatorNote(true);

    try {
      const note = await createFacilitatorNote(projectId, {
        teammateId: selectedUserId,
        date: standupDateInput,
        text: trimmed,
      });
      setFacilitatorNotes((prev) => [note, ...prev]);
      setNewFacilitatorNote("");
      addToast({ type: "success", message: "Facilitator note saved." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save facilitator note";
      addToast({ type: "error", message });
    } finally {
      setIsSavingFacilitatorNote(false);
    }
  };

  const handleEditFacilitatorNote = (note: FacilitatorNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const handleSaveEdit = async () => {
    if (!projectId || !editingNoteId) return;
    const trimmed = editingNoteText.trim();
    if (!trimmed) {
      addToast({ type: "warning", message: "Note text cannot be empty." });
      return;
    }

    try {
      const updated = await updateFacilitatorNote(projectId, editingNoteId, {
        text: trimmed,
      });
      setFacilitatorNotes((prev) =>
        prev.map((note) => (note.id === updated.id ? updated : note))
      );
      addToast({ type: "success", message: "Facilitator note updated." });
      handleCancelEdit();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update facilitator note";
      addToast({ type: "error", message });
    }
  };

  const handleToggleResolved = async (note: FacilitatorNote) => {
    if (!projectId) return;
    try {
      const updated = await updateFacilitatorNote(projectId, note.id, {
        resolved: !note.resolved,
      });
      setFacilitatorNotes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      addToast({
        type: "success",
        message: updated.resolved ? "Note resolved." : "Note reopened.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update facilitator note";
      addToast({ type: "error", message });
    }
  };

  const handleDeleteFacilitatorNote = async (noteId: string) => {
    if (!projectId) return;
    try {
      await deleteFacilitatorNote(projectId, noteId);
      setFacilitatorNotes((prev) => prev.filter((note) => note.id !== noteId));
      addToast({ type: "success", message: "Facilitator note removed." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete facilitator note";
      addToast({ type: "error", message });
    }
  };

  const handleDraftReady = useCallback(
    (draft: { yesterday: string; today: string; blockers: string }) => {
      setFormState((prev) => ({
        ...prev,
        progressSinceYesterday: draft.yesterday ?? "",
        summaryToday: draft.today ?? "",
        blockers: draft.blockers ?? "",
      }));
      setStandupMode("manual");
      addToast({ type: "success", message: "AI draft added to your standup." });
    },
    [addToast]
  );

  const computedCompletion = useMemo(() => {
    const hasLinkedWork = selectedIssues.length + selectedResearch.length > 0;
    return Boolean(formState.summaryToday.trim()) && hasLinkedWork;
  }, [formState.summaryToday, selectedIssues.length, selectedResearch.length]);

  const handleSaveEntry = async () => {
    if (!projectId || !mySelectedDate) return;

    if (!computedCompletion) {
      const proceed = window.confirm(
        "Your entry is marked incomplete (need today's plan and at least one linked issue or research item). Save anyway?"
      );
      if (!proceed) return;
    }

    setIsSavingEntry(true);
    setEntryError("");

    try {
      const targetUserId = canProxyStandup ? actingUserId : currentUserId;
      const payload = {
        date: mySelectedDate,
        userId: targetUserId !== currentUserId ? targetUserId : undefined,
        summaryToday: formState.summaryToday.trim() || null,
        progressSinceYesterday: formState.progressSinceYesterday.trim() || null,
        blockers: formState.blockers.trim() || null,
        dependencies: formState.dependencies.trim() || null,
        notes: formState.notes.trim() || null,
        issueIds: selectedIssues.map((issue) => issue.id),
        researchIds: selectedResearch.map((item) => item.id),
      };

      const saved = await upsertMyStandupEntry(projectId, payload);
      setCurrentEntry(saved);
      setSelectedIssues(saved.issues.map((link) => link.issue));
      setSelectedResearch(saved.research.map((link) => link.researchItem));
      addToast({ type: "success", message: "Standup entry saved." });

      if (!saved.isComplete) {
        addToast({
          type: "warning",
          message:
            "Entry saved but still incomplete. Add today's plan and link at least one issue or research item to complete it.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save standup entry";
      setEntryError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const loadSummary = useCallback(
    async (forceRefresh = false) => {
      if (!projectId || !canViewDashboard || !summaryDate) return;

      setIsLoadingSummary(true);
      setSummaryError("");

      try {
        const summaryResult = await getStandupSummaryForProjectAndDate(projectId, {
          date: summaryDate,
          forceRefresh,
        });
        setSummary(summaryResult);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load AI standup summary";
        setSummaryError(message);
      } finally {
        setIsLoadingSummary(false);
      }
    },
    [canViewDashboard, projectId, summaryDate]
  );

  useEffect(() => {
    if (activeTab !== "team-dashboard") return;
    loadSummary();
  }, [activeTab, loadSummary]);

  const scrollStandupViewToTop = useCallback(() => {
    if (standupViewTopRef.current) {
      standupViewTopRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const moveQueueSelection = useCallback(
    (direction: -1 | 1) => {
      if (!orderedQueue.length) return;
      setQueueIndex((prevIndex) => {
        const nextIndex = Math.min(
          Math.max(prevIndex + direction, 0),
          orderedQueue.length - 1
        );
        const nextMember = orderedQueue[nextIndex];
        if (nextMember && nextMember.user.id !== selectedUserId) {
          setSelectedUserId(nextMember.user.id);
        }
        if (nextIndex !== prevIndex) {
          scrollStandupViewToTop();
        }
        return nextIndex;
      });
    },
    [orderedQueue, scrollStandupViewToTop, selectedUserId]
  );


  const moveCustomSequence = useCallback(
    (direction: -1 | 1) => {
      if (!selectedUserId) return;

      setCustomSequenceUserIds((current) => {
        const index = current.findIndex((userId) => userId === selectedUserId);
        if (index < 0) return current;

        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= current.length) return current;

        const next = [...current];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        return next;
      });
    },
    [selectedUserId]
  );

  const moveCustomSequenceUser = useCallback((sourceUserId: string, targetUserId: string) => {
    if (sourceUserId === targetUserId) return;

    setCustomSequenceUserIds((current) => {
      const sourceIndex = current.findIndex((userId) => userId === sourceUserId);
      const targetIndex = current.findIndex((userId) => userId === targetUserId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [movedUserId] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedUserId);
      return next;
    });
  }, []);

  const handleSaveCustomSequence = useCallback(async () => {
    setIsSavingSequence(true);
    setSequenceError("");

    try {
      const response = await saveStandupSequence(projectId, customSequenceUserIds);
      setSavedSequenceUserIds(response.sequenceUserIds);
      addToast({ type: "success", message: "Standup sequence saved." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save standup sequence";
      setSequenceError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSavingSequence(false);
    }
  }, [addToast, customSequenceUserIds, projectId]);

  useEffect(() => {
    if (activeTab !== "standup-view") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveQueueSelection(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveQueueSelection(1);
        return;
      }

      if (event.key === "n" || event.key === "N") {
        if (notesInputRef.current) {
          event.preventDefault();
          notesInputRef.current.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, moveQueueSelection]);

  const handleCopySummary = async () => {
    if (!summary?.summary) return;

    try {
      await navigator.clipboard.writeText(summary.summary);
      addToast({ type: "success", message: "Summary copied to clipboard." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy summary.";
      addToast({ type: "error", message });
    }
  };

  const renderLinkedWork = (entry: StandupEntry) => {
    const hasLinkedWork = entry.issues.length + entry.research.length > 0;

    if (!hasLinkedWork) {
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400">No linked work.</p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {entry.issues.map((link) => (
          <Link
            key={link.issue.id}
            href={`/issues/${link.issue.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:underline dark:bg-blue-900/30 dark:text-blue-200"
          >
            {link.issue.key ?? "ISSUE"}
            <span className="text-slate-500 dark:text-slate-300">· {link.issue.title}</span>
          </Link>
        ))}
        {entry.research.map((link) => (
          <span
            key={link.researchItem.id}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
          >
            {link.researchItem.key ?? "RESEARCH"}
            <span className="text-slate-500 dark:text-slate-300">· {link.researchItem.title}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
            {projectName} standup
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Capture your update and (if you're an admin or PO) review the daily summary for the team.
          </p>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium shadow-inner dark:border-slate-800 dark:bg-slate-800/70">
          <button
            className={`rounded-full px-3 py-1 transition ${
              activeTab === "my-update"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
            onClick={() => setActiveTab("my-update")}
          >
            My Update
          </button>
          {canViewDashboard && (
            <>
              <button
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === "team-dashboard"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("team-dashboard")}
              >
                Team Dashboard
              </button>
              <button
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === "standup-view"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
                onClick={() => setActiveTab("standup-view")}
              >
                Stand up View
              </button>
            </>
          )}
        </div>
      </div>

        {activeTab === "my-update" && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {canProxyStandup ? "Standup update for" : "Your standup for"}{" "}
                  {formatDisplayDate(mySelectedDate)}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {actingUserName} · {actingUserEmail}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                {canProxyStandup && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Update as
                    </label>
                    <select
                      value={actingUserId}
                      onChange={(event) => setActingUserId(event.target.value)}
                      className="min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    >
                      {isLoadingMembers && members.length === 0 ? (
                        <option value={actingUserId}>Loading members...</option>
                      ) : members.length > 0 ? (
                        members.map((member) => (
                          <option key={member.id} value={member.user.id}>
                            {member.user.name ?? member.user.email ?? "Unnamed member"}
                          </option>
                        ))
                      ) : (
                        <option value={currentUserId}>{currentUserName}</option>
                      )}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={mySelectedDate}
                    onChange={(event) => setMySelectedDate(event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </div>

                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium shadow-inner dark:border-slate-800 dark:bg-slate-800/70">
                  <button
                    className={`rounded-full px-3 py-1 transition ${
                      standupMode === "ai"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                    onClick={() => setStandupMode("ai")}
                  >
                    AI Stand-up
                  </button>
                  <button
                    className={`rounded-full px-3 py-1 transition ${
                      standupMode === "manual"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                    onClick={() => setStandupMode("manual")}
                  >
                    Manual fill-in
                  </button>
                </div>
              </div>
            </div>

            {entryError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
                {entryError}
              </div>
            )}

            {standupMode === "ai" ? (
              <AIStandupAssistant
                projectId={projectId}
                userName={actingUserName}
                onDraftReady={handleDraftReady}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Yesterday
                      </label>
                      {currentEntry?.isComplete && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                          Complete
                        </span>
                      )}
                    </div>
                    <textarea
                      value={formState.progressSinceYesterday}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          progressSinceYesterday: event.target.value,
                        }))
                      }
                      placeholder="Yesterday I finished..."
                      rows={4}
                      className="mt-2 flex-1 min-h-[140px] h-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[16px]">&nbsp;</p>
                  </div>

                  <div className="h-full flex flex-col">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Dependencies
                    </label>
                    <textarea
                      value={formState.dependencies}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          dependencies: event.target.value,
                        }))
                      }
                      placeholder="Any dependencies to track?"
                      rows={3}
                      className="mt-2 flex-1 min-h-[140px] h-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[16px]">&nbsp;</p>
                  </div>

                  <div className="h-full flex flex-col">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Today's plan
                    </label>
                    <textarea
                      value={formState.summaryToday}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          summaryToday: event.target.value,
                        }))
                      }
                      placeholder="Today I'll..."
                      rows={4}
                      className="mt-2 flex-1 min-h-[140px] h-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <p
                      className={`mt-2 min-h-[16px] text-xs ${
                        !computedCompletion
                          ? "text-amber-600 dark:text-amber-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {!computedCompletion
                        ? "Add a plan for today and at least one linked issue to mark this entry complete."
                        : ""}
                    </p>
                  </div>

                  <div className="h-full flex flex-col">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Notes
                    </label>
                    <textarea
                      ref={notesInputRef}
                      value={formState.notes}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Anything else to capture?"
                      rows={3}
                      className="mt-2 flex-1 min-h-[140px] h-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[16px]">&nbsp;</p>
                  </div>

                  <div className="h-full flex flex-col">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Blockers
                    </label>
                    <textarea
                      value={formState.blockers}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          blockers: event.target.value,
                        }))
                      }
                      placeholder="Any blockers to call out?"
                      rows={3}
                      className="mt-2 flex-1 min-h-[140px] h-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[16px]">&nbsp;</p>
                  </div>

                  <div className="h-full space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Linked issues
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Uses project issue search
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={issueQuery}
                        onChange={(event) => setIssueQuery(event.target.value)}
                        placeholder="Search issues by key or title"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                      />
                      {issueQuery && issueOptions.length > 0 && (
                        <div className="absolute z-10 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          {issueOptions.map((issue) => (
                            <button
                              key={issue.id}
                              type="button"
                              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                              onClick={() => handleIssueAdd(issue)}
                            >
                              <span className="min-w-[70px] text-xs font-semibold text-slate-500 dark:text-slate-300">
                                {issue.key ?? "ISSUE"}
                              </span>
                              <span>{issue.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {issueSearchError && (
                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                          {issueSearchError}
                        </p>
                      )}
                    </div>

                    {selectedIssues.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedIssues.map((issue) => (
                          <span
                            key={issue.id}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                          >
                            <Link
                              href={`/issues/${issue.id}`}
                              className="hover:underline"
                            >
                              {issue.key ? `${issue.key}: ${issue.title}` : issue.title}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleIssueRemove(issue.id)}
                              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              aria-label="Remove issue"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Link at least one issue or research item to complete your standup.
                      </p>
                    )}
                  </div>

                  <div className="h-full space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Linked research
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Requires research board access
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={researchQuery}
                        onChange={(event) => setResearchQuery(event.target.value)}
                        placeholder="Search research by key or title"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                      />
                      {researchQuery && researchOptions.length > 0 && (
                        <div className="absolute z-10 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          {researchOptions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                              onClick={() => handleResearchAdd(item)}
                            >
                              <span className="min-w-[70px] text-xs font-semibold text-slate-500 dark:text-slate-300">
                                {item.key ?? "RESEARCH"}
                              </span>
                              <span>{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {researchSearchError && (
                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{researchSearchError}</p>
                      )}
                    </div>

                    {selectedResearch.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedResearch.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                          >
                            <span>{item.key ? `${item.key}: ${item.title}` : item.title}</span>
                            <button
                              type="button"
                              onClick={() => handleResearchRemove(item.id)}
                              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              aria-label="Remove research item"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Link research to capture ongoing discovery alongside delivery work.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFormState({
                        summaryToday: "",
                        progressSinceYesterday: "",
                        blockers: "",
                        dependencies: "",
                        notes: "",
                      });
                      setSelectedIssues([]);
                      setSelectedResearch([]);
                    }}
                  >
                    Clear
                  </Button>
                  <Button onClick={handleSaveEntry} disabled={isSavingEntry || isLoadingEntry}>
                    {isSavingEntry ? "Saving..." : "Save standup"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

      {activeTab === "standup-view" && canViewStandupView && (
        <div
          ref={standupViewTopRef}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Stand up View
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review a teammate's standup while keeping the summary easy to read on shared screens.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2 md:items-end">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Date</label>
              <input
                type="date"
                value={standupDateInput}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  const parsed = new Date(value);
                  if (Number.isNaN(parsed.getTime())) return;
                  parsed.setHours(0, 0, 0, 0);
                  setSelectedDate(parsed);
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              />
            </div>
          </div>

          {membersError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              {membersError}
            </div>
          )}
          {standupViewError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              {standupViewError}
            </div>
          )}

          <div className="space-y-3">
            <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3 xl:grid-cols-4">
              {isLoadingMembers && orderedQueue.length === 0 ? (
                <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  Loading members...
                </div>
              ) : (
                orderedQueue.map((member) => {
                  const isActive = member.user.id === selectedUserId;
                  const isDragOverTarget = dragOverSequenceUserId === member.user.id;
                  const initials = getInitials(member.user.name ?? member.user.email);
                  const status = queueStatusByUserId.get(member.user.id) ?? "missing";
                  const statusDot =
                    status === "updated"
                      ? "bg-emerald-500"
                      : status === "partial"
                        ? "bg-amber-400"
                        : "bg-slate-300 dark:bg-slate-600";

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedUserId(member.user.id)}
                      draggable={queueSortMode === "custom"}
                      onDragStart={(event) => {
                        if (queueSortMode !== "custom") return;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", member.user.id);
                        setDraggedSequenceUserId(member.user.id);
                        setDragOverSequenceUserId(member.user.id);
                        setSelectedUserId(member.user.id);
                      }}
                      onDragOver={(event) => {
                        if (queueSortMode !== "custom" || !draggedSequenceUserId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        if (dragOverSequenceUserId !== member.user.id) {
                          setDragOverSequenceUserId(member.user.id);
                        }
                      }}
                      onDrop={(event) => {
                        if (queueSortMode !== "custom") return;
                        event.preventDefault();
                        const sourceUserId = event.dataTransfer.getData("text/plain") || draggedSequenceUserId;
                        if (!sourceUserId) return;
                        moveCustomSequenceUser(sourceUserId, member.user.id);
                        setSelectedUserId(sourceUserId);
                        setDraggedSequenceUserId(null);
                        setDragOverSequenceUserId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedSequenceUserId(null);
                        setDragOverSequenceUserId(null);
                      }}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-slate-900 shadow-sm dark:border-blue-400/80 dark:bg-blue-900/40 dark:text-slate-50"
                          : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-slate-800"
                      } ${
                        isDragOverTarget && queueSortMode === "custom"
                          ? "ring-2 ring-blue-300 dark:ring-blue-500/70"
                          : ""
                      } ${
                        draggedSequenceUserId === member.user.id ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                        {member.user.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt={member.user.name ?? "Member avatar"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials || "?"
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {member.role}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 rounded-full ${statusDot}`}
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="space-y-2 md:hidden">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Select user
              </label>
              <select
                value={selectedUserId ?? ""}
                onChange={(event) => setSelectedUserId(event.target.value || null)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              >
                <option value="" disabled>
                  {isLoadingMembers ? "Loading members..." : "Choose a user"}
                </option>
                {orderedQueue.map((member) => (
                  <option key={member.id} value={member.user.id}>
                    {member.user.name ?? member.user.email}
                  </option>
                ))}
              </select>
            </div>

            {queueSortMode === "custom" && orderedQueue.length > 1 && (
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 md:block">
                Drag teammate cards to reorder the standup sequence, then save order.
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    {selectedMember?.user.avatarUrl ? (
                      <img
                        src={selectedMember.user.avatarUrl}
                        alt={selectedMember.user.name ?? "Selected member"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(
                        selectedMember?.user.name ??
                          selectedMember?.user.email ??
                          standupViewData?.user.name
                      ) || "?"
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {standupViewData?.user.name ?? selectedMember?.user.name ?? "Select a user"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Standup for {formattedStandupDate}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Yesterday: {formattedYesterdayDate}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    key: "yesterday",
                    title: `Yesterday (${formattedYesterdayDate})`,
                    entries: yesterdayEntries,
                    empty: "No standup update for yesterday",
                  },
                  {
                    key: "today",
                    title: `Today (${formattedStandupDate})`,
                    entries: todayEntries,
                    empty: "No standup update for today yet.",
                  },
                ].map((section) => {
                  const isTodaySection = section.key === "today";
                  const highlightMissing = isTodaySection && todayStatus === "partial";

                  return (
                  <div
                    key={section.title}
                    className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/70">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {section.title}
                        </p>
                        {isTodaySection && todayStatus === "partial" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                            🟡 Partial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {standupViewData?.user.name ??
                          selectedMember?.user.name ??
                          "Select a user to view updates"}
                      </p>
                    </div>
                    <div className="space-y-3 p-4">
                      {isLoadingStandupView ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Loading stand-up details...
                        </p>
                      ) : section.entries.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {section.empty}
                        </p>
                      ) : (
                        section.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                Plan & Progress
                              </p>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  getStandupEntryStatus(entry) === "updated"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                }`}
                              >
                                {getStandupEntryStatus(entry) === "updated"
                                  ? "Complete"
                                  : "Incomplete"}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Yesterday
                                </p>
                                <p
                                  className={`mt-1 whitespace-pre-line rounded-md border p-3 leading-relaxed ${
                                    highlightMissing && todayMissingSections.progress
                                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
                                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                  }`}
                                >
                                  {entry.progressSinceYesterday ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Today
                                </p>
                                <p
                                  className={`mt-1 whitespace-pre-line rounded-md border p-3 leading-relaxed ${
                                    highlightMissing && todayMissingSections.today
                                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
                                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                  }`}
                                >
                                  {entry.summaryToday ?? "—"}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Blockers
                                </p>
                                <p
                                  className={`mt-1 whitespace-pre-line rounded-md border p-3 text-sm leading-relaxed ${
                                    highlightMissing && todayMissingSections.blockers
                                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
                                      : "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  {entry.blockers ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Dependencies
                                </p>
                                <p
                                  className={`mt-1 whitespace-pre-line rounded-md border p-3 text-sm leading-relaxed ${
                                    highlightMissing && todayMissingSections.dependencies
                                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
                                      : "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  {entry.dependencies ?? "—"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Linked work
                              </p>
                              <div
                                className={`mt-1 rounded-md ${
                                  highlightMissing && todayMissingSections.linkedWork
                                    ? "border border-amber-300 bg-amber-50 p-3 dark:border-amber-600/60 dark:bg-amber-950/40"
                                    : ""
                                }`}
                              >
                                {renderLinkedWork(entry)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Next up
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Queue
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Rotate through teammates to keep the flow going.
                </p>
                {isLoadingQueueEntries && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Updating queue status...
                  </p>
                )}
                {queueEntriesError && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    {queueEntriesError}
                  </p>
                )}
                <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {orderedQueue.length === 0 ? (
                    <>
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
                        Add teammates to the project to fill the queue.
                      </p>
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
                        Invite another teammate.
                      </p>
                    </>
                  ) : upcomingQueue.length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
                      End of the queue.
                    </p>
                  ) : (
                    upcomingQueue.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-2.5 w-2.5 rounded-full ${
                            (queueStatusByUserId.get(member.user.id) ?? "missing") ===
                            "updated"
                              ? "bg-emerald-500"
                              : (queueStatusByUserId.get(member.user.id) ?? "missing") ===
                                  "partial"
                                ? "bg-amber-400"
                                : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        {member.user.name ?? member.user.email}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Facilitator Notes (private)
                </h3>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Keep private reminders while you guide the stand-up.
                </p>
                <div className="mt-3 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      New note
                    </label>
                    <textarea
                      ref={facilitatorNoteInputRef}
                      value={newFacilitatorNote}
                      onChange={(event) => setNewFacilitatorNote(event.target.value)}
                      rows={3}
                      placeholder={`Note about ${
                        standupViewData?.user.name ??
                        selectedMember?.user.name ??
                        "this teammate"
                      }`}
                      className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleCreateFacilitatorNote}
                        disabled={isSavingFacilitatorNote}
                      >
                        {isSavingFacilitatorNote ? "Saving..." : "Save note"}
                      </Button>
                    </div>
                  </div>

                  {facilitatorNotesError && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                      {facilitatorNotesError}
                    </p>
                  )}

                  {isLoadingFacilitatorNotes ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Loading notes...
                    </p>
                  ) : facilitatorNotes.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No facilitator notes yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {facilitatorNotes.map((note) => {
                        const isEditing = editingNoteId === note.id;
                        return (
                          <li
                            key={note.id}
                            className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex-1 space-y-2">
                                {isEditing ? (
                                  <textarea
                                    value={editingNoteText}
                                    onChange={(event) =>
                                      setEditingNoteText(event.target.value)
                                    }
                                    rows={3}
                                    className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                  />
                                ) : (
                                  <p
                                    className={`whitespace-pre-line text-sm ${
                                      note.resolved
                                        ? "text-slate-400 line-through dark:text-slate-400"
                                        : "text-slate-800 dark:text-slate-100"
                                    }`}
                                  >
                                    {note.text}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span>Added {formatTimeOnly(note.createdAt)}</span>
                                  {note.resolved && note.resolvedAt && (
                                    <span>Resolved {formatTimeOnly(note.resolvedAt)}</span>
                                  )}
                                  {note.resolved && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                      Resolved
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" onClick={handleSaveEdit}>
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={handleCancelEdit}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleEditFacilitatorNote(note)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleToggleResolved(note)}
                                    >
                                      {note.resolved ? "Reopen" : "Resolve"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteFacilitatorNote(note.id)}
                                    >
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 mt-4 border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Current teammate</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {standupViewData?.user.name ?? selectedMember?.user.name ?? "Select a user"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {orderedQueue.length > 0
                    ? `Position ${queueIndex + 1} of ${orderedQueue.length}`
                    : "Queue empty"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Order
                  </label>
                  <select
                    value={queueSortMode}
                    onChange={(event) =>
                      setQueueSortMode(
                        event.target.value === "alphabetical"
                          ? "alphabetical"
                          : event.target.value === "custom"
                            ? "custom"
                            : "suggested"
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="suggested">Suggested</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {queueSortMode === "custom" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={!selectedUserId}
                      onClick={() => moveCustomSequence(-1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!selectedUserId}
                      onClick={() => moveCustomSequence(1)}
                    >
                      Move down
                    </Button>
                    <Button
                      disabled={isSavingSequence || !isSequenceDirty}
                      onClick={handleSaveCustomSequence}
                    >
                      {isSavingSequence ? "Saving..." : "Save order"}
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={!orderedQueue.length || queueIndex <= 0}
                    onClick={() => moveQueueSelection(-1)}
                  >
                    Prev
                  </Button>
                  <Button
                    disabled={
                      !orderedQueue.length || queueIndex >= orderedQueue.length - 1
                    }
                    onClick={() => moveQueueSelection(1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
              {queueSortMode === "custom" && sequenceError && (
                <p className="w-full text-xs text-rose-600 dark:text-rose-300">{sequenceError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "team-dashboard" && canViewDashboard && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Team AI standup summary
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Product Owners and Admins can review an AI-generated digest and the raw entries for the selected date.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={summaryDate}
                onChange={(event) => setSummaryDate(event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              />
            </div>
          </div>

          {summaryError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              {summaryError}
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  AI Summary for {formatDisplayDate(summaryDate)}
                </h3>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  {isLoadingSummary ? (
                    <p>Generating summary...</p>
                  ) : summary?.summary ? (
                    <MarkdownRenderer
                      content={summary.summary ?? ""}
                      className="prose prose-sm max-w-none text-slate-700 dark:text-slate-200 dark:prose-invert"
                    />
                  ) : (
                    <p>No summary available yet for this date.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => loadSummary(true)}
                  disabled={isLoadingSummary}
                >
                  {isLoadingSummary ? "Generating..." : "Regenerate Summary"}
                </Button>
                <Button
                  onClick={handleCopySummary}
                  disabled={!summary?.summary || isLoadingSummary}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/70">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Stand-up entries</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Raw submissions for {formatDisplayDate(summaryDate)}.
                </p>
              </div>
              {summary?.entries && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {summary.entries.length} entr{summary.entries.length === 1 ? "y" : "ies"}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Progress & Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Blockers & Dependencies
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Linked work
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
                  {isLoadingSummary && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                        Generating summary and loading entries...
                      </td>
                    </tr>
                  )}
                  {!isLoadingSummary && (!summary?.entries || summary.entries.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                        No stand-up entries for this date.
                      </td>
                    </tr>
                  )}
                  {!isLoadingSummary &&
                    summary?.entries?.map((entry) => (
                      <tr key={entry.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">{entry.user.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{entry.user.email}</p>
                            <span className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                              entry.isComplete
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}>
                              {entry.isComplete ? "Complete" : "Incomplete"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 space-y-3 text-slate-800 dark:text-slate-200">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Yesterday
                            </p>
                            <p className="mt-1 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800">
                              {entry.progressSinceYesterday ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Today
                            </p>
                            <p className="mt-1 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800">
                              {entry.summaryToday ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 space-y-3 text-slate-800 dark:text-slate-200">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Blockers
                            </p>
                            <p className="mt-1 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800">
                              {entry.blockers ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Dependencies
                            </p>
                            <p className="mt-1 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800">
                              {entry.dependencies ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                          {entry.issues.length + entry.research.length ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {entry.issues.map((link) => (
                                <Link
                                  key={link.issue.id}
                                  href={`/issues/${link.issue.id}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:underline dark:bg-blue-900/30 dark:text-blue-200"
                                >
                                  {link.issue.key ?? "ISSUE"}
                                  <span className="text-slate-500 dark:text-slate-300">· {link.issue.title}</span>
                                </Link>
                              ))}
                              {entry.research.map((link) => (
                                <span
                                  key={link.researchItem.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                                >
                                  {link.researchItem.key ?? "RESEARCH"}
                                  <span className="text-slate-500 dark:text-slate-300">· {link.researchItem.title}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">No linked work</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-3 text-sm shadow-lg ${
              toast.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                : toast.type === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
