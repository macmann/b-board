import {
  IssuePriority,
  IssueStatus,
  IssueType,
  Role,
} from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";

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
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    await ensureProjectRole(prisma, user.id, project.id, PROJECT_VIEWER_ROLES);

    const searchParams = request.nextUrl.searchParams;
    const parseListParam = (param: string | null) =>
      param?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];

    const statusFilter = parseListParam(searchParams.get("status")).filter(
      (value): value is IssueStatus =>
        Object.values(IssueStatus).includes(value as IssueStatus)
    );
    const typeFilter = parseListParam(searchParams.get("type")).filter(
      (value): value is IssueType =>
        Object.values(IssueType).includes(value as IssueType)
    );
    const priorityFilter = parseListParam(searchParams.get("priority")).filter(
      (value): value is IssuePriority =>
        Object.values(IssuePriority).includes(value as IssuePriority)
    );
    const assigneeFilter = parseListParam(
      searchParams.get("assignee") ?? searchParams.get("assigneeId")
    );
    const epicFilter = parseListParam(
      searchParams.get("epic") ?? searchParams.get("epicId")
    );
    const searchQuery = searchParams.get("q")?.trim();

    const andFilters = [
      { projectId },
      ...(statusFilter.length > 0 ? [{ status: { in: statusFilter } }] : []),
      ...(typeFilter.length > 0 ? [{ type: { in: typeFilter } }] : []),
      ...(priorityFilter.length > 0
        ? [{ priority: { in: priorityFilter } }]
        : []),
      ...(epicFilter.length > 0 ? [{ epicId: { in: epicFilter } }] : []),
    ];

    const assigneeConditions = [] as Array<{ assigneeId: string | null } | { assigneeId: { in: string[] } }>;

    if (assigneeFilter.includes("unassigned")) {
      assigneeConditions.push({ assigneeId: null });
    }

    const assigneeIds = assigneeFilter.filter((value) => value !== "unassigned");

    if (assigneeIds.length > 0) {
      assigneeConditions.push({ assigneeId: { in: assigneeIds } });
    }

    if (assigneeConditions.length > 0) {
      andFilters.push({ OR: assigneeConditions });
    }

    if (searchQuery) {
      andFilters.push({
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { key: { contains: searchQuery, mode: "insensitive" } },
        ],
      });
    }

    const issues = await prisma.issue.findMany({
      where: { AND: andFilters },
      include: {
        sprint: true,
        epic: true,
        assignee: true,
      },
      orderBy: [
        { position: "asc" },
        { createdAt: "asc" },
      ],
    });

    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    const sprintGroups = sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      type: "sprint" as const,
      status: sprint.status,
      issues: issues.filter((issue) => issue.sprintId === sprint.id),
    }));

    const backlogGroup = {
      id: "backlog",
      name: "Product Backlog",
      type: "backlog" as const,
      issues: issues.filter((issue) => issue.sprintId === null),
    };

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    const epics = await prisma.epic.findMany({
      where: { projectId },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    const canEdit = members.some(
      (member) => member.role === Role.ADMIN || member.role === Role.PO
    );

    return NextResponse.json({
      groups: [...sprintGroups, backlogGroup],
      members: members
        .map((member) => member.user)
        .filter(Boolean)
        .map((user) => ({ id: user!.id, name: user!.name ?? "Unknown" })),
      epics,
      canEdit,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
