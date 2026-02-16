export type DigestType = "stakeholder" | "team-detailed" | "sprint-snapshot";

export type DigestActionItem = {
  id: string;
  title: string;
  reason: string;
  linked_work_ids: string[];
  severity?: "low" | "med" | "high";
  due?: string;
};

export type DigestOpenQuestion = {
  id: string;
  question_text: string;
  source_entry_ids: string[];
  priority?: "low" | "med" | "high";
};

type DigestBullet = {
  id: string;
  text: string;
  linked_work_ids: string[];
};

export type DigestSource = {
  date: string;
  generated_at?: string;
  sprint_name?: string | null;
  sprint_date_range?: string | null;
  summary_json?: {
    overall_progress: string;
    actions_required: DigestActionItem[];
    open_questions: DigestOpenQuestion[];
    achievements: DigestBullet[];
    blockers: DigestBullet[];
    dependencies: DigestBullet[];
    assignment_gaps: DigestBullet[];
  } | null;
  summary_rendered?: {
    overall_progress: string;
  } | null;
  visible_actions?: DigestActionItem[];
  visible_open_questions?: DigestOpenQuestion[];
  signals?: {
    quality_score?: number | null;
    metrics?: {
      completion_rate?: number;
      missing_linked_work_rate?: number;
      missing_blockers_rate?: number;
      vague_update_rate?: number;
    } | null;
  } | null;
};

type DigestOptions = {
  includeReferences?: boolean;
};

const NONE_REPORTED = "None reported";
const MAX_STAKEHOLDER_ITEMS = 3;
const MAX_STAKEHOLDER_LINE_LENGTH = 160;

const SEVERITY_RANK: Record<NonNullable<DigestActionItem["severity"]>, number> = {
  high: 0,
  med: 1,
  low: 2,
};

const PRIORITY_RANK: Record<NonNullable<DigestOpenQuestion["priority"]>, number> = {
  high: 0,
  med: 1,
  low: 2,
};

