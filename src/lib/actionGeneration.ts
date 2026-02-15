import crypto from "node:crypto";

import type { DailyStandupEntry, Issue, ResearchItem, Role, User } from "@prisma/client";

import type { StandupSummaryBulletV1, StandupSummaryV1 } from "./standupSummary";

export const ACTION_TYPES = [
  "UNBLOCK_DECISION",
  "REQUEST_HELP",
  "FOLLOW_UP_STATUS",
  "ASSIGN_OWNER",
  "ESCALATE_BLOCKER",
  "CLARIFY_SCOPE",
] as const;

export const ACTION_DUE_VALUES = ["today", "tomorrow"] as const;

export type StandupActionType = (typeof ACTION_TYPES)[number];
export type StandupActionDue = (typeof ACTION_DUE_VALUES)[number] | string;
export type StandupActionSeverity = "low" | "med" | "high";

export type StandupActionItemV1 = {
  id: string;
  title: string;
  owner_user_id: string;
  target_user_id: string | null;
  action_type: StandupActionType;
  reason: string;
  due: StandupActionDue;
  severity: StandupActionSeverity;
  source_entry_ids: string[];
  linked_work_ids: string[];
};

type StandupEntryWithUser = DailyStandupEntry & {
  user: User;
  issues: { issue: Issue }[];
  research: { researchItem: ResearchItem }[];
};

const normalizeArrayValues = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();

const trimText = (value: string) => value.trim().replace(/\s+/g, " ");

