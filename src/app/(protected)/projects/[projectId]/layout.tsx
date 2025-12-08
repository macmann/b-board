import { ReactNode } from "react";
import { notFound } from "next/navigation";

type Props = {
  children: ReactNode;
  params: { projectId?: string };
};

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = params ?? {};

  if (!projectId) {
    notFound();
  }

  return <>{children}</>;
}
