import { Prisma } from "@prisma/client";

import { EpicStatus, IssueStatus, IssueType } from "../../../../../lib/prismaEnums";
import { parse } from "csv-parse/sync";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

function mapIssueType(value?: string | null): IssueType {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "story":
      return IssueType.STORY;
    case "bug":
      return IssueType.BUG;
    case "task":
    case "sub-task":
    case "subtask":
      return IssueType.TASK;
    default:
      return IssueType.TASK;
  }
}

function mapIssueStatus(value?: string | null): IssueStatus {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "todo":
    case "to do":
    case "backlog":
    case "open":
      return IssueStatus.TODO;
    case "in progress":
    case "inprogress":
    case "doing":
      return IssueStatus.IN_PROGRESS;
    case "in review":
    case "review":
    case "qa":
      return IssueStatus.IN_REVIEW;
    case "done":
    case "closed":
    case "resolved":
      return IssueStatus.DONE;
    default:
      return IssueStatus.TODO;
  }
}

function parseStoryPoints(value?: string | null): number | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = Number(trimmed);

  return Number.isNaN(parsed) ? null : parsed;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId")?.toString();

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { message: "CSV file is required under the 'file' field." },
      { status: 400 }
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { message: "Target projectId is required." },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return NextResponse.json(
      { message: "Project not found for the provided projectId." },
      { status: 404 }
    );
  }

  const projectInitial = (() => {
    const words = project.name.trim().split(" ");

    if (words.length === 1) return words[0][0].toUpperCase();

    return (words[0][0] + words[1][0]).toUpperCase();
  })();

  const startingIssueCount = await prisma.issue.count({ where: { projectId } });
  let nextIssueNumber = startingIssueCount + 1;

  const buffer = Buffer.from(await file.arrayBuffer());
  const csvContent = buffer.toString("utf-8");

  let records: Array<Record<string, string>> = [];

  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to parse CSV file." },
      { status: 400 }
    );
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const [index, row] of records.entries()) {
    const rowNumber = index + 2; // account for header row
    const summary = row["Summary"] ?? row["summary"];
    const description = row["Description"] ?? row["description"];
    const issueType = row["IssueType"] ?? row["Issue Type"] ?? row["issueType"];
    const status = row["Status"] ?? row["status"];
    const storyPoints = row["StoryPoints"] ?? row["Story Points"] ?? row["storyPoints"];
    const assigneeEmail = row["AssigneeEmail"] ?? row["Assignee"] ?? row["assigneeEmail"];
    const epicKey = row["EpicKey"] ?? row["Epic Key"] ?? row["epicKey"];
    const jiraIssueKey = row["IssueKey"] ?? row["Issue Key"] ?? row["issueKey"];
    const issueKey = jiraIssueKey ?? `${projectInitial}-${nextIssueNumber++}`;

    if (!summary) {
      errors.push(`Row ${rowNumber}: Summary is required.`);
      skippedCount += 1;
      continue;
    }

    try {
      let epicId: string | null = null;

      if (epicKey) {
        const existingEpic = await prisma.epic.findFirst({
          where: { projectId: project.id, jiraEpicKey: epicKey },
        });

        if (existingEpic) {
          epicId = existingEpic.id;
        } else {
          const createdEpic = await prisma.epic.create({
            data: {
              projectId: project.id,
              title: epicKey,
              description: null,
              status: EpicStatus.TODO,
              jiraEpicKey: epicKey,
            },
          });

          epicId = createdEpic.id;
        }
      }

      let assigneeId: string | null = null;

      if (assigneeEmail) {
        const assignee = await prisma.user.findUnique({
          where: { email: assigneeEmail },
        });

        if (assignee) {
          assigneeId = assignee.id;
        }
      }

      const issueData: Prisma.IssueUncheckedCreateInput = {
        projectId: project.id,
        key: issueKey,
        type: mapIssueType(issueType),
        title: summary,
        description: description || null,
        status: mapIssueStatus(status),
        storyPoints: parseStoryPoints(storyPoints),
        assigneeId,
        epicId,
        sprintId: null,
        jiraIssueKey: jiraIssueKey || null,
      };

      await prisma.issue.create({
        data: issueData,
      });

      importedCount += 1;
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${(error as Error).message}`);
      skippedCount += 1;
    }
  }

  return NextResponse.json({ importedCount, skippedCount, errors });
}
