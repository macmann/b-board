"use client";

import { useRouter } from "next/navigation";

import { ProjectRole } from "../../../lib/roles";
import ProjectCard from "@/components/projects/ProjectCard";

type MyProject = {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: ProjectRole;
};

export function MyProjectsTable({ projects }: { projects: MyProject[] }) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:bg-slate-900/40">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
          No projects yet
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create a new project to start planning your work.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          id={project.id}
          keyCode={project.key}
          name={project.name}
          description={project.description}
          isCurrentUserMember
          onClick={() => router.push(`/projects/${project.id}/backlog`)}
        />
      ))}
    </div>
  );
}
