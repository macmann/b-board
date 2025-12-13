"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { ProjectRole } from "@/lib/roles";

export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: ProjectRole;
  enableResearchBoard: boolean;
  standupEnabled: boolean;
  activeSprint: { id: string; name: string } | null;
  stats: {
    openIssues: number;
    inProgressIssues: number;
    blockedIssues: number;
  };
};

type MyProjectsGridProps = {
  projects: ProjectSummary[];
  createAction?: ReactNode;
};

const metricStyles = "flex flex-col rounded-lg bg-slate-50 px-3 py-2 text-left dark:bg-slate-900/50";
const metricLabel = "text-xs text-slate-500";
const metricValue = "text-lg font-semibold text-slate-900 dark:text-slate-100";

export function MyProjectsTable({ projects, createAction }: MyProjectsGridProps) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">
          📂
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
          You don’t have any projects yet
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Start your first project to organize backlog, boards, and standups in one place.
        </p>
        <div className="mt-4">{createAction}</div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const canManageProject = project.role === "ADMIN" || project.role === "PO";

        const backlogUrl = `/projects/${project.id}/backlog`;

        return (
          <Card
            key={project.id}
            className="flex h-full cursor-pointer flex-col hover:border-primary/30 hover:shadow-md"
            onClick={() => router.push(backlogUrl)}
            role="link"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(backlogUrl);
              }
            }}
          >
            <CardHeader className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{project.key}</Badge>
                  <Badge variant="neutral">{project.role}</Badge>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {project.description?.trim() || "No description yet."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.activeSprint && (
                    <Badge variant="info">Active Sprint · {project.activeSprint.name}</Badge>
                  )}
                  {project.enableResearchBoard && (
                    <Badge variant="success">Research Enabled</Badge>
                  )}
                  {project.standupEnabled && <Badge variant="success">Standup Enabled</Badge>}
                </div>
              </div>

              <details
                className="relative"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <summary className="flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Actions
                  <span className="ml-1">▾</span>
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <Link
                    href={`/projects/${project.id}/settings`}
                    className="block rounded-md px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Project Settings
                  </Link>
                  {canManageProject && (
                    <Link
                      href={`/projects/${project.id}/settings/import`}
                      className="block rounded-md px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Import from Jira
                    </Link>
                  )}
                  {canManageProject && (
                    <Link
                      href={`/projects/${project.id}/settings#danger-zone`}
                      className="block rounded-md px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Archive Project
                    </Link>
                  )}
                </div>
              </details>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className={metricStyles}>
                  <span className={metricLabel}>Open issues</span>
                  <span className={metricValue}>{project.stats.openIssues}</span>
                </div>
                <div className={metricStyles}>
                  <span className={metricLabel}>In progress</span>
                  <span className={metricValue}>{project.stats.inProgressIssues}</span>
                </div>
                <div className={metricStyles}>
                  <span className={metricLabel}>Blocked</span>
                  <span className={metricValue}>{project.stats.blockedIssues}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-3">
              <Button
                asChild
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Link href={backlogUrl}>Open Project</Link>
              </Button>
              <Link
                href={backlogUrl}
                className="text-sm font-medium text-primary hover:text-blue-600"
                onClick={(event) => event.stopPropagation()}
              >
                Go to backlog →
              </Link>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
