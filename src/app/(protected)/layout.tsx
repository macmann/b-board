import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { getUserFromRequest } from "../../lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerList = headers();
  const cookieStore = cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const url = `${protocol}://${host}${headerList.get("x-invoke-path") ?? "/"}`;

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

  return children;
}
