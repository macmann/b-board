import { NextResponse } from "next/server";

import { Role, WorkspaceMemberRole } from "@prisma/client";

import { hashPassword, signAuthToken } from "../../../../lib/auth";
import prisma from "../../../../lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    const { name, email, password, inviteToken } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (!inviteToken) {
      return NextResponse.json(
        { message: "Registration requires an invite." },
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

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token: String(inviteToken) },
    });

    if (!invitation) {
      return NextResponse.json(
        { message: "Invalid or expired invitation token." },
        { status: 400 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { message: "This invitation has already been used." },
        { status: 400 }
      );
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { message: "This invitation has expired." },
        { status: 400 }
      );
    }

    if (invitation.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { message: "This invitation was sent to a different email address." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(String(password));

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
          role: Role.VIEWER,
        },
      });

      await tx.invitation.update({
        where: { token: invitation.token },
        data: { acceptedAt: new Date() },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: createdUser.id,
          },
        },
        update: {},
        create: {
          workspaceId: invitation.workspaceId,
          userId: createdUser.id,
          role: WorkspaceMemberRole.MEMBER,
        },
      });

      if (invitation.projectId) {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: invitation.projectId,
              userId: createdUser.id,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            projectId: invitation.projectId,
            userId: createdUser.id,
            role: invitation.role,
          },
        });
      }

      return createdUser;
    });

    const authToken = signAuthToken({ userId: user.id });

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ message: "Unable to process registration." }, { status: 500 });
  }
}
