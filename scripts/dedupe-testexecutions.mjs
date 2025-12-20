import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function buildGroupKey(execution) {
  const testCaseId = execution.testCaseId ?? "<null>";
  const sprintId = execution.sprintId ?? "<null>";
  return `${testCaseId}:${sprintId}`;
}

function sortExecutionsNewestFirst(a, b) {
  const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;

  if (b.id > a.id) return 1;
  if (b.id < a.id) return -1;
  return 0;
}

async function dedupeTestExecutions() {
  const executions = await prisma.testExecution.findMany({
    select: {
      id: true,
      testCaseId: true,
      sprintId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`Scanned ${executions.length} TestExecution row(s).`);

  const groups = new Map();

  for (const execution of executions) {
    const key = buildGroupKey(execution);
    const list = groups.get(key) ?? [];
    list.push(execution);
    groups.set(key, list);
  }

  let duplicateGroupCount = 0;
  let totalDeleted = 0;

  for (const [key, list] of groups.entries()) {
    if (list.length <= 1) continue;

    duplicateGroupCount += 1;
    const [testCaseId, sprintId] = key.split(":");

    const sorted = [...list].sort(sortExecutionsNewestFirst);
    const [, ...duplicates] = sorted;

    if (duplicates.length === 0) continue;

    const idsToDelete = duplicates.map((execution) => execution.id);

    const deletionResult = await prisma.testExecution.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    totalDeleted += deletionResult.count;

    console.log(
      `Group ${testCaseId}/${sprintId}: kept ${sorted[0].id}, deleted ${deletionResult.count}.`,
    );
  }

  console.log(`Found ${duplicateGroupCount} duplicate group(s).`);
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
