import { ReactNode } from "react";

type ProjectLayoutProps = {
  children: ReactNode;
};

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  return <div className="space-y-4">{children}</div>;
}