const formatList = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${NONE_REPORTED}`;

const asPercent = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const truncateLine = (value: string, limit: number) => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

const maybeReferenceText = (linkedWorkIds: string[] | undefined, includeReferences: boolean) => {
  if (!includeReferences || !linkedWorkIds?.length) return "";

  const references = [...new Set(linkedWorkIds.map((item) => item.trim()).filter(Boolean))].sort();
  if (!references.length) return "";
  return ` (refs: ${references.join(", ")})`;
};

const sortBullets = (items: DigestBullet[]) =>
  [...items].sort((a, b) => {
    const textCompare = normalizeWhitespace(a.text).localeCompare(normalizeWhitespace(b.text));
    if (textCompare !== 0) return textCompare;
    return a.id.localeCompare(b.id);
  });

const sortActions = (items: DigestActionItem[]) =>
  [...items].sort((a, b) => {
    const severityA = a.severity ? SEVERITY_RANK[a.severity] : Number.MAX_SAFE_INTEGER;
    const severityB = b.severity ? SEVERITY_RANK[b.severity] : Number.MAX_SAFE_INTEGER;
    if (severityA !== severityB) return severityA - severityB;

    const dueCompare = (a.due ?? "").localeCompare(b.due ?? "");
    if (dueCompare !== 0) return dueCompare;

    const titleCompare = normalizeWhitespace(a.title).localeCompare(normalizeWhitespace(b.title));
    if (titleCompare !== 0) return titleCompare;

    return a.id.localeCompare(b.id);
  });

const sortQuestions = (items: DigestOpenQuestion[]) =>
  [...items].sort((a, b) => {
    const priorityA = a.priority ? PRIORITY_RANK[a.priority] : Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ? PRIORITY_RANK[b.priority] : Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;

    const textCompare = normalizeWhitespace(a.question_text).localeCompare(normalizeWhitespace(b.question_text));
    if (textCompare !== 0) return textCompare;

    return a.id.localeCompare(b.id);
  });

const describeAction = (action: DigestActionItem, includeReferences: boolean) =>
  `${normalizeWhitespace(action.title)} — ${normalizeWhitespace(action.reason)}${maybeReferenceText(action.linked_work_ids, includeReferences)}`;

const describeQuestion = (question: DigestOpenQuestion, includeReferences: boolean) =>
  `${normalizeWhitespace(question.question_text)}${maybeReferenceText(question.source_entry_ids, includeReferences)}`;

const getActions = (source: DigestSource) => sortActions(source.visible_actions ?? source.summary_json?.actions_required ?? []);

const getOpenQuestions = (source: DigestSource) =>
  sortQuestions(source.visible_open_questions ?? source.summary_json?.open_questions ?? []);

const finalizeOutput = (lines: string[]) =>
  lines
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getWeekOf = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateValue;

  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const formatGeneratedTimestamp = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

export const renderDigest = (
  type: DigestType,
  source: DigestSource,
  options: DigestOptions = {}
) => {
  const includeReferences = options.includeReferences ?? false;

  const overallProgress = truncateLine(
    source.summary_rendered?.overall_progress ?? source.summary_json?.overall_progress ?? "No summary available.",
    MAX_STAKEHOLDER_LINE_LENGTH
  );

  const achievements = sortBullets(source.summary_json?.achievements ?? []);
  const blockers = sortBullets(source.summary_json?.blockers ?? []);
  const dependencies = sortBullets(source.summary_json?.dependencies ?? []);
  const assignmentGaps = sortBullets(source.summary_json?.assignment_gaps ?? []);

  const actions = getActions(source);
  const openQuestions = getOpenQuestions(source);

  if (type === "stakeholder") {
    const winsLine = achievements.length
      ? achievements
          .slice(0, MAX_STAKEHOLDER_ITEMS)
          .map((item) => truncateLine(`${item.text}${maybeReferenceText(item.linked_work_ids, includeReferences)}`, 48))
          .join("; ")
      : NONE_REPORTED;

    const risksLine = blockers.length
      ? blockers
          .slice(0, MAX_STAKEHOLDER_ITEMS)
          .map((item) => truncateLine(`${item.text}${maybeReferenceText(item.linked_work_ids, includeReferences)}`, 48))
          .join("; ")
      : NONE_REPORTED;

    const actionsLine = actions.length
      ? actions
          .slice(0, MAX_STAKEHOLDER_ITEMS)
          .map((item) => truncateLine(`${item.title}${maybeReferenceText(item.linked_work_ids, includeReferences)}`, 48))
          .join("; ")
      : NONE_REPORTED;

    return finalizeOutput([
      `Stakeholder Digest — As of ${source.date}`,
      `Progress: ${truncateLine(overallProgress, MAX_STAKEHOLDER_LINE_LENGTH - 10)}`,
      `Wins: ${truncateLine(winsLine, MAX_STAKEHOLDER_LINE_LENGTH - 6)}`,
      `Risks: ${truncateLine(risksLine, MAX_STAKEHOLDER_LINE_LENGTH - 7)}`,
      `Actions needed: ${truncateLine(actionsLine, MAX_STAKEHOLDER_LINE_LENGTH - 16)}`,
    ]);
  }

  if (type === "sprint-snapshot") {
    const generatedOn = formatGeneratedTimestamp(source.generated_at);
    const sprintHeading = source.sprint_name ? `${source.sprint_name} (${source.date})` : `Week of ${getWeekOf(source.date)}`;
    const rangeLine = source.sprint_date_range ? `Date range: ${source.sprint_date_range}` : null;

    return finalizeOutput([
      `# Sprint Snapshot — ${sprintHeading}`,
      generatedOn ? `Generated on ${generatedOn}` : "",
      rangeLine ?? "",
      "## Progress",
      overallProgress,
      "",
      "## Wins",
      formatList(
        achievements.map(
          (item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`
        )
      ),
      "",
      "## Risks / Blockers",
      formatList(
        blockers.map(
          (item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`
        )
      ),
      "",
      "## Actions Needed",
      formatList(actions.map((item) => describeAction(item, includeReferences))),
      "",
      "## Open Questions",
      formatList(openQuestions.map((item) => describeQuestion(item, includeReferences))),
      "",
      "## Dependencies",
      formatList(
        dependencies.map(
          (item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`
        )
      ),
      "",
      "## Assignment Gaps",
      formatList(
        assignmentGaps.map(
          (item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`
        )
      ),
    ]);
  }

  return finalizeOutput([
    `Detailed Team Digest — ${source.date}`,
    "",
    "Action Center",
    formatList(actions.map((item) => describeAction(item, includeReferences))),
    "",
    "Open Questions",
    formatList(openQuestions.map((item) => describeQuestion(item, includeReferences))),
    "",
    "Signals",
    formatList([
      `Data quality score: ${source.signals?.quality_score ?? "n/a"}`,
      `Completion rate: ${asPercent(source.signals?.metrics?.completion_rate)}`,
      `Missing linked work rate: ${asPercent(source.signals?.metrics?.missing_linked_work_rate)}`,
      `Missing blockers rate: ${asPercent(source.signals?.metrics?.missing_blockers_rate)}`,
      `Vague update rate: ${asPercent(source.signals?.metrics?.vague_update_rate)}`,
    ]),
    "",
    "Full Summary",
    `Overall progress\n${overallProgress}`,
    `Achievements\n${formatList(achievements.map((item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`))}`,
    `Blockers and risks\n${formatList(blockers.map((item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`))}`,
    `Dependencies requiring PO involvement\n${formatList(dependencies.map((item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`))}`,
    `Assignment gaps\n${formatList(assignmentGaps.map((item) => `${normalizeWhitespace(item.text)}${maybeReferenceText(item.linked_work_ids, includeReferences)}`))}`,
  ]);
};
