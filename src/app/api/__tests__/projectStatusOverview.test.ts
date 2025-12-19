import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockPrisma = {
  project: { findMany: vi.fn() },
  projectMember: { findMany: vi.fn() },
  dailyStandupEntry: { findMany: vi.fn() },
  issueHistory: { findMany: vi.fn() },
};

vi.mock("@/lib/auth", () => ({
  __esModule: true,
  getUserFromRequest: mockGetUserFromRequest,
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe("project status overview report API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockGetUserFromRequest.mockResolvedValue(null);

    const { GET } = await import("../reports/project-status-overview/route");
    const request = new NextRequest(
      "http://localhost/api/reports/project-status-overview?from=2024-01-01&to=2024-01-31"
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
  });

  it("returns computed metrics from prisma data", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: Role.ADMIN });

    mockPrisma.project.findMany.mockResolvedValue([{ id: "project-1", name: "Alpha" }]);
    mockPrisma.dailyStandupEntry.findMany.mockResolvedValue([
      { projectId: "project-1", blockers: "Waiting on dependency" },
    ]);
    mockPrisma.issueHistory.findMany
      .mockResolvedValueOnce([
        {
          issueId: "issue-1",
          createdAt: new Date("2024-01-15T00:00:00Z"),
          issue: { projectId: "project-1", createdAt: new Date("2024-01-10T00:00:00Z") },
        },
      ])
      .mockResolvedValueOnce([
        {
          issueId: "issue-1",
          createdAt: new Date("2024-01-15T00:00:00Z"),
          issue: { projectId: "project-1", createdAt: new Date("2024-01-10T00:00:00Z") },
        },
      ]);

    const { GET } = await import("../reports/project-status-overview/route");
    const request = new NextRequest(
      "http://localhost/api/reports/project-status-overview?from=2024-01-01&to=2024-01-31"
    );

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({
      onTrack: 0,
      atRisk: 1,
      offTrack: 0,
      avgHealthScore: 65,
    });
    expect(payload.rows).toEqual([
      {
        projectId: "project-1",
        projectName: "Alpha",
        status: "AT_RISK",
        healthScore: 65,
        medianLeadTimeDays: 5,
        openBlockers: 1,
      },
    ]);
    expect(payload.aiObservation).toContain("Alpha");
  });
});
