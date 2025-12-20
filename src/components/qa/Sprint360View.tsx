"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Issue, Sprint, TestCase, TestExecution } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { routes } from "@/lib/routes";
import type { ProjectRole } from "@/lib/roles";
import { IssueStatus, IssueType, SprintStatus, TestCaseStatus, TestResultStatus } from "@/lib/prismaEnums";

const resultOptions: { value: TestResultStatus; label: string }[] = [
  { value: TestResultStatus.NOT_RUN, label: "Not Run" },
  { value: TestResultStatus.PASS, label: "Pass" },
  { value: TestResultStatus.FAIL, label: "Fail" },
  { value: TestResultStatus.BLOCKED, label: "Blocked" },
];

type SprintSummary = Pick<Sprint, "id" | "name" | "status" | "startDate" | "endDate">;

type IssueSummary = Pick<Issue, "id" | "key" | "title" | "status">;

type ExecutionWithBug = TestExecution & {
  linkedBugIssue: Pick<Issue, "id" | "key" | "title"> | null;
};

type Sprint360Response = {
  ok: boolean;
  data: {
    sprint: SprintSummary;
    stories: { issue: IssueSummary; testCases: TestCase[] }[];
    unlinkedTestCases: TestCase[];
    executions: Record<string, ExecutionWithBug | undefined>;
  };
};

type Sprint360ViewProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

type ExecutionState = {
  executionId: string | null;
  result: TestResultStatus;
  actualResult: string;
  linkedBugIssueId: string | null;
  linkedBugIssue: ExecutionWithBug["linkedBugIssue"];
};

type BugSearchResult = Pick<Issue, "id" | "key" | "title" | "type">;

type StoryGroup = {
  issue: IssueSummary;
  testCases: TestCase[];
};

