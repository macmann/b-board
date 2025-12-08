import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const IssuePriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

const IssueStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
};

const IssueType = {
  STORY: "STORY",
  BUG: "BUG",
  TASK: "TASK",
};

const Role = {
  ADMIN: "ADMIN",
  PO: "PO",
  DEV: "DEV",
  QA: "QA",
  VIEWER: "VIEWER",
};

const UserRole = Role;
const ProjectMemberRole = Role;

const WorkspaceMemberRole = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
};

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@bboard.com";
const ADMIN_PASSWORD = "AdminPass123!";
const ADMIN_NAME = "Admin";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const DEMO_PROJECT_KEY = "DEMO";
const DEMO_PROJECT_NAME = "DEMO";

async function main() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "seed-secret";
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log("Seed skipped: admin user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const workspace = await prisma.workspace.create({
    data: { name: DEFAULT_WORKSPACE_NAME },
  });

  const admin = await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
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
      key: DEMO_PROJECT_KEY,
      name: DEMO_PROJECT_NAME,
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

  console.log("Seed completed:");
  console.log(`- Workspace: ${workspace.name}`);
  console.log(`- Admin user: ${admin.email}`);
  console.log(`- Project: ${project.key} - ${project.name}`);
  console.log("- Demo backlog created.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
