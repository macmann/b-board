"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProjectFilterProps = {
  projects: Array<{ id: string; name: string }>;
  selectedProjectId?: string;
};

export default function ProjectFilter({ projects, selectedProjectId }: ProjectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = useMemo(
    () => [{ id: "", name: "All projects" }, ...projects],
    [projects]
  );

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString());

    if (value) {
      params.set("projectId", value);
    } else {
      params.delete("projectId");
    }

    const query = params.toString();
    const basePath = pathname ?? "";
    const nextPath = query ? `${basePath}?${query}` : basePath;
    router.replace(nextPath, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Project filter
      </label>
      <select
        className="min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        value={selectedProjectId ?? ""}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((project) => (
          <option key={project.id || "all"} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
