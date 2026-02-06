import Link from "next/link";
import { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

type ProjectLayoutProps = {
  children: ReactNode;
};

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Button asChild size="sm" variant="ghost">
          <Link href={routes.myProjects()} aria-label="Back to My Projects">
            ← Back to My Projects
          </Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
