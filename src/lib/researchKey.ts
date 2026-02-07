import type { PrismaClient } from "@prisma/client";

const getProjectPrefix = (projectName: string) => {
  const words = projectName.trim().split(" ");
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function getNextResearchKey(
  prisma: PrismaClient,
  projectId: string
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const projectPrefix = project?.name ? getProjectPrefix(project.name) : "PR";
  const prefixMatcher = new RegExp(`^${escapeRegex(projectPrefix)}-(\\d+)$`, "i");
  const existingKeys = await prisma.researchItem.findMany({
    where: { projectId },
    select: { key: true },
  });

  const nextNumber = existingKeys.reduce((max, { key }) => {
    const match = key.match(prefixMatcher);
    const value = match ? Number.parseInt(match[1], 10) : Number.NEGATIVE_INFINITY;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `${projectPrefix}-${nextNumber + 1}`;
}
