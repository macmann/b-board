import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: { projectId: string } | Promise<{ projectId: string }>;
};

// Simple pass-through layout – let the pages handle validation and 404s.
export default function ProjectLayout({ children }: Props) {
  return <>{children}</>;
}
