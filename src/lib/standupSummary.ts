import type { DailyStandupEntry, User } from "@prisma/client";
import { StandupSummary } from "@prisma/client";

import openai from "@/lib/openai";
import prisma from "./db";
import { sendEmail } from "./email";
import { PROJECT_ADMIN_ROLES } from "./roles";
import { parseDateOnly } from "./standupWindow";

type StandupSummaryResult = { summary: string; highlights: string | null };
type StandupEntryWithUser = DailyStandupEntry & { user: User };

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const buildPrompt = (
  projectName: string,
  date: Date,
  entries: StandupEntryWithUser[]
) => {
  const lines = [
    `Project: ${projectName}`,
    `Date: ${formatDateOnly(date)}`,
    "Stand-up entries:",
  ];

  for (const entry of entries) {
    const memberName = entry.user?.name ?? entry.user?.email ?? "Unknown";
    lines.push(
      [
        `Member: ${memberName}`,
        `Progress since yesterday: ${entry.progressSinceYesterday || "(not provided)"}`,
        `Today's plan: ${entry.summaryToday || "(not provided)"}`,
        `Blockers or dependencies: ${entry.blockers || entry.dependencies || "(none reported)"}`,
      ].join("\n")
    );
  }

  lines.push(
    [
      "You are an agile assistant generating a short digest for Product Owners and Admins.",
      "Provide a concise summary of overall progress.",
      "Explicitly list blockers, risks, and items that need PO/Admin attention as concise highlights.",
      'Respond in JSON with keys "summary" (string) and "highlights" (string or null).',
    ].join("\n")
  );

  return lines.join("\n\n");
};

export const generateProjectStandupSummary = async (
  projectId: string,
  date: Date
): Promise<StandupSummaryResult> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary generation");
  }

  const [project, standupEntries] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.dailyStandupEntry.findMany({
      where: { projectId, date: targetDate },
      include: { user: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (!standupEntries.length) {
    return {
      summary: `No stand-up entries were submitted for ${project.name} on ${formatDateOnly(targetDate)}.`,
      highlights: null,
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
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content?.trim();

  let summary = "";
  let highlights: string | null = null;

  if (content) {
    try {
      const parsed = JSON.parse(content) as StandupSummaryResult;
      summary = parsed.summary;
      highlights = parsed.highlights;
    } catch {
      summary = content;
    }
  }

  if (!summary) {
    summary = `Stand-up summary for ${project.name} on ${formatDateOnly(targetDate)} is unavailable.`;
  }

  return { summary, highlights };
};

export const saveProjectStandupSummary = async (
  projectId: string,
  date: Date
): Promise<StandupSummary> => {
  const targetDate = parseDateOnly(date);

  if (!targetDate) {
    throw new Error("Invalid date provided for stand-up summary persistence");
  }

  const { summary, highlights } = await generateProjectStandupSummary(projectId, targetDate);

  return prisma.standupSummary.upsert({
    where: { projectId_date: { projectId, date: targetDate } },
    update: { summary, highlights },
    create: { projectId, date: targetDate, summary, highlights },
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

  const standupSummary = summaryRecord ?? (await saveProjectStandupSummary(projectId, targetDate));

  const stakeholders = await prisma.projectMember.findMany({
    where: { projectId, role: { in: PROJECT_ADMIN_ROLES } },
    include: { user: true },
  });

  const subject = `[B Board] Daily Stand-up Summary - ${project.name} - ${formatDateOnly(targetDate)}`;

  const highlightSection =
    standupSummary.highlights && standupSummary.highlights.trim()
      ? `<h3>Highlights, blockers & risks</h3><p>${standupSummary.highlights}</p>`
      : "<p>No explicit blockers or risks were highlighted.</p>";

  const html = `
    <p>Hello,</p>
    <p>Here is the daily stand-up summary for <strong>${project.name}</strong> on <strong>${formatDateOnly(
    targetDate
  )}</strong>.</p>
    <h3>Summary</h3>
    <p>${standupSummary.summary}</p>
    ${highlightSection}
  `;

  const emailPromises = stakeholders
    .map(({ user }) => user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user?.email))
    .map((user) => sendEmail(user.email, subject, html));

  await Promise.all(emailPromises);
};

export default saveProjectStandupSummary;
