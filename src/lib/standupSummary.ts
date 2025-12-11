import type {
  DailyStandupEntry,
  Issue,
  ResearchItem,
  User,
} from "@prisma/client";
import { StandupSummary } from "@prisma/client";

import openai from "@/lib/openai";
import prisma from "./db";
import { sendEmail } from "./email";
import { PROJECT_ADMIN_ROLES } from "./roles";
import { parseDateOnly } from "./standupWindow";

type StandupSummaryResult = { summary: string };
type StandupEntryWithUser = DailyStandupEntry & {
  user: User;
  issues: { issue: Issue }[];
  research: { researchItem: ResearchItem }[];
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const buildPrompt = (
  projectName: string,
  date: Date,
  entries: StandupEntryWithUser[]
) => {
  const promptEntries = entries.map((entry) => ({
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

  return `You are summarizing engineering stand-up updates.

Summarize:
• Overall project progress
• Key achievements
• Blockers and risks
• Dependencies requiring PO involvement
• Task owners and assignment gaps (e.g., “These developers have no assigned tasks…”)

Project: ${projectName}
Date: ${formatDateOnly(date)}
Entries:
${JSON.stringify(promptEntries, null, 2)}`;
};

export const generateProjectStandupSummary = async (
  projectId: string,
  date: Date,
  entriesOverride?: StandupEntryWithUser[]
): Promise<StandupSummaryResult> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary generation");
  }

  const [project, standupEntries] = await Promise.all([
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
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (!standupEntries.length) {
    return {
      summary: `No stand-up entries were submitted for ${project.name} on ${formatDateOnly(targetDate)}.`,
    };
  }

  const prompt = buildPrompt(project.name, targetDate, standupEntries);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You summarize daily stand-ups into brief updates for product stakeholders.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content?.trim();

  let summary = "";

  if (content) {
    summary = content;
  }

  if (!summary) {
    summary = `Stand-up summary for ${project.name} on ${formatDateOnly(targetDate)} is unavailable.`;
  }

  return { summary };
};

export const saveProjectStandupSummary = async (
  projectId: string,
  date: Date,
  entriesOverride?: StandupEntryWithUser[]
): Promise<StandupSummary> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary persistence");
  }

  const { summary } = await generateProjectStandupSummary(
    projectId,
    targetDate,
    entriesOverride
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
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.standupSummary.findUnique({
      where: { projectId_date: { projectId, date: targetDate } },
    }),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const standupSummary =
    summaryRecord ?? (await saveProjectStandupSummary(projectId, targetDate));

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

  const emailPromises = stakeholders
    .map(({ user }) => user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user?.email))
    .map((user) => sendEmail(user.email, subject, html));

  await Promise.all(emailPromises);
};

export default saveProjectStandupSummary;
