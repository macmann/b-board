import { NextRequest, NextResponse } from "next/server";
import {
  Prisma,
  ResearchDecision as PrismaResearchDecision,
  ResearchPriority as PrismaResearchPriority,
} from "@prisma/client";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";
import { ResearchStatus } from "../../../../../lib/prismaEnums";
import { getNextResearchKey } from "../../../../../lib/researchKey";
import { getNextResearchPosition } from "../../../../../lib/researchPosition";

const RESEARCH_STATUS_SET = new Set(Object.values(ResearchStatus));
const RESEARCH_PRIORITY_SET = new Set(Object.values(PrismaResearchPriority));
const RESEARCH_DECISION_SET = new Set(Object.values(PrismaResearchDecision));

const researchBoardDisabledResponse = () =>
  NextResponse.json(
    {
      message:
        "Research board is disabled for this project. Project admins or owners can enable it in settings.",
    },
    { status: 403 }
  );

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, enableResearchBoard: true },
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    await ensureProjectRole(prisma, user.id, project.id, PROJECT_VIEWER_ROLES);

    if (!project.enableResearchBoard) {
      return researchBoardDisabledResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const statuses = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .filter((value) => RESEARCH_STATUS_SET.has(value as ResearchStatus)) as
      ResearchStatus[];

    const type = searchParams.get("type");
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10), 1);
    const pageSize = Math.max(
      Math.min(Number.parseInt(searchParams.get("pageSize") ?? "20", 10), 100),
      1
    );

    const where: Prisma.ResearchItemWhereInput = {
      projectId,
      ...(statuses.length
        ? { status: { in: statuses } }
        : { status: { not: ResearchStatus.ARCHIVED } }),
      ...(type ? { tags: { has: type } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(assigneeId
        ? {
            issueLinks: {
              some: {
                issue: { assigneeId },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.researchItem.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true } },
          issueLinks: {
            include: {
              issue: {
                select: {
                  assignee: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.researchItem.count({ where }),
    ]);

    const response = NextResponse.json(
      items.map((item) => ({
        id: item.id,
        key: item.key,
        title: item.title,
        status: item.status,
        researchType: item.tags[0] ?? null,
        assignee: item.assignee ??
          (item.issueLinks
            .map((link) => link.issue?.assignee)
            .find(Boolean) ?? null),
        dueDate: item.dueDate,
        linkedIssuesCount: item.issueLinks.length,
        updatedAt: item.updatedAt,
      })),
      {
        headers: {
          "X-Total-Count": total.toString(),
          "X-Page": page.toString(),
          "X-Page-Size": pageSize.toString(),
        },
      }
    );

    return response;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, enableResearchBoard: true },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  try {
    await ensureProjectRole(prisma, user.id, project.id, PROJECT_CONTRIBUTOR_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  if (!project.enableResearchBoard) {
    return researchBoardDisabledResponse();
  }

  const body = await request.json();
  const {
    title,
    description,
    status,
    priority,
    decision,
    tags,
    type,
    assigneeId,
    dueDate,
    attachmentIds,
  }: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    decision?: string;
    tags?: string[];
    type?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
    attachmentIds?: string[];
  } = body ?? {};

  if (!title) {
    return NextResponse.json({ message: "Title is required" }, { status: 400 });
  }

  const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (type) {
    normalizedTags.unshift(type);
  }

  const validStatus = RESEARCH_STATUS_SET.has(status as ResearchStatus)
    ? (status as ResearchStatus)
    : ResearchStatus.BACKLOG;

  const validPriority = RESEARCH_PRIORITY_SET.has(
    priority as PrismaResearchPriority
  )
    ? (priority as PrismaResearchPriority)
    : undefined;

  const validDecision = RESEARCH_DECISION_SET.has(
    decision as PrismaResearchDecision
  )
    ? (decision as PrismaResearchDecision)
    : undefined;

  const dueDateValue = dueDate ? new Date(dueDate) : null;
  if (dueDateValue && Number.isNaN(dueDateValue.getTime())) {
    return NextResponse.json({ message: "Invalid due date" }, { status: 400 });
  }

  if (assigneeId) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: assigneeId },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "Assignee must be a member of this project" },
        { status: 400 }
      );
    }
  }

  const data: Prisma.ResearchItemCreateInput = {
    project: { connect: { id: projectId } },
    key: await getNextResearchKey(prisma, projectId),
    title,
    description: description ?? null,
    status: validStatus,
    position: await getNextResearchPosition(projectId, validStatus),
    priority: validPriority ?? undefined,
    decision: validDecision ?? undefined,
    tags: normalizedTags,
    dueDate: dueDateValue,
    ...(assigneeId ? { assignee: { connect: { id: assigneeId } } } : {}),
  };

  const attachmentIdsToLink = Array.isArray(attachmentIds)
    ? attachmentIds.filter(Boolean)
    : [];

  const runCreate = async (client: typeof prisma) => {
    const created = await client.researchItem.create({ data });

    if (attachmentIdsToLink.length > 0) {
      await client.attachment.updateMany({
        where: { id: { in: attachmentIdsToLink }, projectId },
        data: { researchItemId: created.id },
      });
    }

    const full = await client.researchItem.findUnique({
      where: { id: created.id },
      include: { attachments: true },
    });

    const fallback =
      attachmentIdsToLink.length > 0 ? { ...created, attachments: [] } : created;

    return full ?? fallback;
  };

  const researchItem =
    typeof prisma.$transaction === "function"
      ? await prisma.$transaction((tx) => runCreate(tx as typeof prisma))
      : await runCreate(prisma);

  return NextResponse.json(researchItem, { status: 201 });
}