export function Sprint360View({ projectId, projectRole }: Sprint360ViewProps) {
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [unlinkedTestCases, setUnlinkedTestCases] = useState<TestCase[]>([]);
  const [executionState, setExecutionState] = useState<Record<string, ExecutionState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [bugSearch, setBugSearch] = useState<Record<string, BugSearchResult[]>>({});
  const [bugSearchTerm, setBugSearchTerm] = useState<Record<string, string>>({});
  const [bugSearching, setBugSearching] = useState<Record<string, boolean>>({});
  const [linkedBugCache, setLinkedBugCache] = useState<Record<string, BugSearchResult>>({});

  const canUpdateExecutions = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO" || projectRole === "QA",
    [projectRole]
  );

  const canEditTestCases = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO" || projectRole === "QA",
    [projectRole]
  );

  const fetchSprints = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`);

      if (!response.ok) {
        throw new Error(`Failed to load sprints (${response.status})`);
      }

      const data = (await response.json()) as SprintSummary[];
      setSprints(data);

      const activeSprint = data.find((sprint) => sprint.status === SprintStatus.ACTIVE);
      const fallbackSprint = activeSprint ?? data[0] ?? null;

      setSelectedSprintId((previous) => previous ?? fallbackSprint?.id ?? null);
    } catch (fetchError) {
      console.error("[Sprint360] failed to load sprints", fetchError);
      setError("Unable to load sprints right now.");
    }
  }, [projectId]);

  const hydrateExecutionState = useCallback(
    (executions: Record<string, ExecutionWithBug | undefined>, testCases: TestCase[]) => {
      const nextState: Record<string, ExecutionState> = {};

      testCases.forEach((testCase) => {
        const execution = executions[testCase.id];

        nextState[testCase.id] = {
          executionId: execution?.id ?? null,
          result: execution?.result ?? TestResultStatus.NOT_RUN,
          actualResult: execution?.actualResult ?? "",
          linkedBugIssueId: execution?.linkedBugIssueId ?? null,
          linkedBugIssue: execution?.linkedBugIssue ?? null,
        };
      });

      setExecutionState(nextState);
    },
    []
  );

  const fetchSprint360 = useCallback(
    async (sprintId: string) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/projects/${projectId}/qa/sprint-360?sprintId=${sprintId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch sprint QA data (${response.status})`);
        }

        const body = (await response.json()) as Sprint360Response;
        const sprintStories = body?.data?.stories ?? [];
        const unlinked = body?.data?.unlinkedTestCases ?? [];

        setStories(sprintStories);
        setUnlinkedTestCases(unlinked);

        const allTestCases = [...sprintStories.flatMap((story) => story.testCases), ...unlinked];
        hydrateExecutionState(body?.data?.executions ?? {}, allTestCases);
      } catch (fetchError) {
        console.error("[Sprint360] failed to load data", fetchError);
        setError("Unable to load sprint QA data right now.");
        setStories([]);
        setUnlinkedTestCases([]);
        setExecutionState({});
      } finally {
        setLoading(false);
      }
    },
    [hydrateExecutionState, projectId]
  );

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  useEffect(() => {
    if (!selectedSprintId) return;
    fetchSprint360(selectedSprintId);
  }, [fetchSprint360, selectedSprintId]);

  const handleSprintChange = (value: string) => {
    setSelectedSprintId(value);
  };

  const updateExecution = useCallback(
    async (testCase: TestCase, patch: Partial<ExecutionState>) => {
      if (!canUpdateExecutions || !selectedSprintId) return;

      setSaving((prev) => ({ ...prev, [testCase.id]: true }));
      setError("");

      const current = executionState[testCase.id] ?? {
        executionId: null,
        result: TestResultStatus.NOT_RUN,
        actualResult: "",
        linkedBugIssueId: null,
        linkedBugIssue: null,
      };

      const nextState = { ...current, ...patch };
      const executedAt =
        nextState.result && nextState.result !== TestResultStatus.NOT_RUN
          ? new Date().toISOString()
          : null;

      try {
        let response: Response;

        if (nextState.executionId) {
          response = await fetch(`/api/projects/${projectId}/qa/executions/${nextState.executionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              result: nextState.result,
              actualResult: nextState.actualResult,
              executedAt,
              linkedBugIssueId: nextState.linkedBugIssueId ?? null,
            }),
          });
        } else {
          response = await fetch(`/api/projects/${projectId}/qa/executions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              testCaseId: testCase.id,
              sprintId: selectedSprintId,
              result: nextState.result,
              actualResult: nextState.actualResult,
              executedAt,
              linkedBugIssueId: nextState.linkedBugIssueId ?? null,
            }),
          });
        }

        if (!response.ok) {
          throw new Error(`Failed to save execution (${response.status})`);
        }

        const body = await response.json();
        const saved = (body?.data ?? null) as ExecutionWithBug | null;

        if (saved) {
          setExecutionState((prev) => ({
            ...prev,
            [testCase.id]: {
              executionId: saved.id,
              result: saved.result,
              actualResult: saved.actualResult ?? "",
              linkedBugIssueId: saved.linkedBugIssueId ?? null,
              linkedBugIssue: saved.linkedBugIssue ?? null,
            },
          }));

          if (saved.linkedBugIssue) {
            setBugSearchTerm((prev) => ({ ...prev, [testCase.id]: saved.linkedBugIssue?.key ?? "" }));
          }
        }
      } catch (saveError) {
        console.error("[Sprint360] failed to save execution", saveError);
        setError("Unable to update test execution right now.");
        await fetchSprint360(selectedSprintId);
      } finally {
        setSaving((prev) => ({ ...prev, [testCase.id]: false }));
      }
    },
    [canUpdateExecutions, executionState, fetchSprint360, projectId, selectedSprintId]
  );

  const handleResultChange = (testCase: TestCase, result: TestResultStatus) => {
    setExecutionState((prev) => {
      const current = prev[testCase.id] ?? {
        executionId: null,
        result: TestResultStatus.NOT_RUN,
        actualResult: "",
        linkedBugIssueId: null,
        linkedBugIssue: null,
      };

      const nextBugId = result === TestResultStatus.FAIL ? current.linkedBugIssueId ?? null : null;

      return {
        ...prev,
        [testCase.id]: {
          ...current,
          result,
          linkedBugIssueId: nextBugId,
          linkedBugIssue: result === TestResultStatus.FAIL ? current.linkedBugIssue : null,
        },
      };
    });

    const current = executionState[testCase.id];
    const nextBug = result === TestResultStatus.FAIL ? current?.linkedBugIssueId ?? null : null;

    updateExecution(testCase, { result, linkedBugIssueId: nextBug });
  };

  const handleNotesBlur = (testCase: TestCase, value: string) => {
    const current = executionState[testCase.id];
    if (!current || current.actualResult === value) return;
    updateExecution(testCase, { actualResult: value });
  };

  const searchBugs = useCallback(
    async (testCaseId: string, term: string) => {
      if (!term.trim()) {
        setBugSearch((prev) => ({ ...prev, [testCaseId]: [] }));
        return;
      }

      setBugSearching((prev) => ({ ...prev, [testCaseId]: true }));

      try {
        const response = await fetch(
          `/api/projects/${projectId}/standup/search-issues?query=${encodeURIComponent(term)}&take=8`
        );

        if (!response.ok) {
          throw new Error(`Failed to search issues (${response.status})`);
        }

        const data = (await response.json()) as BugSearchResult[];
        const bugs = data.filter((issue) => issue.type === IssueType.BUG);
        setBugSearch((prev) => ({ ...prev, [testCaseId]: bugs }));
      } catch (searchError) {
        console.error("[Sprint360] bug search failed", searchError);
      } finally {
        setBugSearching((prev) => ({ ...prev, [testCaseId]: false }));
      }
    },
    [projectId]
  );

  const handleBugSearchChange = (testCaseId: string, term: string) => {
    setBugSearchTerm((prev) => ({ ...prev, [testCaseId]: term }));
    const debounced = term.trim();
    if (!debounced) {
      setBugSearch((prev) => ({ ...prev, [testCaseId]: [] }));
      return;
    }

    void searchBugs(testCaseId, debounced);
  };

  const handleLinkBug = (testCase: TestCase, bug: BugSearchResult) => {
    const bugId = String(bug.id);
    setLinkedBugCache((prev) => ({ ...prev, [bugId]: bug }));
    updateExecution(testCase, {
      linkedBugIssueId: bugId,
      linkedBugIssue: { id: bug.id, key: bug.key ?? null, title: bug.title ?? null },
      result: TestResultStatus.FAIL,
    });
  };

  const handleCreateBug = async (story: IssueSummary | null, testCase: TestCase) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Bug: ${story?.key ?? "Story"} - ${testCase.title}`,
          type: IssueType.BUG,
          priority: testCase.priority,
          description: testCase.scenario ?? testCase.expectedResult ?? null,
          sprintId: selectedSprintId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create bug (${response.status})`);
      }

      const bug = (await response.json()) as Issue;
      handleLinkBug(testCase, { id: bug.id, key: bug.key ?? null, title: bug.title ?? null, type: IssueType.BUG });
    } catch (bugError) {
      console.error("[Sprint360] failed to create bug", bugError);
      setError("Unable to create linked bug right now.");
    }
  };

  const handleLinkStory = async (testCaseId: string, storyIssueId: string) => {
    if (!canEditTestCases) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/qa/testcases/${testCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyIssueId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to link story (${response.status})`);
      }

      const body = await response.json();
      const updated = (body?.data ?? null) as TestCase | null;

      if (updated) {
        setUnlinkedTestCases((prev) => prev.filter((testCase) => testCase.id !== updated.id));
        setStories((prev) =>
          prev.map((group) =>
            group.issue.id === storyIssueId
              ? { ...group, testCases: [{ ...updated }, ...group.testCases] }
              : group
          )
        );
      }
    } catch (linkError) {
      console.error("[Sprint360] failed to link story", linkError);
      setError("Unable to link test case to story right now.");
    }
  };

  const qaComplete = (group: StoryGroup) => {
    const activeCases = group.testCases.filter((testCase) => testCase.status !== TestCaseStatus.DEPRECATED);

    if (!activeCases.length) return false;

    return activeCases.every((testCase) => (executionState[testCase.id]?.result ?? TestResultStatus.NOT_RUN) === TestResultStatus.PASS);
  };

  const renderSummaryChips = (group: StoryGroup) => {
    const counts = group.testCases.reduce(
      (acc, testCase) => {
        const result = executionState[testCase.id]?.result ?? TestResultStatus.NOT_RUN;
        acc[result] = (acc[result] ?? 0) + 1;
        return acc;
      },
      {
        [TestResultStatus.NOT_RUN]: 0,
        [TestResultStatus.PASS]: 0,
        [TestResultStatus.FAIL]: 0,
        [TestResultStatus.BLOCKED]: 0,
      } as Record<TestResultStatus, number>
    );

    const chips = [
      { label: "Total", value: group.testCases.length },
      { label: "Pass", value: counts[TestResultStatus.PASS] },
      { label: "Fail", value: counts[TestResultStatus.FAIL] },
      { label: "Blocked", value: counts[TestResultStatus.BLOCKED] },
      { label: "Not Run", value: counts[TestResultStatus.NOT_RUN] },
    ];

    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {chip.label}: {chip.value}
          </span>
        ))}
      </div>
    );
  };

  const renderResultCell = (testCase: TestCase, story: IssueSummary | null) => {
    const state = executionState[testCase.id];
    const linkedBug =
      state?.linkedBugIssue ??
      (state?.linkedBugIssueId ? linkedBugCache[String(state.linkedBugIssueId)] ?? null : null);
    const disabled = !canUpdateExecutions || saving[testCase.id];

    return (
      <div className="space-y-2">
        <select
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={state?.result ?? TestResultStatus.NOT_RUN}
          disabled={disabled}
          onChange={(event) => handleResultChange(testCase, event.target.value as TestResultStatus)}
        >
          {resultOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state?.linkedBugIssueId && linkedBug ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/issues/${linkedBug.id}`} className="font-semibold hover:underline">
                {linkedBug.key ?? "Bug"}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateExecution(testCase, { linkedBugIssueId: null, linkedBugIssue: null })}
                disabled={disabled}
              >
                Clear
              </Button>
            </div>
            {linkedBug.title && <p className="mt-1 line-clamp-2">{linkedBug.title}</p>}
          </div>
        ) : state?.result === TestResultStatus.FAIL ? (
          <div className="space-y-2">
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Search bug issues"
              value={bugSearchTerm[testCase.id] ?? ""}
              onChange={(event) => handleBugSearchChange(testCase.id, event.target.value)}
              disabled={disabled}
            />
            {bugSearching[testCase.id] && <p className="text-xs text-slate-500">Searching…</p>}
            {(bugSearch[testCase.id] ?? []).length > 0 && (
              <div className="space-y-1 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                {(bugSearch[testCase.id] ?? []).map((bug) => (
                  <button
                    key={bug.id}
                    type="button"
                    className="flex w-full flex-col items-start rounded px-2 py-1 text-left hover:bg-slate-50"
                    onClick={() => handleLinkBug(testCase, bug)}
                    disabled={disabled}
                  >
                    <span className="font-semibold text-slate-900">{bug.key ?? "Bug"}</span>
                    {bug.title && <span className="text-slate-600">{bug.title}</span>}
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => handleCreateBug(story, testCase)}
            >
              Create bug
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderNotesCell = (testCase: TestCase) => {
    const state = executionState[testCase.id];
    const disabled = !canUpdateExecutions || saving[testCase.id];

    return (
      <textarea
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        placeholder="Notes"
        value={state?.actualResult ?? ""}
        onChange={(event) =>
          setExecutionState((prev) => ({
            ...prev,
            [testCase.id]: {
              executionId: state?.executionId ?? null,
              result: state?.result ?? TestResultStatus.NOT_RUN,
              actualResult: event.target.value,
              linkedBugIssueId: state?.linkedBugIssueId ?? null,
              linkedBugIssue: state?.linkedBugIssue ?? null,
            },
          }))
        }
        onBlur={(event) => handleNotesBlur(testCase, event.target.value)}
        disabled={disabled}
      />
    );
  };

  const renderTestCaseRow = (testCase: TestCase, story: IssueSummary | null) => {
    const state = executionState[testCase.id];

    return (
      <tr key={testCase.id} className="border-b border-slate-100">
        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{testCase.title}</td>
        <td className="px-4 py-3 align-top text-sm text-slate-700">{renderResultCell(testCase, story)}</td>
        <td className="px-4 py-3 align-top text-sm text-slate-700">{renderNotesCell(testCase)}</td>
        <td className="px-4 py-3 text-sm text-slate-500">{saving[testCase.id] ? "Saving…" : state?.executionId ? "Saved" : ""}</td>
      </tr>
    );
  };

  const renderStoryGroup = (group: StoryGroup) => {
    const storyLink = routes.project.qa(projectId);

    return (
      <Card key={group.issue.id}>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link href={`/issues/${group.issue.id}`} className="text-lg font-semibold text-primary hover:underline">
                  {group.issue.key ?? "Story"}
                </Link>
                <Badge variant="outline">{group.issue.status ?? IssueStatus.TODO}</Badge>
                {qaComplete(group) && <Badge variant="success">QA Complete</Badge>}
              </div>
              {group.issue.title && <p className="text-sm text-slate-700">{group.issue.title}</p>}
              {renderSummaryChips(group)}
            </div>
            <div>
              <Link href={storyLink} className="text-xs text-slate-500 underline">
                Manage test cases
              </Link>
            </div>
          </div>
          {group.testCases.length ? (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">TC Title</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Result</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Notes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.testCases.map((testCase) => renderTestCaseRow(testCase, group.issue))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No test cases linked to this story.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderUnlinked = () => {
    if (!unlinkedTestCases.length) return null;

    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Unlinked test cases</h3>
            {!stories.length && <p className="text-sm text-slate-600">Add stories to the sprint to link test cases.</p>}
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Link to Story</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unlinkedTestCases.map((testCase) => (
                  <tr key={testCase.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{testCase.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {stories.length ? (
                        <select
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          defaultValue=""
                          onChange={(event) => handleLinkStory(testCase.id, event.target.value)}
                          disabled={!canEditTestCases}
                        >
                          <option value="" disabled>
                            Select story
                          </option>
                          {stories.map((story) => (
                            <option key={story.issue.id} value={story.issue.id}>
                              {story.issue.key ?? "Story"} — {story.issue.title ?? "Untitled"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">No stories in sprint.</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Sprint 360</h2>
          <p className="text-sm text-slate-600">Track QA coverage across sprint stories.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="sprint-select">
            Sprint
          </label>
          <select
            id="sprint-select"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={selectedSprintId ?? ""}
            onChange={(event) => handleSprintChange(event.target.value)}
            disabled={!sprints.length}
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-600">Loading sprint QA…</p>
      ) : !selectedSprint ? (
        <p className="text-sm text-slate-600">No sprints available for this project.</p>
      ) : !stories.length && !unlinkedTestCases.length ? (
        <Card>
          <CardContent className="py-6 text-sm text-slate-600">
            <p>No sprint QA data available for this sprint.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => renderStoryGroup(story))}
          {renderUnlinked()}
        </div>
      )}
    </div>
  );
}
