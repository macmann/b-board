// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BacklogPageClient, {
  type BacklogGroup,
} from "@/app/(protected)/projects/[projectId]/backlog/pageClient";
import { IssuePriority, IssueStatus, IssueType, SprintStatus } from "@/lib/prismaEnums";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
}));

vi.mock("@/components/issues/CreateIssueDrawer", () => ({
  default: () => <div data-testid="create-issue">Create Issue</div>,
}));

vi.mock("@/components/research/ResearchBacklogContainer", () => ({
  default: () => <div data-testid="research-backlog">Research</div>,
}));

const backlogGroups: BacklogGroup[] = [
  {
    id: "sprint-1",
    name: "Sprint 1",
    type: "sprint",
    status: SprintStatus.ACTIVE,
    issues: [
      {
        id: "1",
        key: "PRJ-1",
        title: "Implement filters",
        type: IssueType.STORY,
        status: IssueStatus.TODO,
        priority: IssuePriority.MEDIUM,
        assignee: { id: "user-1", name: "Alice" },
      },
    ],
  },
  {
    id: "backlog",
    name: "Product Backlog",
    type: "backlog",
    issues: [
      {
        id: "2",
        key: "PRJ-2",
        title: "Done work",
        type: IssueType.BUG,
        status: IssueStatus.DONE,
        priority: IssuePriority.HIGH,
        assignee: null,
      },
    ],
  },
];

const assigneeOptions = [
  { id: "user-1", label: "Alice" },
  { id: "user-2", label: "Bob" },
];

const createFetchMock = () =>
  vi.fn((url: RequestInfo | URL) => {
    const urlString = url.toString();

    if (urlString.includes("/backlog")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ groups: backlogGroups, members: assigneeOptions, epics: [] }),
          { status: 200 }
        )
      );
    }

    if (urlString.includes("ai-suggestions")) {
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }

    if (urlString.includes("research-board")) {
      return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    }

    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });

describe("Backlog filters integration", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    window.history.pushState({}, "", "/projects/proj-1/backlog");
    global.fetch = createFetchMock();
  });

  it("filters visible issues and syncs query params", async () => {
    const user = userEvent.setup();

    render(
      <BacklogPageClient
        projectId="proj-1"
        projectRole="ADMIN"
        manageTeamLink={<div />}
        backlogGroups={backlogGroups}
        assigneeOptions={assigneeOptions}
        epicOptions={[]}
        enableResearchBoard={false}
        researchItems={[]}
      />
    );

    expect(await screen.findByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Implement filters")).toBeInTheDocument();
    expect(screen.getByText("Done work")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /status/i }));
    await user.click(screen.getByRole("checkbox", { name: "DONE" }));

    await waitFor(() => {
      expect(screen.queryByText("Implement filters")).not.toBeInTheDocument();
      expect(screen.getByText("Done work")).toBeInTheDocument();
    });

    await waitFor(() => {
      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toContain("status=DONE");
    });

    await user.click(screen.getByRole("button", { name: /Clear all/i }));

    await waitFor(() => {
      expect(screen.getByText("Implement filters")).toBeInTheDocument();
    });

    const finalCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
    expect(finalCall).not.toContain("status=");
  });
});
