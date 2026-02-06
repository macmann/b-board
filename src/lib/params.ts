export type ProjectParams = Promise<{ projectId?: string }> | { projectId?: string } | undefined;
export type BuildParams =
  | Promise<{ projectId?: string; buildId?: string }>
  | { projectId?: string; buildId?: string }
  | undefined;

export const resolveProjectId = async (params: ProjectParams): Promise<string | null> => {
  const resolvedParams = params && "then" in params ? await params : params;
  if (!resolvedParams || typeof resolvedParams !== "object") {
    return null;
  }

  if (!("projectId" in resolvedParams)) {
    return null;
  }

  const { projectId } = resolvedParams as { projectId?: string };
  return projectId ?? null;
};
