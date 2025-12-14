"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

const inputClassName =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

const labelClassName =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

export type ReportsFilterValue = {
  dateFrom: string;
  dateTo: string;
  projectId: string;
  sprintId?: string | null;
};

export type ReportsFiltersProps = {
  value: ReportsFilterValue;
  onChange: (value: ReportsFilterValue) => void;
  showSprintSelect?: boolean;
};

type ProjectOption = {
  id: string;
  name: string;
  key?: string | null;
};

type SprintOption = {
  id: string;
  name: string;
};

const ALL_PROJECTS_VALUE = "all";

export default function ReportsFilters({
  value,
  onChange,
  showSprintSelect = false,
}: ReportsFiltersProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setProjectsLoading(true);
      try {
        const response = await fetch("/api/my-projects");
        if (!response.ok) return;
        const data: ProjectOption[] = await response.json();
        if (!isMounted) return;
        setProjects(data);
      } catch (error) {
        console.error("Failed to load projects", error);
      } finally {
        if (isMounted) {
          setProjectsLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showSprintSelect || value.projectId === ALL_PROJECTS_VALUE) {
      setSprints([]);
      return;
    }

    let isMounted = true;

    const loadSprints = async () => {
      setSprintsLoading(true);
      try {
        const response = await fetch(`/api/projects/${value.projectId}/sprints`);
        if (!response.ok) return;
        const data: SprintOption[] = await response.json();
        if (!isMounted) return;
        setSprints(data);
      } catch (error) {
        console.error("Failed to load sprints", error);
      } finally {
        if (isMounted) {
          setSprintsLoading(false);
        }
      }
    };

    loadSprints();

    return () => {
      isMounted = false;
    };
  }, [showSprintSelect, value.projectId]);

  const selectedProjectHasSprints = useMemo(
    () => value.projectId !== ALL_PROJECTS_VALUE && sprints.length > 0,
    [value.projectId, sprints.length]
  );

  const handleChange = (partial: Partial<ReportsFilterValue>) => {
    const next: ReportsFilterValue = {
      ...value,
      ...partial,
    };

    if (partial.projectId && partial.projectId === ALL_PROJECTS_VALUE) {
      next.sprintId = null;
    }

    if (partial.sprintId === "") {
      next.sprintId = null;
    }

    onChange(next);
  };

  return (
    <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <label className={labelClassName} htmlFor="dateFrom">
          From
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          value={value.dateFrom}
          onChange={(event) => handleChange({ dateFrom: event.target.value })}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1.5">
        <label className={labelClassName} htmlFor="dateTo">
          To
        </label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          value={value.dateTo}
          onChange={(event) => handleChange({ dateTo: event.target.value })}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1.5">
        <label className={labelClassName} htmlFor="projectId">
          Project
        </label>
        <select
          id="projectId"
          name="projectId"
          value={value.projectId}
          onChange={(event) => handleChange({ projectId: event.target.value })}
          className={clsx(inputClassName, "appearance-none")}
        >
          <option value={ALL_PROJECTS_VALUE}>All projects</option>
          {projectsLoading ? (
            <option>Loading projects...</option>
          ) : (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key ? `${project.key} · ${project.name}` : project.name}
              </option>
            ))
          )}
        </select>
      </div>
      {showSprintSelect && (
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="sprintId">
            Sprint
          </label>
          <select
            id="sprintId"
            name="sprintId"
            value={value.sprintId ?? ""}
            onChange={(event) => handleChange({ sprintId: event.target.value })}
            className={clsx(inputClassName, "appearance-none")}
            disabled={value.projectId === ALL_PROJECTS_VALUE || sprintsLoading || !selectedProjectHasSprints}
          >
            <option value="">All sprints</option>
            {sprintsLoading && <option>Loading sprints...</option>}
            {!sprintsLoading &&
              sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
          </select>
          {value.projectId === ALL_PROJECTS_VALUE && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a project to filter by sprint.
            </p>
          )}
          {value.projectId !== ALL_PROJECTS_VALUE && !sprintsLoading && sprints.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No sprints found for this project.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
