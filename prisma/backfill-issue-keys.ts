import prisma from "../src/lib/db";

function generateProjectPrefix(projectName: string): string {
  const words = projectName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "P";
  if (words.length === 1) return words[0][0]?.toUpperCase() || "P";

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

async function main() {
  console.log("Fetching issues without keys...");
  const issues = await prisma.issue.findMany({
    where: { key: null },
    include: { project: true },
    orderBy: { createdAt: "asc" },
  });

  if (issues.length === 0) {
    console.log("No issues require backfilling.");
    return;
  }

  const projectCounters = new Map<string, number>();
  const updates = issues.map((issue) => {
    const prefix = generateProjectPrefix(issue.project.name);
    const nextNumber = (projectCounters.get(issue.projectId) || 0) + 1;
    projectCounters.set(issue.projectId, nextNumber);
    const key = `${prefix}-${nextNumber}`;

    return prisma.issue.update({
      where: { id: issue.id },
      data: { key },
    });
  });

  console.log(`Updating ${updates.length} issues...`);
  await prisma.$transaction(updates);
  console.log("Backfill completed successfully.");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
