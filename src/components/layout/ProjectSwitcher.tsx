"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { routes } from "@/lib/routes";

type ProjectOption = {
  id: string;
  name: string;
};

type ProjectSwitcherProps = {
  currentProjectId?: string | null;
};

export default function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      try {
        const response = await fetch("/api/my-projects");
        if (!response.ok) return;

        const data = (await response.json()) as Array<ProjectOption>;
        if (!isMounted) return;

        setProjects(data);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelect = (value: string) => {
    if (!value) return;
    router.push(routes.project.backlog(value));
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Project</span>
      <select
        className="mt-1 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        value={currentProjectId ?? ""}
        disabled={isLoading || projects.length === 0}
        onChange={(event) => handleSelect(event.target.value)}
      >
        <option value="">{isLoading ? "Loading projects..." : "Select a project"}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
