import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import ProfilePageClient from "./pageClient";

const buildRequestFromHeaders = async () => {
  const headerList = await headers();
  const cookieStore = await cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const path = headerList.get("x-invoke-path") ?? "/profile";
  const url = `${protocol}://${host}${path}`;

  const request = new NextRequest(url, {
    headers: new Headers(headerList),
  });

  cookieStore.getAll().forEach((cookie) => {
    request.cookies.set(cookie.name, cookie.value);
  });

  return request;
};

export default async function ProfilePage() {
  const request = await buildRequestFromHeaders();
  const user = await getUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
    },
    orderBy: {
      project: {
        name: "asc",
      },
    },
  });

  const projects = memberships.map((membership) => ({
    id: membership.project.id,
    name: membership.project.name,
    key: membership.project.key,
    role: membership.role,
  }));

  return (
    <ProfilePageClient
      user={{
        id: user.id,
        name: user.name ?? "",
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
      projects={projects}
    />
  );
}
