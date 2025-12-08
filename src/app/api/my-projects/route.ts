import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { logError } from "../../../lib/logger";
import { ProjectRole } from "../../../lib/roles";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const projects = memberships.map((membership) => ({
      id: membership.project.id,
      key: membership.project.key,
      name: membership.project.name,
      description: membership.project.description ?? undefined,
      role: membership.role as ProjectRole,
    }));

    return NextResponse.json(projects);
  } catch (error) {
    logError("Failed to fetch user projects", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
