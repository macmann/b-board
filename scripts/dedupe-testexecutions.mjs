import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dedupeTestExecutions() {
  const duplicateGroups = await prisma.testExecution.groupBy({
    by: ["testCaseId", "sprintId"],
    _count: { _all: true },
    having: {
      _count: {
        _all: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${duplicateGroups.length} duplicate group(s) by (testCaseId, sprintId).`);

  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    const executions = await prisma.testExecution.findMany({
      where: {
        testCaseId: group.testCaseId,
        sprintId: group.sprintId,
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    });

    const [executionToKeep, ...executionsToDelete] = executions;

    if (!executionToKeep || executionsToDelete.length === 0) {
      continue;
    }

    const idsToDelete = executionsToDelete.map((execution) => execution.id);
    const deletionResult = await prisma.testExecution.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    totalDeleted += deletionResult.count;

    console.log(
      `Group ${group.testCaseId}/${group.sprintId ?? "<null>"}: kept ${executionToKeep.id}, deleted ${deletionResult.count}.`,
    );
  }

  console.log(`Deleted ${totalDeleted} duplicate TestExecution row(s).`);
}

async function main() {
  await dedupeTestExecutions();
}

main()
  .catch((error) => {
    console.error("Failed to dedupe TestExecution records:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
