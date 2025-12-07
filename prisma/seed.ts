import {
  IssuePriority,
  IssueStatus,
  IssueType,
  ProjectMemberRole,
  UserRole,
  WorkspaceMemberRole,
} from "@prisma/client";

import prisma from "../src/lib/db";

// Ensure JWT_SECRET is available for the hashPassword helper.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "seed-secret";
}

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123!";
const ADMIN_NAME = "System Admin";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const DEMO_PROJECT_KEY = "DEMO";

async function main() {
  const { hashPassword } = await import("../src/lib/auth");

  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  let workspace = await prisma.workspace.findFirst({
    where: { name: DEFAULT_WORKSPACE_NAME },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: DEFAULT_WORKSPACE_NAME },
    });
  }

  let admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: admin.id },
    },
    update: { role: WorkspaceMemberRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceMemberRole.OWNER,
    },
  });

  let project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, key: DEMO_PROJECT_KEY },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        key: DEMO_PROJECT_KEY,
        name: "Demo Project",
        description: "Sample project for Mini Jira",
      },
    });
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: ProjectMemberRole.ADMIN },
    create: {
      projectId: project.id,
      userId: admin.id,
      role: ProjectMemberRole.ADMIN,
    },
  });

  const issueCount = await prisma.issue.count({
    where: { projectId: project.id },
  });

  if (issueCount === 0) {
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
          title: "Create first sprint backlog",
          description: "Gather initial tasks and user stories.",
          status: IssueStatus.TODO,
          priority: IssuePriority.HIGH,
          reporterId: admin.id,
        },
        {
          projectId: project.id,
          type: IssueType.BUG,
          title: "Fix sample login issue",
          description: "Placeholder bug for demo purposes.",
          status: IssueStatus.TODO,
          priority: IssuePriority.LOW,
          reporterId: admin.id,
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log("Seed completed:");
  console.log(`- Workspace: ${workspace.name}`);
  console.log(`- Admin user: ${admin.email}`);
  console.log(`- Project: ${project.key} - ${project.name}`);
  console.log("- Demo backlog created (skipped if issues already existed).");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
