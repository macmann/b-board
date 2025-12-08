import { ReactNode, use } from "react";
import { notFound } from "next/navigation";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ projectId: string }> | { projectId: string };
}

export default function ProjectLayout({ children, params }: LayoutProps) {
  const { projectId } =
    typeof (params as Promise<{ projectId: string }>).then === "function"
      ? use(params as Promise<{ projectId: string }>)
      : (params as { projectId: string });

  if (!projectId) notFound(); // do not allow missing id

  return <>{children}</>;
}
