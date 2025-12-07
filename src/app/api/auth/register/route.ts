import { NextResponse } from "next/server";

import { ProjectMemberRole } from "@prisma/client";

import { hashPassword, signAuthToken } from "../../../../lib/auth";
import prisma from "../../../../lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { name, email, password, token } = await request.json();

    if (!name || !email || !password || !token) {
      return NextResponse.json(
        { message: "Name, email, password, and invitation token are required." },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!trimmedName) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please provide a valid email." }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invite || invite.usedAt) {
      return NextResponse.json(
        { message: "Invalid or expired invitation token." },
        { status: 400 }
      );
    }

    if (invite.email && invite.email !== normalizedEmail) {
      return NextResponse.json(
        { message: "This invitation was sent to a different email address." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
        },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.project.workspaceId,
            userId: createdUser.id,
          },
        },
        create: {
          workspaceId: invite.project.workspaceId,
          userId: createdUser.id,
        },
        update: {},
      });

      await tx.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId: createdUser.id,
          role: ProjectMemberRole.VIEWER,
        },
      });

      await tx.inviteToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      return createdUser;
    });

    const authToken = signAuthToken({ userId: user.id });

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ message: "Unable to process registration." }, { status: 500 });
  }
}
