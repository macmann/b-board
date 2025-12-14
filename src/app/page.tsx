import { redirect } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { routes } from "@/lib/routes";

export default async function HomePage() {
  const { user } = await getCurrentProjectContext();

  if (user) {
    redirect(routes.myProjects());
  }

  redirect(routes.login());
}
