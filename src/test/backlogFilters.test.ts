import { describe, expect, it } from "vitest";

import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from "@/lib/prismaEnums";

import { type BacklogTableIssue } from "@/components/issues/BacklogTable";
import {
  UNASSIGNED_FILTER_VALUE,
  defaultBacklogFilters,
  issueMatchesFilters,
} from "@/components/issues/backlogFilters";

const baseIssue: BacklogTableIssue = {
  id: "1",
  key: "PROJ-1",
  title: "Implement filters",
  type: IssueType.STORY,
  status: IssueStatus.TODO,
  priority: IssuePriority.MEDIUM,
  assignee: { id: "user-1", name: "Alice" },
  epic: { id: "epic-1", title: "Epic" },
};

describe("issueMatchesFilters", () => {
  it("matches status and assignee combinations", () => {
    const filters = {
      ...defaultBacklogFilters,
      statuses: [IssueStatus.TODO],
      assignees: ["user-1"],
    };

    expect(issueMatchesFilters(baseIssue, filters, "")).toBe(true);
    expect(
      issueMatchesFilters(
        { ...baseIssue, status: IssueStatus.DONE },
        filters,
        ""
      )
    ).toBe(false);

    const unassignedFilters = {
      ...filters,
      assignees: [UNASSIGNED_FILTER_VALUE],
    };

    expect(
      issueMatchesFilters({ ...baseIssue, assignee: null }, unassignedFilters, "")
    ).toBe(true);
  });

  it("applies type, priority, epic, and search filters", () => {
    const filters = {
      ...defaultBacklogFilters,
      types: [IssueType.STORY],
      priorities: [IssuePriority.MEDIUM],
      epics: ["epic-1"],
    };

    expect(issueMatchesFilters(baseIssue, filters, "filters")).toBe(true);
    expect(issueMatchesFilters(baseIssue, filters, "missing")).toBe(false);
    expect(
      issueMatchesFilters(
        { ...baseIssue, epic: { id: "epic-2", title: "Other" } },
        filters,
        "filters"
      )
    ).toBe(false);
  });
});
