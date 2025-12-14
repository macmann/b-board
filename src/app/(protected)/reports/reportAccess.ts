import { redirect } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { Role } from "@/lib/prismaEnums";
import { routes } from "@/lib/routes";

export async function requireLeadershipUser() {
  const { user } = await getCurrentProjectContext();

  if (!user) {
    redirect(routes.login());
  }

  const isLeadership = user.role === Role.ADMIN || user.role === Role.PO;

  if (!isLeadership) {
    redirect(routes.myProjects());
  }

  return user;
}
