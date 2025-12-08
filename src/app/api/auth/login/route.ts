import { NextResponse } from "next/server";

import { comparePassword, hashPassword, signAuthToken } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  ProjectMemberRole,
  UserRole,
  WorkspaceMemberRole,
} from "../../../../lib/prismaEnums";

const DEFAULT_ADMIN_EMAIL = "admin@bboard.com";
const DEFAULT_ADMIN_PASSWORD = "AdminPass123!";
const DEFAULT_ADMIN_NAME = "Admin";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const DEFAULT_PROJECT_KEY = "DEMO";
const DEFAULT_PROJECT_NAME = "DEMO";

const provisionDefaultAdmin = async () => {
  const userCount = await prisma.user.count();

  if (userCount > 0) return;

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const workspace = await prisma.workspace.create({
    data: { name: DEFAULT_WORKSPACE_NAME },
  });

  const admin = await prisma.user.create({
    data: {
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceMemberRole.OWNER,
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      key: DEFAULT_PROJECT_KEY,
      name: DEFAULT_PROJECT_NAME,
      description: "Sample project for Mini Jira",
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: admin.id,
      role: ProjectMemberRole.ADMIN,
    },
  });

  await prisma.issue.createMany({
    data: [
      {
        projectId: project.id,
        type: IssueType.STORY,
        title: "Set up project",
        description: "Initialize repository and project settings.",
        status: IssueStatus.TODO,
        priority: IssuePriority.MEDIUM,
        reporterId: admin.id,
      },
      {
        projectId: project.id,
        type: IssueType.TASK,
        title: "Create initial backlog",
        description: "Add starter tasks for the demo project.",
        status: IssueStatus.TODO,
        priority: IssuePriority.HIGH,
        reporterId: admin.id,
      },
    ],
  });
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    await provisionDefaultAdmin();

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const token = signAuthToken({ userId: user.id });

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ message: "Unable to process login." }, { status: 500 });
  }
}
