import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const updates: { name?: string; avatarUrl?: string | null } = {};

  if (payload?.name !== undefined) {
    const trimmedName = String(payload.name).trim();

    if (!trimmedName) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    updates.name = trimmedName;
  }

  if (payload?.avatarUrl !== undefined) {
    updates.avatarUrl = payload.avatarUrl ? String(payload.avatarUrl) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No changes provided." }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json(updatedUser);
}
