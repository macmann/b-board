import { ReactNode } from "react";
import { notFound } from "next/navigation";

type Props = {
  children: ReactNode;
  params: { projectId: string } | Promise<{ projectId: string }>;
};

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = await params;

  if (!projectId) {
    notFound();
  }

  return <>{children}</>;
}