const canonicalText = (value: string) =>
  trimText(value)
    .replace(/^[^:]{2,40}:\s*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

const severityWeight: Record<StandupActionSeverity, number> = {
  high: 3,
  med: 2,
  low: 1,
};

const ownerCandidateRoles: Role[] = ["ADMIN", "PO"];

const createStableActionId = (
  summaryId: string,
  action: Omit<StandupActionItemV1, "id">
) => {
  const stablePayload = JSON.stringify({
    summaryId,
    action_type: action.action_type,
    owner_user_id: action.owner_user_id,
    target_user_id: action.target_user_id ?? "",
    title: trimText(action.title),
    reason: trimText(action.reason),
    due: action.due,
    severity: action.severity,
    source_entry_ids: normalizeArrayValues(action.source_entry_ids),
    linked_work_ids: normalizeArrayValues(action.linked_work_ids),
  });

  const digest = crypto
    .createHash("sha256")
    .update(stablePayload)
    .digest("hex")
    .slice(0, 12);

  return `action_${digest}`;
};

const inferDependencyOwner = (entries: StandupEntryWithUser[], linkedWorkIds: string[]) => {
  const normalizedWorkIds = new Set(linkedWorkIds.map((id) => id.trim()).filter(Boolean));

  for (const entry of entries) {
    const issueOwner = entry.issues.find(
      ({ issue }) =>
        normalizedWorkIds.has(issue.id) || (issue.key ? normalizedWorkIds.has(issue.key) : false)
    )?.issue.assigneeId;
    if (issueOwner) return issueOwner;

    const researchOwner = entry.research.find(
      ({ researchItem }) =>
        normalizedWorkIds.has(researchItem.id) ||
        (researchItem.key ? normalizedWorkIds.has(researchItem.key) : false)
    )?.researchItem.assigneeId;
    if (researchOwner) return researchOwner;
  }

  return null;
};

const toAction = (
  summaryId: string,
  action: Omit<StandupActionItemV1, "id">
): StandupActionItemV1 => ({
  ...action,
  title: trimText(action.title),
  reason: trimText(action.reason),
  source_entry_ids: normalizeArrayValues(action.source_entry_ids),
  linked_work_ids: normalizeArrayValues(action.linked_work_ids),
  id: createStableActionId(summaryId, action),
});

const findProjectLeadUserId = (entries: StandupEntryWithUser[]) =>
  entries.find((entry) => ownerCandidateRoles.includes(entry.user.role))?.userId ?? entries[0]?.userId;

const pickOwnerUserId = (
  type: StandupActionType,
  sourceOwnerUserId: string,
  entries: StandupEntryWithUser[]
) => {
  const leadUserId = findProjectLeadUserId(entries);
  if (!leadUserId) return sourceOwnerUserId;

  if (["UNBLOCK_DECISION", "ESCALATE_BLOCKER", "CLARIFY_SCOPE"].includes(type)) {
    return leadUserId;
  }

  if (type === "FOLLOW_UP_STATUS") {
    return leadUserId;
  }

  if (type === "ASSIGN_OWNER") {
    return leadUserId;
  }

  return sourceOwnerUserId;
};

const mergeActions = (summaryId: string, actions: StandupActionItemV1[]) => {
  const merged = new Map<string, StandupActionItemV1>();

  actions.forEach((action) => {
    const key = `${action.action_type}:${canonicalText(action.reason) || canonicalText(action.title)}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, action);
      return;
    }

    const nextSeverity =
      severityWeight[action.severity] > severityWeight[existing.severity]
        ? action.severity
        : existing.severity;
    const nextDue = existing.due === "today" || action.due !== "today" ? existing.due : "today";

    merged.set(
      key,
      toAction(summaryId, {
        ...existing,
        severity: nextSeverity,
        due: nextDue,
        source_entry_ids: [...existing.source_entry_ids, ...action.source_entry_ids],
        linked_work_ids: [...existing.linked_work_ids, ...action.linked_work_ids],
      })
    );
  });

  return [...merged.values()];
};

const rankActions = (actions: StandupActionItemV1[]) =>
  [...actions].sort((a, b) => {
    const severitySort = severityWeight[b.severity] - severityWeight[a.severity];
    if (severitySort !== 0) return severitySort;

    const dueScore = (value: string) => {
      if (value === "today") return 0;
      if (value === "tomorrow") return 1;
      return 2;
    };

    const dueSort = dueScore(a.due) - dueScore(b.due);
    if (dueSort !== 0) return dueSort;

    const poSort =
      Number(b.action_type === "UNBLOCK_DECISION" || b.action_type === "CLARIFY_SCOPE") -
      Number(a.action_type === "UNBLOCK_DECISION" || a.action_type === "CLARIFY_SCOPE");
    if (poSort !== 0) return poSort;

    const evidenceStrengthSort =
      b.source_entry_ids.length + b.linked_work_ids.length -
      (a.source_entry_ids.length + a.linked_work_ids.length);
    if (evidenceStrengthSort !== 0) return evidenceStrengthSort;

    return a.id.localeCompare(b.id);
  });

export const generateActionsRequired = (
  summary: StandupSummaryV1,
  entries: StandupEntryWithUser[]
): StandupActionItemV1[] => {
  const candidateActions: StandupActionItemV1[] = [];
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  summary.blockers.forEach((blocker) => {
    const sourceEntry = entryById.get(blocker.source_entry_ids[0] ?? "");
    const sourceOwnerUserId = sourceEntry?.userId ?? entries[0]?.userId;
    if (!sourceOwnerUserId) return;

    const isDecisionOrPo = /\b(po|product owner|decision|approve|approval|scope)\b/i.test(
      blocker.text
    );

    const actionType: StandupActionType = isDecisionOrPo
      ? /\bscope\b/i.test(blocker.text)
        ? "CLARIFY_SCOPE"
        : "UNBLOCK_DECISION"
      : "FOLLOW_UP_STATUS";

    candidateActions.push(
      toAction(summary.summary_id, {
        title:
          actionType === "CLARIFY_SCOPE"
            ? "Clarify scope to unblock work"
            : actionType === "UNBLOCK_DECISION"
              ? "Unblock decision on blocker"
              : "Follow up on blocker status",
        owner_user_id: pickOwnerUserId(actionType, sourceOwnerUserId, entries),
        target_user_id: null,
        action_type: actionType,
        reason: blocker.text || "A blocker was reported and needs a same-day update.",
        due: "today",
        severity: isDecisionOrPo ? "high" : "med",
        source_entry_ids: blocker.source_entry_ids,
        linked_work_ids: blocker.linked_work_ids,
      })
    );

    if (/\bblocked|stuck|urgent|critical|escalat(e|ion)\b/i.test(blocker.text)) {
      candidateActions.push(
        toAction(summary.summary_id, {
          title: "Escalate critical blocker",
          owner_user_id: pickOwnerUserId("ESCALATE_BLOCKER", sourceOwnerUserId, entries),
          target_user_id: null,
          action_type: "ESCALATE_BLOCKER",
          reason: blocker.text,
          due: "today",
          severity: "high",
          source_entry_ids: blocker.source_entry_ids,
          linked_work_ids: blocker.linked_work_ids,
        })
      );
    }
  });

  summary.dependencies.forEach((dependency) => {
    const sourceEntry = entryById.get(dependency.source_entry_ids[0] ?? "");
    const sourceOwnerUserId = sourceEntry?.userId ?? entries[0]?.userId;
    if (!sourceOwnerUserId) return;

    candidateActions.push(
      toAction(summary.summary_id, {
        title: "Request help on dependency",
        owner_user_id: pickOwnerUserId("REQUEST_HELP", sourceOwnerUserId, entries),
        target_user_id: inferDependencyOwner(entries, dependency.linked_work_ids),
        action_type: "REQUEST_HELP",
        reason: dependency.text || "Dependency requires coordination to proceed.",
        due: "today",
        severity: "med",
        source_entry_ids: dependency.source_entry_ids,
        linked_work_ids: dependency.linked_work_ids,
      })
    );
  });

  summary.assignment_gaps.forEach((gap) => {
    const sourceEntry = entryById.get(gap.source_entry_ids[0] ?? "");
    const sourceOwnerUserId = sourceEntry?.userId ?? entries[0]?.userId;
    if (!sourceOwnerUserId) return;

    candidateActions.push(
      toAction(summary.summary_id, {
        title: "Assign a clear owner",
        owner_user_id: pickOwnerUserId("ASSIGN_OWNER", sourceOwnerUserId, entries),
        target_user_id: null,
        action_type: "ASSIGN_OWNER",
        reason: gap.text || "Workstream has no clear owner.",
        due: "today",
        severity: "med",
        source_entry_ids: gap.source_entry_ids,
        linked_work_ids: gap.linked_work_ids,
      })
    );
  });

  entries.forEach((entry) => {
    const isMissingUpdate = !entry.summaryToday?.trim() && !entry.progressSinceYesterday?.trim();
    if (!isMissingUpdate) return;

    candidateActions.push(
      toAction(summary.summary_id, {
        title: "Follow up on missing standup",
        owner_user_id: pickOwnerUserId("FOLLOW_UP_STATUS", entry.userId, entries),
        target_user_id: entry.userId,
        action_type: "FOLLOW_UP_STATUS",
        reason: `${entry.user.name || entry.user.email || entry.userId} has not submitted a standup update.`,
        due: "today",
        severity: "low",
        source_entry_ids: [entry.id],
        linked_work_ids: [
          ...entry.issues.map(({ issue }) => issue.id),
          ...entry.research.map(({ researchItem }) => researchItem.id),
        ],
      })
    );
  });

  const deduped = mergeActions(summary.summary_id, candidateActions);
  return rankActions(deduped).slice(0, 15);
};

export const normalizeActionItems = (
  summaryId: string,
  actions: StandupActionItemV1[]
): StandupActionItemV1[] =>
  actions.map((action) =>
    toAction(summaryId, {
      ...action,
      target_user_id: action.target_user_id ?? null,
    })
  );

export const withGeneratedActions = (
  summary: StandupSummaryV1,
  entries: StandupEntryWithUser[]
): StandupSummaryV1 => ({
  ...summary,
  actions_required: rankActions(
    normalizeActionItems(
      summary.summary_id,
      summary.actions_required?.length
        ? summary.actions_required
        : generateActionsRequired(summary, entries)
    )
  ),
});

export const extractActionTitles = (actions: StandupActionItemV1[]) =>
  actions.map((action) => `${action.title} (${action.severity})`);

export const hasNoActionEvidence = (action: StandupActionItemV1) =>
  action.source_entry_ids.length === 0 && action.linked_work_ids.length === 0;

export const hasActionEvidence = (action: StandupActionItemV1) => !hasNoActionEvidence(action);

export const actionHasSource = (
  action: StandupActionItemV1,
  bullet: StandupSummaryBulletV1
) =>
  action.source_entry_ids.some((id) => bullet.source_entry_ids.includes(id)) ||
  action.linked_work_ids.some((id) => bullet.linked_work_ids.includes(id));
