import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/db";
import { comparePassword, getUserFromRequest, hashPassword } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { message: "Current password and new password are required." },
      { status: 400 }
    );
  }

  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
      { status: 400 }
    );
  }

  const matches = await comparePassword(String(currentPassword), user.passwordHash);

  if (!matches) {
    return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });
  }

  const isSame = await comparePassword(String(newPassword), user.passwordHash);

  if (isSame) {
    return NextResponse.json(
      { message: "New password must be different from the current password." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(String(newPassword));

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
