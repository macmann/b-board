import { NextRequest, NextResponse } from "next/server";
import {
  Prisma,
  ResearchDecision as PrismaResearchDecision,
  ResearchPriority as PrismaResearchPriority,
} from "@prisma/client";

import { getUserFromRequest } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../lib/permissions";
import { ResearchStatus } from "../../../../lib/prismaEnums";

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

async function getResearchItemWithProject(researchItemId: string) {
  return prisma.researchItem.findUnique({
    where: { id: researchItemId },
    include: {
      project: { select: { id: true, enableResearchBoard: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

async function ensureResearchAccess(
  researchItemId: string,
  userId: string,
  roles: typeof PROJECT_VIEWER_ROLES | typeof PROJECT_CONTRIBUTOR_ROLES
) {
  const researchItem = await getResearchItemWithProject(researchItemId);

  if (!researchItem) {
    return { researchItem: null, projectId: null, enabled: false } as const;
  }

  await ensureProjectRole(prisma, userId, researchItem.projectId, roles);

  return {
    researchItem,
    projectId: researchItem.projectId,
    enabled: researchItem.project.enableResearchBoard,
  } as const;
}

type ResearchItemParams =
  | { researchItemId?: string }
  | Promise<{ researchItemId?: string }>;

function getResearchItemId(params: ResearchItemParams) {
  return Promise.resolve(params).then((resolved) => resolved?.researchItemId);
}

export async function GET(
  request: NextRequest,
  context: { params: ResearchItemParams }
) {
  const researchItemId = await getResearchItemId(context.params);

  if (!researchItemId) {
    return NextResponse.json({ message: "Missing researchItemId" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureResearchAccess(
      researchItemId,
      user.id,
      PROJECT_VIEWER_ROLES
    );

    if (!result.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!result.enabled) {
      return researchBoardDisabledResponse();
    }

    return NextResponse.json({
      id: result.researchItem.id,
      projectId: result.researchItem.projectId,
      key: result.researchItem.key,
      title: result.researchItem.title,
      description: result.researchItem.description,
      assigneeId: result.researchItem.assigneeId,
      assignee: result.researchItem.assignee
        ? { id: result.researchItem.assignee.id, name: result.researchItem.assignee.name }
        : null,
      dueDate: result.researchItem.dueDate,
      status: result.researchItem.status,
      priority: result.researchItem.priority,
      decision: result.researchItem.decision,
      tags: result.researchItem.tags,
      createdAt: result.researchItem.createdAt,
      updatedAt: result.researchItem.updatedAt,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: ResearchItemParams }
) {
  const researchItemId = await getResearchItemId(context.params);

  if (!researchItemId) {
    return NextResponse.json({ message: "Missing researchItemId" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureResearchAccess(
      researchItemId,
      user.id,
      PROJECT_CONTRIBUTOR_ROLES
    );

    if (!result.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!result.enabled) {
      return researchBoardDisabledResponse();
    }

    const body = await request.json();
    const { title, description, status, priority, decision, tags, assigneeId, dueDate } =
      (body ?? {}) as {
        title?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        decision?: string;
        tags?: string[];
        assigneeId?: string | null;
        dueDate?: string | null;
        archive?: boolean;
      };

    const data: Prisma.ResearchItemUpdateInput = {};

    if (typeof title !== "undefined") data.title = title;
    if (typeof description !== "undefined") data.description = description;
    if (typeof assigneeId !== "undefined") {
      if (assigneeId) {
        const membership = await prisma.projectMember.findFirst({
          where: { projectId: result.projectId, userId: assigneeId },
          select: { id: true },
        });

        if (!membership) {
          return NextResponse.json(
            { message: "Assignee must be a member of this project" },
            { status: 400 }
          );
        }
      }

      data.assignee = assigneeId
        ? { connect: { id: assigneeId } }
        : { disconnect: true };
    }
    if (typeof priority !== "undefined") {
      if (!RESEARCH_PRIORITY_SET.has(priority as PrismaResearchPriority)) {
        return NextResponse.json({ message: "Invalid priority" }, { status: 400 });
      }

      data.priority = priority as PrismaResearchPriority;
    }

    if (typeof decision !== "undefined") {
      if (!RESEARCH_DECISION_SET.has(decision as PrismaResearchDecision)) {
        return NextResponse.json({ message: "Invalid decision" }, { status: 400 });
      }

      data.decision = decision as PrismaResearchDecision;
    }
    if (Array.isArray(tags)) data.tags = tags.filter(Boolean);

    if (typeof dueDate !== "undefined") {
      const dueDateValue = dueDate ? new Date(dueDate) : null;
      if (dueDateValue && Number.isNaN(dueDateValue.getTime())) {
        return NextResponse.json({ message: "Invalid due date" }, { status: 400 });
      }

      data.dueDate = dueDateValue;
    }

    if (typeof status !== "undefined") {
      if (!RESEARCH_STATUS_SET.has(status as ResearchStatus)) {
        return NextResponse.json({ message: "Invalid status" }, { status: 400 });
      }

      data.status = status as ResearchStatus;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await prisma.researchItem.update({
      where: { id: researchItemId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: ResearchItemParams }
) {
  const researchItemId = await getResearchItemId(context.params);

  if (!researchItemId) {
    return NextResponse.json({ message: "Missing researchItemId" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureResearchAccess(
      researchItemId,
      user.id,
      PROJECT_CONTRIBUTOR_ROLES
    );

    if (!result.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!result.enabled) {
      return researchBoardDisabledResponse();
    }

    await prisma.researchItem.update({
      where: { id: researchItemId },
      data: { status: ResearchStatus.ARCHIVED },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
