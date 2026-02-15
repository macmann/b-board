import crypto from "node:crypto";

import type {
  DailyStandupEntry,
  Issue,
  Prisma,
  ResearchItem,
  User,
} from "@prisma/client";
import { StandupSummary } from "@prisma/client";
import { z } from "zod";

import { getOpenAIClient } from "./openai";
import prisma from "./db";
import { sendEmail } from "./email";
import { PROJECT_ADMIN_ROLES } from "./roles";
import { parseDateOnly } from "./standupWindow";

const STANDUP_SUMMARY_MODEL = "gpt-4o-mini";
const STANDUP_SUMMARY_PROMPT_VERSION = "standup-summary-v1";

type StandupEntryWithUser = DailyStandupEntry & {
  user: User;
  issues: { issue: Issue }[];
  research: { researchItem: ResearchItem }[];
};

const standupSummaryBulletSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source_entry_ids: z.array(z.string()).default([]),
  linked_work_ids: z.array(z.string()).default([]),
});

const standupSummarySchemaV1 = z.object({
  summary_id: z.string().min(1),
  project_id: z.string().min(1),
  date: z.string().min(1),
  overall_progress: z.string().min(1),
  achievements: z.array(standupSummaryBulletSchema),
  blockers: z.array(standupSummaryBulletSchema),
  dependencies: z.array(standupSummaryBulletSchema),
  assignment_gaps: z.array(standupSummaryBulletSchema),
});

export type StandupSummaryBulletV1 = z.infer<typeof standupSummaryBulletSchema>;
export type StandupSummaryV1 = z.infer<typeof standupSummarySchemaV1>;

export type StandupSummaryRendered = {
  overall_progress: string;
  achievements: string[];
  blockers: string[];
  dependencies: string[];
  assignment_gaps: string[];
};

type StandupSummarySectionKey =
  | "achievements"
  | "blockers"
  | "dependencies"
  | "assignment_gaps";

const normalizeArrayValues = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();

const createStableBulletId = (
  summaryId: string,
  section: StandupSummarySectionKey,
  bullet: Omit<StandupSummaryBulletV1, "id">
) => {
  const stablePayload = JSON.stringify({
    summaryId,
    section,
    text: bullet.text.trim(),
    source_entry_ids: normalizeArrayValues(bullet.source_entry_ids),
    linked_work_ids: normalizeArrayValues(bullet.linked_work_ids),
  });

  const digest = crypto
    .createHash("sha256")
    .update(stablePayload)
    .digest("hex")
    .slice(0, 12);

  return `${section}_${digest}`;
};

export const normalizeSummaryBulletIds = (
  summary: StandupSummaryV1
): StandupSummaryV1 => {
  const normalizeSection = (section: StandupSummarySectionKey) =>
    summary[section].map((bullet) => {
      const normalizedBullet = {
        text: bullet.text.trim(),
        source_entry_ids: normalizeArrayValues(bullet.source_entry_ids),
        linked_work_ids: normalizeArrayValues(bullet.linked_work_ids),
      };

      return {
        id: createStableBulletId(summary.summary_id, section, normalizedBullet),
        ...normalizedBullet,
      };
    });

  return {
    ...summary,
    achievements: normalizeSection("achievements"),
    blockers: normalizeSection("blockers"),
    dependencies: normalizeSection("dependencies"),
    assignment_gaps: normalizeSection("assignment_gaps"),
  };
};

