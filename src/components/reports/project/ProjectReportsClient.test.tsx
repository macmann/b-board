// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReportModuleKey } from "@/lib/reports/filters";

let mockParams: URLSearchParams;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockParams.get(key),
    toString: () => mockParams.toString(),
  }),
  usePathname: () => "/projects/project-1/reports",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("./VelocityTrendModule", () => ({
  default: () => <div>Velocity Trend Test</div>,
}));

vi.mock("./SprintBurndownModule", () => ({
  default: () => <div>Sprint Burndown Test</div>,
}));

vi.mock("./CycleTimeModule", () => ({
  default: () => <div>Cycle Time Test</div>,
}));

vi.mock("./StandupInsightsModule", () => ({
  default: () => <div>Standup Insights Test</div>,
}));

vi.mock("./BlockerThemesModule", () => ({
  default: () => <div>Blocker Themes Test</div>,
}));

import ProjectReportsClient from "./ProjectReportsClient";

describe("ProjectReportsClient", () => {
  beforeEach(() => {
    mockParams = new URLSearchParams();
  });

  const modules = [
    {
      key: "sprint-burndown" satisfies ReportModuleKey,
      title: "Sprint Burndown",
      description: "Default",
      requiresSprintScope: true,
    },
    {
      key: "velocity-trend" satisfies ReportModuleKey,
      title: "Velocity Trend",
      description: "Velocity",
      requiresSprintScope: true,
    },
  ];

  const baseProps = {
    projectId: "project-1",
    sprints: [],
    initialFilters: { dateFrom: "2024-01-01", dateTo: "2024-01-14", sprintId: null },
  };

  it("renders the module from the search query", () => {
    mockParams.set("module", "velocity-trend");

    render(<ProjectReportsClient modules={modules} {...baseProps} />);

    expect(screen.getByText("Velocity Trend Test")).toBeInTheDocument();
  });

  it("falls back to sprint burndown when module is unknown", () => {
    mockParams.set("module", "unknown-module");

    render(<ProjectReportsClient modules={modules} {...baseProps} />);

    expect(screen.getByText("Sprint Burndown Test")).toBeInTheDocument();
  });
});
