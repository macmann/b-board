"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TestCase } from "@prisma/client";

import TestCaseFormDialog from "@/components/qa/TestCaseFormDialog";
import { TestCaseList, type TestCaseRow } from "@/components/qa/TestCaseList";
import { Sprint360View } from "@/components/qa/Sprint360View";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { ProjectRole } from "@/lib/roles";

type QAPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

type TestCaseResponse = {
  ok: boolean;
  data: TestCase[];
};

type TabKey = "test-cases" | "sprint-360";

export default function QAPageClient({
  projectId,
  projectRole,
}: QAPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("test-cases");
  const [testCases, setTestCases] = useState<TestCaseRow[]>([]);
  const [storyCache, setStoryCache] = useState<Record<string, TestCaseRow["story"]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCaseRow | null>(null);
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO" || projectRole === "QA",
    [projectRole]
  );
  const canDelete = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  const subtitle = useMemo(() => {
    if (activeTab === "sprint-360") return "Sprint 360";
    return "Test Cases";
  }, [activeTab]);

  const loadIssueSummaries = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);

    if (!uniqueIds.length) {
      return {} as Record<string, TestCaseRow["story"]>;
    }

    const results = await Promise.allSettled(
      uniqueIds.map(async (issueId) => {
        const response = await fetch(`/api/issues/${issueId}`);

        if (!response.ok) {
          throw new Error(`Failed to load issue ${issueId}`);
        }

        const issue = await response.json();
        return [issueId, { id: issue.id, key: issue.key ?? null, title: issue.title ?? null }] as const;
      })
    );

    return results.reduce<Record<string, TestCaseRow["story"]>>((acc, result) => {
      if (result.status === "fulfilled") {
        const [id, summary] = result.value;
        acc[id] = summary;
      }
      return acc;
    }, {});
  }, []);

  const refreshTestCases = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/qa/testcases`);

      if (!response.ok) {
        throw new Error(`Failed to fetch test cases (${response.status})`);
      }

      const body: TestCaseResponse = await response.json();
      const nextTestCases = body?.data ?? [];
      const storyIds = nextTestCases
        .map((testCase) => testCase.storyIssueId)
        .filter((value): value is string => Boolean(value));

      const newStories = await loadIssueSummaries(storyIds);

      setStoryCache((previous) => {
        const mergedStories = { ...previous, ...newStories };
        setTestCases(
          nextTestCases.map((testCase) => ({
            ...testCase,
            story: testCase.storyIssueId ? mergedStories[testCase.storyIssueId] ?? null : null,
          }))
        );
        return mergedStories;
      });
    } catch (fetchError) {
      console.error("[QAPageClient] Error fetching test cases", fetchError);
      setError("Unable to load test cases right now.");
      setTestCases([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadIssueSummaries, projectId]);

  useEffect(() => {
    if (activeTab !== "test-cases") return;
    refreshTestCases();
  }, [activeTab, refreshTestCases]);

  const handleInlineChange = useCallback(
    async (testCaseId: string, patch: Partial<Pick<TestCase, "status" | "priority">>) => {
      if (!canEdit) return;

      setInlineUpdatingId(testCaseId);
      setError("");

      setTestCases((prev) =>
        prev.map((item) => (item.id === testCaseId ? { ...item, ...patch } : item))
      );

      try {
        const response = await fetch(`/api/projects/${projectId}/qa/testcases/${testCaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          throw new Error(`Failed to update test case (${response.status})`);
        }

        const body = await response.json();
        const updated: TestCase = body?.data ?? null;

        if (updated) {
          setTestCases((prev) =>
            prev.map((item) =>
              item.id === testCaseId
                ? {
                    ...item,
                    ...updated,
                    story: item.storyIssueId
                      ? storyCache[item.storyIssueId] ?? item.story ?? null
                      : null,
                  }
                : item
            )
          );
        } else {
          await refreshTestCases();
        }
      } catch (updateError) {
        console.error("[QAPageClient] Failed inline update", updateError);
        setError("Unable to update test case right now.");
        await refreshTestCases();
      } finally {
        setInlineUpdatingId(null);
      }
    },
    [canEdit, projectId, refreshTestCases, storyCache]
  );

  const handleDelete = useCallback(
    async (testCase: TestCaseRow) => {
      if (!canDelete) return;

      const confirmed = window.confirm("Are you sure you want to delete this test case?");

      if (!confirmed) return;

      setDeletingId(testCase.id);
      setError("");

      try {
        const response = await fetch(`/api/projects/${projectId}/qa/testcases/${testCase.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Failed to delete test case (${response.status})`);
        }

        setTestCases((prev) => prev.filter((item) => item.id !== testCase.id));
      } catch (deleteError) {
        console.error("[QAPageClient] Failed to delete test case", deleteError);
        setError("Unable to delete test case right now.");
      } finally {
        setDeletingId(null);
      }
    },
    [canDelete, projectId]
  );

  const handleSaved = useCallback(async () => {
    setIsFormOpen(false);
    setEditingCase(null);
    await refreshTestCases();
  }, [refreshTestCases]);

  const handleEdit = useCallback((testCase: TestCaseRow) => {
    setEditingCase(testCase);
    setIsFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingCase(null);
    setIsFormOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Quality Assurance</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Quality Assurance</h1>
            <div className="flex items-center gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <Button
                    key={tab.key}
                    variant={isActive ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === "test-cases" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Test Cases</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Manage and execute your project test cases.
                  </p>
                </div>
                {canEdit && (
                  <Button onClick={handleCreate}>New Test Case</Button>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
                  {error}
                </div>
              )}

              <TestCaseList
                testCases={testCases}
                isLoading={isLoading}
                error={error}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onInlineChange={handleInlineChange}
                updatingId={inlineUpdatingId}
                deletingId={deletingId}
              />
            </div>
          ) : (
            <Sprint360View projectId={projectId} projectRole={projectRole} />
          )}
        </CardContent>
      </Card>

      <TestCaseFormDialog
        projectId={projectId}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSaved={handleSaved}
        testCase={editingCase}
        canEdit={canEdit}
        initialStory={
          editingCase?.storyIssueId
            ? storyCache[editingCase.storyIssueId] ?? editingCase.story ?? null
            : editingCase?.story ?? null
        }
      />
    </div>
  );
}

const tabs: { key: TabKey; label: string }[] = [
  { key: "test-cases", label: "Test Cases" },
  { key: "sprint-360", label: "Sprint 360" },
];
