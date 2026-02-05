import "@/app/globals.css";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import { getUserFromRequest } from "../../lib/auth";

type Props = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: Props) {
  const headerList = await headers();
  const cookieStore = await cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const url = `${protocol}://${host}/`;

  const request = new NextRequest(url, {
    headers: new Headers(headerList),
  });

  cookieStore.getAll().forEach((cookie) => {
    request.cookies.set(cookie.name, cookie.value);
  });

  const user = await getUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const currentProjectName = headerList.get("x-current-project-name") ?? "";

  const currentPath =
    headerList.get("x-forwarded-uri") ||
    headerList.get("x-pathname") ||
    headerList.get("x-invoke-path") ||
    "";

  const logout = async () => {
    "use server";

    const currentHeaders = await headers();
    const currentProtocol = currentHeaders.get("x-forwarded-proto") ?? "http";
    const currentHost = currentHeaders.get("host") ?? "localhost:3000";
    const cookieHeader = (await cookies())
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    await fetch(`${currentProtocol}://${currentHost}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
    });

    redirect("/login");
  };

  return (
    <AppShell
      currentProjectName={currentProjectName}
      currentPath={currentPath}
      onLogout={logout}
      user={user}
    >
      {children}
    </AppShell>
  );
}