type StandupSummaryResult = {
  summary: string;
  summaryId: string;
  version: number;
  summaryJson: StandupSummaryV1;
  summaryRendered: StandupSummaryRendered;
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const createSummaryId = (projectId: string, date: Date) =>
  `${projectId}:${formatDateOnly(date)}`;

const buildPromptEntries = (entries: StandupEntryWithUser[]) =>
  entries.map((entry) => ({
    entryId: entry.id,
    member: entry.user?.name || entry.user?.email || entry.userId,
    progressSinceYesterday: entry.progressSinceYesterday ?? "",
    today: entry.summaryToday ?? "",
    blockers: entry.blockers ?? "",
    dependencies: entry.dependencies ?? "",
    notes: entry.notes ?? "",
    isComplete: entry.isComplete,
    issues: entry.issues.map(({ issue }) => ({
      id: issue.id,
      key: issue.key,
      title: issue.title,
      assigneeId: issue.assigneeId,
      status: issue.status,
    })),
    research: entry.research.map(({ researchItem }) => ({
      id: researchItem.id,
      key: researchItem.key,
      title: researchItem.title,
      assigneeId: researchItem.assigneeId,
      status: researchItem.status,
    })),
  }));

const buildStructuredPrompt = (
  projectName: string,
  projectId: string,
  date: Date,
  entries: StandupEntryWithUser[]
) => {
  const summaryId = createSummaryId(projectId, date);

  return `You are summarizing engineering stand-up updates for stakeholders.

Return ONLY valid JSON that matches this exact schema:
{
  "summary_id": "${summaryId}",
  "project_id": "${projectId}",
  "date": "${formatDateOnly(date)}",
  "overall_progress": "string",
  "achievements": [{ "id": "string", "text": "string", "source_entry_ids": ["string"], "linked_work_ids": ["string"] }],
  "blockers": [{ "id": "string", "text": "string", "source_entry_ids": ["string"], "linked_work_ids": ["string"] }],
  "dependencies": [{ "id": "string", "text": "string", "source_entry_ids": ["string"], "linked_work_ids": ["string"] }],
  "assignment_gaps": [{ "id": "string", "text": "string", "source_entry_ids": ["string"], "linked_work_ids": ["string"] }]
}

Rules:
- Output only valid JSON and no markdown.
- Keep all arrays as arrays even if empty.
- Keep bullet ids stable and concise.

Project: ${projectName}
Date: ${formatDateOnly(date)}
Entries:
${JSON.stringify(buildPromptEntries(entries), null, 2)}`;
};

const renderSummarySections = (summaryJson: StandupSummaryV1): StandupSummaryRendered => ({
  overall_progress: summaryJson.overall_progress,
  achievements: summaryJson.achievements.map((item) => item.text),
  blockers: summaryJson.blockers.map((item) => item.text),
  dependencies: summaryJson.dependencies.map((item) => item.text),
  assignment_gaps: summaryJson.assignment_gaps.map((item) => item.text),
});

const renderSummaryMarkdown = (rendered: StandupSummaryRendered) => {
  const toMarkdownList = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- None reported";

  return [
    `**Overall progress**\n${rendered.overall_progress}`,
    `**Achievements**\n${toMarkdownList(rendered.achievements)}`,
    `**Blockers and risks**\n${toMarkdownList(rendered.blockers)}`,
    `**Dependencies requiring PO involvement**\n${toMarkdownList(rendered.dependencies)}`,
    `**Assignment gaps**\n${toMarkdownList(rendered.assignment_gaps)}`,
  ].join("\n\n");
};

const buildLegacyFallbackSummaryJson = (
  projectId: string,
  date: Date,
  entries: StandupEntryWithUser[]
): StandupSummaryV1 => {
  const hasBlockers = entries.some((entry) => entry.blockers?.trim());
  const hasDependencies = entries.some((entry) => entry.dependencies?.trim());

  return normalizeSummaryBulletIds({
    summary_id: createSummaryId(projectId, date),
    project_id: projectId,
    date: formatDateOnly(date),
    overall_progress: `Captured ${entries.length} stand-up update${entries.length === 1 ? "" : "s"} for ${formatDateOnly(date)}.`,
    achievements: entries
      .filter((entry) => entry.summaryToday?.trim())
      .slice(0, 5)
      .map((entry) => ({
        id: `achievement-${entry.id}`,
        text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.summaryToday?.trim()}`,
        source_entry_ids: [entry.id],
        linked_work_ids: [
          ...entry.issues.map(({ issue }) => issue.id),
          ...entry.research.map(({ researchItem }) => researchItem.id),
        ],
      })),
    blockers: hasBlockers
      ? entries
          .filter((entry) => entry.blockers?.trim())
          .map((entry) => ({
            id: `blocker-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.blockers?.trim()}`,
            source_entry_ids: [entry.id],
            linked_work_ids: [
              ...entry.issues.map(({ issue }) => issue.id),
              ...entry.research.map(({ researchItem }) => researchItem.id),
            ],
          }))
      : [],
    dependencies: hasDependencies
      ? entries
          .filter((entry) => entry.dependencies?.trim())
          .map((entry) => ({
            id: `dependency-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.dependencies?.trim()}`,
            source_entry_ids: [entry.id],
            linked_work_ids: [
              ...entry.issues.map(({ issue }) => issue.id),
              ...entry.research.map(({ researchItem }) => researchItem.id),
            ],
          }))
      : [],
    assignment_gaps: entries
      .filter((entry) => entry.issues.length + entry.research.length === 0)
      .map((entry) => ({
        id: `gap-${entry.id}`,
        text: `${entry.user.name || entry.user.email || entry.userId} has no linked issues or research items.`,
        source_entry_ids: [entry.id],
        linked_work_ids: [],
      })),
  });
};

const parseStructuredSummaryJson = (
  raw: string,
  projectId: string,
  date: Date
): StandupSummaryV1 => {
  const parsed = JSON.parse(raw) as unknown;
  const result = standupSummarySchemaV1.parse(parsed);

  return normalizeSummaryBulletIds({
    ...result,
    project_id: projectId,
    date: formatDateOnly(date),
    summary_id: createSummaryId(projectId, date),
  });
};

const requestSummaryJson = async (prompt: string, fixAttempt = false) => {
  const completion = await getOpenAIClient().chat.completions.create({
    model: STANDUP_SUMMARY_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You summarize daily stand-ups into structured JSON for product stakeholders.",
      },
      {
        role: "user",
        content: fixAttempt ? `${prompt}\n\nFix to valid JSON.` : prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
};

const generateSummaryJson = async (
  projectId: string,
  projectName: string,
  date: Date,
  entries: StandupEntryWithUser[]
) => {
  const prompt = buildStructuredPrompt(projectName, projectId, date, entries);

  try {
    const firstOutput = await requestSummaryJson(prompt, false);
    return parseStructuredSummaryJson(firstOutput, projectId, date);
  } catch {
    const retryOutput = await requestSummaryJson(prompt, true);
    return parseStructuredSummaryJson(retryOutput, projectId, date);
  }
};

export const generateProjectStandupSummary = async (
  projectId: string,
  date: Date,
  entriesOverride?: StandupEntryWithUser[],
  createdBy = "system"
): Promise<StandupSummaryResult> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary generation");
  }

  const [project, standupEntries, latestVersion] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    entriesOverride
      ? Promise.resolve(entriesOverride)
      : prisma.dailyStandupEntry.findMany({
          where: { projectId, date: targetDate },
          include: {
            user: true,
            issues: { include: { issue: true } },
            research: { include: { researchItem: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
    prisma.aISummaryVersion.findFirst({
      where: { summaryId: createSummaryId(projectId, targetDate) },
      orderBy: { version: "desc" },
    }),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const summaryId = createSummaryId(projectId, targetDate);
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  let summaryJson: StandupSummaryV1;
  let modelName = STANDUP_SUMMARY_MODEL;

  if (!standupEntries.length) {
    summaryJson = {
      summary_id: summaryId,
      project_id: projectId,
      date: formatDateOnly(targetDate),
      overall_progress: `No stand-up entries were submitted for ${project.name} on ${formatDateOnly(targetDate)}.`,
      achievements: [],
      blockers: [],
      dependencies: [],
      assignment_gaps: [],
    };
    modelName = "fallback:no-entries";
  } else {
    try {
      summaryJson = await generateSummaryJson(projectId, project.name, targetDate, standupEntries);
    } catch {
      if (latestVersion?.outputJson) {
        summaryJson = standupSummarySchemaV1.parse(latestVersion.outputJson);
        modelName = "fallback:last-good-version";
      } else {
        summaryJson = buildLegacyFallbackSummaryJson(projectId, targetDate, standupEntries);
        modelName = "fallback:legacy-render";
      }
    }
  }

  const rendered = renderSummarySections(summaryJson);
  const summaryText = renderSummaryMarkdown(rendered);

  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(buildPromptEntries(standupEntries)))
    .digest("hex");

  await prisma.aISummaryVersion.create({
    data: {
      projectId,
      summaryId,
      date: targetDate,
      version: nextVersion,
      model: modelName,
      promptVersion: STANDUP_SUMMARY_PROMPT_VERSION,
      inputHash,
      outputJson: summaryJson as Prisma.InputJsonValue,
      createdBy: createdBy || "system",
    },
  });

  return {
    summary: summaryText,
    summaryId,
    version: nextVersion,
    summaryJson,
    summaryRendered: rendered,
  };
};

export const saveProjectStandupSummary = async (
  projectId: string,
  date: Date,
  entriesOverride?: StandupEntryWithUser[],
  createdBy = "system"
): Promise<StandupSummary> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary persistence");
  }

  const { summary } = await generateProjectStandupSummary(
    projectId,
    targetDate,
    entriesOverride,
    createdBy
  );

  return prisma.standupSummary.upsert({
    where: { projectId_date: { projectId, date: targetDate } },
    update: { summary },
    create: { projectId, date: targetDate, summary },
  });
};

export const emailStandupSummaryToStakeholders = async (
  projectId: string,
  date: Date
) => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary notification");
  }

  const [project, summaryRecord] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { settings: true } }),
    prisma.standupSummary.findUnique({
      where: { projectId_date: { projectId, date: targetDate } },
    }),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const standupSummary =
    summaryRecord ?? (await saveProjectStandupSummary(projectId, targetDate));

  if (!project.settings?.emailProvider) {
    throw new Error("Configure an email provider before sending stand-up summaries.");
  }

  const stakeholders = await prisma.projectMember.findMany({
    where: { projectId, role: { in: PROJECT_ADMIN_ROLES } },
    include: { user: true },
  });

  const subject = `[B Board] Daily Stand-up Summary - ${project.name} - ${formatDateOnly(targetDate)}`;

  const html = `
    <p>Hello,</p>
    <p>Here is the daily stand-up summary for <strong>${project.name}</strong> on <strong>${formatDateOnly(
    targetDate
  )}</strong>.</p>
    <h3>Summary</h3>
    <p>${standupSummary.summary}</p>
  `;

  const emailSettings = {
    providerType: project.settings.emailProvider,
    fromName: project.settings.emailFromName,
    fromEmail: project.settings.emailFromAddress,
    smtpHost: project.settings.smtpHost,
    smtpPort: project.settings.smtpPort,
    smtpUsername: project.settings.smtpUsername,
    smtpPassword: project.settings.smtpPassword,
    apiUrl: project.settings.apiUrl,
    apiKey: project.settings.apiKey,
  };

  const emailPromises = stakeholders
    .map(({ user }) => user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user?.email))
    .map((user) =>
      sendEmail(emailSettings, {
        to: user.email!,
        subject,
        text: standupSummary.summary,
        html,
      })
    );

  await Promise.all(emailPromises);
};

export default saveProjectStandupSummary;
