"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import ReportPageLayout from "./ReportPageLayout";
import type { ReportModuleNavItem } from "./ReportModuleNav";
import BlockerThemesModule from "./BlockerThemesModule";
import CycleTimeModule from "./CycleTimeModule";
import SprintBurndownModule from "./SprintBurndownModule";
import StandupInsightsModule from "./StandupInsightsModule";
import VelocityTrendModule from "./VelocityTrendModule";
import {
  DEFAULT_REPORT_MODULE,
  normalizeModule,
  type ReportFilters,
  type ReportModuleKey,
} from "@/lib/reports/filters";

const REPORT_COMPONENTS: Record<
  ReportModuleKey,
  (props: { projectId: string; initialFilters: ReportFilters; sprints: SprintOption[] }) => JSX.Element
> = {
  "sprint-burndown": ({ projectId, initialFilters, sprints }) => (
    <SprintBurndownModule
      projectId={projectId}
      initialFilters={initialFilters}
      sprints={sprints}
    />
  ),
  "velocity-trend": ({ projectId, initialFilters, sprints }) => (
    <VelocityTrendModule projectId={projectId} initialFilters={initialFilters} sprints={sprints} />
  ),
  "cycle-time": ({ projectId, initialFilters }) => (
    <CycleTimeModule projectId={projectId} initialFilters={initialFilters} />
  ),
  "standup-insights": ({ projectId, initialFilters }) => (
    <StandupInsightsModule projectId={projectId} initialFilters={initialFilters} />
  ),
  "blocker-themes": ({ projectId, initialFilters }) => (
    <BlockerThemesModule projectId={projectId} initialFilters={initialFilters} />
  ),
};

export const resolveActiveModuleKey = (moduleParam: string | null): ReportModuleKey =>
  normalizeModule(moduleParam);

export const resolveReportComponent = (moduleKey: ReportModuleKey) =>
  REPORT_COMPONENTS[moduleKey] ?? REPORT_COMPONENTS[DEFAULT_REPORT_MODULE];

type SprintOption = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

type ProjectReportsClientProps = {
  projectId: string;
  modules: ReadonlyArray<ReportModuleNavItem & { requiresSprintScope: boolean }>;
  sprints: SprintOption[];
  initialFilters: ReportFilters;
};

export default function ProjectReportsClient({
  projectId,
  modules,
  sprints,
  initialFilters,
}: ProjectReportsClientProps) {
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get("module");

  const activeModuleKey = useMemo(
    () => resolveActiveModuleKey(moduleParam),
    [moduleParam]
  );

  const activeModule = useMemo(
    () => modules.find((module) => module.key === activeModuleKey) ?? modules[0],
    [activeModuleKey, modules]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Debugging aid to confirm the module selection stays in sync with the URL.
      console.debug("[ProjectReports] Active module changed", {
        activeModuleKey,
        moduleParam,
      });
    }
  }, [activeModuleKey, moduleParam]);

  const renderReport = useMemo(
    () => resolveReportComponent(activeModuleKey),
    [activeModuleKey]
  );

  return (
    <ReportPageLayout
      projectId={projectId}
      modules={modules}
      activeModule={activeModule}
      sprints={sprints}
      filters={initialFilters}
      showSprintSelect={Boolean(activeModule.requiresSprintScope)}
    >
      {renderReport({ projectId, initialFilters, sprints })}
    </ReportPageLayout>
  );
}
