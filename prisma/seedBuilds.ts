// Optional demo seeding for build/release flows. Run manually; not executed automatically in production.
import prisma from "../src/lib/db";
import {
  BuildEnvironment,
  BuildStatus,
  IssuePriority,
  IssueStatus,
  IssueType,
  ProjectMemberRole,
  UserRole,
  WorkspaceMemberRole,
} from "../src/lib/prismaEnums";

const ADMIN_EMAIL = "admin@bboard.com";
const ADMIN_NAME = "Admin";
const ADMIN_PASSWORD = "AdminPass123!";
const WORKSPACE_NAME = "Build Demo Workspace";
const PROJECT_KEY = "BUILD";
const PROJECT_NAME = "Build Demo";
const DEPLOYED_BUILD_KEY = "v1.0.0";
const PLANNED_BUILD_KEY = "v1.1.0";

async function ensureAdminUser() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "seed-secret";
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    return existingAdmin;
  }

  const { hashPassword } = await import("../src/lib/auth");
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  return prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

async function ensureWorkspace(adminId: string) {
  const existingWorkspace = await prisma.workspace.findFirst({
    where: { name: WORKSPACE_NAME },
  });

  if (existingWorkspace) {
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existingWorkspace.id, userId: adminId },
    });

    if (!existingMembership) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: existingWorkspace.id,
          userId: adminId,
          role: WorkspaceMemberRole.OWNER,
        },
      });
    }

    return existingWorkspace;
  }

  return prisma.workspace.create({
    data: {
      name: WORKSPACE_NAME,
      members: {
        create: {
          userId: adminId,
          role: WorkspaceMemberRole.OWNER,
        },
      },
    },
  });
}

async function ensureProject(workspaceId: string, adminId: string) {
  const project = await prisma.project.upsert({
    where: {
      workspaceId_key: {
        workspaceId,
        key: PROJECT_KEY,
      },
    },
    update: {
      name: PROJECT_NAME,
      description: "Sample project with builds for demos.",
    },
    create: {
      workspaceId,
      key: PROJECT_KEY,
      name: PROJECT_NAME,
      description: "Sample project with builds for demos.",
      members: {
        create: {
          userId: adminId,
          role: ProjectMemberRole.ADMIN,
        },
      },
    },
  });

  const membership = await prisma.projectMember.findFirst({
    where: { projectId: project.id, userId: adminId },
  });

  if (!membership) {
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: adminId,
        role: ProjectMemberRole.ADMIN,
      },
    });
  }

  return project;
}

async function ensureIssues(projectId: string, reporterId: string) {
  const existingIssues = await prisma.issue.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  if (existingIssues.length >= 8) {
    return existingIssues.slice(0, 8);
  }

  const templates = [
    {
      title: "Add authentication flow",
      description: "Implement login and session handling for the app.",
      type: IssueType.STORY,
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.HIGH,
    },
    {
      title: "Fix build pipeline flakiness",
      description: "Resolve intermittent CI failures during builds.",
      type: IssueType.BUG,
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.CRITICAL,
    },
    {
      title: "Draft release notes",
      description: "Compile highlights and fixes for the next release.",
      type: IssueType.TASK,
      status: IssueStatus.TODO,
      priority: IssuePriority.MEDIUM,
    },
    {
      title: "Improve accessibility",
      description: "Address accessibility gaps in navigation and forms.",
      type: IssueType.STORY,
      status: IssueStatus.IN_REVIEW,
      priority: IssuePriority.MEDIUM,
    },
    {
      title: "Optimize dashboard queries",
      description: "Reduce response times for project dashboard data.",
      type: IssueType.TASK,
      status: IssueStatus.TODO,
      priority: IssuePriority.HIGH,
    },
    {
      title: "Add staging smoke tests",
      description: "Create automated smoke tests for staging deploys.",
      type: IssueType.TASK,
      status: IssueStatus.TODO,
      priority: IssuePriority.MEDIUM,
    },
    {
      title: "Resolve login redirect bug",
      description: "Fix redirect loop seen after login in Safari.",
      type: IssueType.BUG,
      status: IssueStatus.TODO,
      priority: IssuePriority.HIGH,
    },
    {
      title: "Instrument API metrics",
      description: "Add request/latency metrics for key endpoints.",
      type: IssueType.TASK,
      status: IssueStatus.TODO,
      priority: IssuePriority.LOW,
    },
  ];

  const issuesToCreate = templates.slice(0, 8 - existingIssues.length).map((template) => ({
    projectId,
    reporterId,
    ...template,
  }));

  if (issuesToCreate.length) {
    await prisma.issue.createMany({ data: issuesToCreate });
  }

  return prisma.issue.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: 8,
  });
}

async function seedBuilds() {
  const admin = await ensureAdminUser();
  const workspace = await ensureWorkspace(admin.id);
  const project = await ensureProject(workspace.id, admin.id);

  const existingBuilds = await prisma.build.findMany({
    where: { projectId: project.id, key: { in: [DEPLOYED_BUILD_KEY, PLANNED_BUILD_KEY] } },
  });

  const hasDeployedBuild = existingBuilds.some((build) => build.key === DEPLOYED_BUILD_KEY);
  const hasPlannedBuild = existingBuilds.some((build) => build.key === PLANNED_BUILD_KEY);

  if (hasDeployedBuild && hasPlannedBuild) {
    console.log("Build demo data already seeded. Skipping.");
    return;
  }

  const issues = await ensureIssues(project.id, admin.id);
  const deployedIssues = issues.slice(0, 5);
  const plannedIssues = issues.slice(5, 8);

  await prisma.$transaction(async (tx) => {
    if (!hasDeployedBuild) {
      await tx.build.create({
        data: {
          projectId: project.id,
          key: DEPLOYED_BUILD_KEY,
          name: "Initial production rollout",
          description: "First production release with authentication and dashboards.",
          status: BuildStatus.DEPLOYED,
          environment: BuildEnvironment.PROD,
          plannedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
          deployedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
          createdById: admin.id,
          issueLinks: {
            create: deployedIssues.map((issue) => ({ issueId: issue.id })),
          },
        },
      });
    }

    if (!hasPlannedBuild) {
      await tx.build.create({
        data: {
          projectId: project.id,
          key: PLANNED_BUILD_KEY,
          name: "Upcoming staging hardening",
          description: "Planned release focused on stability and observability.",
          status: BuildStatus.PLANNED,
          environment: BuildEnvironment.STAGING,
          plannedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          createdById: admin.id,
          issueLinks: {
            create: plannedIssues.map((issue) => ({ issueId: issue.id })),
          },
        },
      });
    }
  });

  console.log("Build demo data seeded successfully.");
  console.log(`Workspace: ${workspace.name}`);
  console.log(`Project: ${project.key} - ${project.name}`);
  console.log(`Deployed build issues: ${deployedIssues.length}`);
  console.log(`Planned build issues: ${plannedIssues.length}`);
}

seedBuilds()
  .catch((error) => {
    console.error("Seeding builds failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
