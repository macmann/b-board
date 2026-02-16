export type CoordinationEventType =
  | "SUMMARY_VIEWED"
  | "EVIDENCE_CLICKED"
  | "FEEDBACK_SUBMITTED"
  | "DIGEST_COPIED"
  | "ACTION_INTERACTION"
  | "QUESTION_EVENT"
  | "BLOCKER_PERSISTED"
  | "MISSING_STANDUP_DETECTED"
  | "STALE_WORK_DETECTED"
  | "LOW_CONFIDENCE_DETECTED"
  | "ACTION_OVERDUE"
  | "QUESTION_UNANSWERED"
  | "SNOOZE_EXPIRED";

export type CoordinationSeverity = "LOW" | "MEDIUM" | "HIGH";

export type CoordinationEvent = {
  id: string;
  projectId: string;
  eventType: CoordinationEventType;
  targetUserId?: string | null;
  relatedEntityId?: string | null;
  severity?: CoordinationSeverity | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
  processedAt?: Date | null;
};

export type CoordinationTriggerStatus = "PENDING" | "SENT" | "DISMISSED" | "RESOLVED";

export type CoordinationTrigger = {
  id: string;
  projectId: string;
  ruleId: string;
  targetUserId: string;
  relatedEntityId?: string | null;
  severity: CoordinationSeverity;
  createdAt: Date;
  status: CoordinationTriggerStatus;
  resolvedAt?: Date | null;
  escalationLevel: number;
  dedupKey: string;
};

export type CoordinationTriggerDraft = {
  projectId: string;
  ruleId: string;
  targetUserId: string;
  relatedEntityId?: string | null;
  severity: CoordinationSeverity;
  escalationLevel: number;
  dedupKey: string;
};

export type CoordinationLogEntry = {
  level: "info" | "debug";
  eventId?: string;
  ruleId?: string;
  dedupKey?: string;
  message: string;
};
