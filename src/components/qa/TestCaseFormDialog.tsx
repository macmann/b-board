"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { TestCase } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { logClient } from "@/lib/clientLogger";
import { TestCasePriority, TestCaseStatus, TestCaseType } from "@/lib/prismaEnums";

import type { IssueSummary, TestCaseRow } from "./TestCaseList";
import { StoryIssuePicker } from "./StoryIssuePicker";

type TestCaseFormDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
  testCase: TestCaseRow | null;
  canEdit: boolean;
  initialStory?: IssueSummary | null;
};

type FormState = {
  title: string;
  type: TestCaseType;
  scenario: string;
  testData: string;
  expectedResult: string;
  priority: TestCasePriority;
  status: TestCaseStatus;
  storyIssueId: string | null;
};

const defaultState: FormState = {
  title: "",
  type: TestCaseType.POSITIVE,
  scenario: "",
  testData: "",
  expectedResult: "",
  priority: TestCasePriority.MEDIUM,
  status: TestCaseStatus.DRAFT,
  storyIssueId: null,
};

export default function TestCaseFormDialog({
  projectId,
  open,
  onOpenChange,
  onSaved,
  testCase,
  canEdit,
  initialStory,
}: TestCaseFormDialogProps) {
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [storySummary, setStorySummary] = useState<IssueSummary | null>(initialStory ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const isEditing = useMemo(() => Boolean(testCase), [testCase]);

  useEffect(() => {
    if (testCase) {
      setFormState({
        title: testCase.title,
        type: testCase.type,
        scenario: testCase.scenario ?? "",
        testData: testCase.testData ?? "",
        expectedResult: testCase.expectedResult ?? "",
        priority: testCase.priority,
        status: testCase.status,
        storyIssueId: testCase.storyIssueId ?? null,
      });
      setStorySummary(initialStory ?? null);
    } else {
      setFormState(defaultState);
      setStorySummary(null);
    }
  }, [initialStory, testCase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.title.trim()) {
      setError("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        title: formState.title.trim(),
        type: formState.type,
        scenario: formState.scenario.trim() || null,
        testData: formState.testData.trim() || null,
        expectedResult: formState.expectedResult.trim() || null,
        priority: formState.priority,
        status: formState.status,
        storyIssueId: formState.storyIssueId,
      } satisfies Partial<TestCase>;

      const endpoint = `/api/projects/${projectId}/qa/testcases${isEditing ? `/${testCase?.id ?? ""}` : ""}`;

      logClient("QA Save Test Case", {
        action: isEditing ? "PATCH_TEST_CASE" : "CREATE_TEST_CASE",
        method: isEditing ? "PATCH" : "POST",
        endpoint,
        projectId,
        testCaseId: testCase?.id ?? null,
        payload: {
          title: payload.title,
          type: payload.type,
          priority: payload.priority,
          status: payload.status,
          storyIssueId: payload.storyIssueId,
        },
      });

      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? "Unable to save test case.";
        setError(message);
        return;
      }

      await onSaved();
      onOpenChange(false);
    } catch (submitError) {
      console.error("[TestCaseFormDialog] submit error", submitError);
      setError("Something went wrong while saving the test case.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => onOpenChange(canEdit && value)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fade-in" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl animate-slide-in-right">
          <Dialog.Title className="text-lg font-semibold">
            {isEditing ? "Edit Test Case" : "New Test Case"}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-500">
            {isEditing ? "Update the test case details" : "Create a new QA test case"}
          </Dialog.Description>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                required
                disabled={!canEdit}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="type">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={formState.type}
                onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as TestCaseType }))}
                disabled={!canEdit}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {Object.values(TestCaseType).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <StoryIssuePicker
              projectId={projectId}
              value={formState.storyIssueId}
              initialStory={storySummary}
              onChange={(issueId, summary) => {
                setFormState((prev) => ({ ...prev, storyIssueId: issueId }));
                setStorySummary(summary ?? null);
              }}
              disabled={!canEdit}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="testData">
                Test Data
              </label>
              <textarea
                id="testData"
                name="testData"
                value={formState.testData}
                onChange={(event) => setFormState((prev) => ({ ...prev, testData: event.target.value }))}
                rows={2}
                disabled={!canEdit}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="expectedResult">
                Expected Result
              </label>
              <textarea
                id="expectedResult"
                name="expectedResult"
                value={formState.expectedResult}
                onChange={(event) => setFormState((prev) => ({ ...prev, expectedResult: event.target.value }))}
                rows={2}
                disabled={!canEdit}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="scenario">
                Scenario
              </label>
              <textarea
                id="scenario"
                name="scenario"
                value={formState.scenario}
                onChange={(event) => setFormState((prev) => ({ ...prev, scenario: event.target.value }))}
                rows={2}
                disabled={!canEdit}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="priority">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, priority: event.target.value as TestCasePriority }))
                  }
                  disabled={!canEdit}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  {Object.values(TestCasePriority).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formState.status}
                  onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as TestCaseStatus }))}
                  disabled={!canEdit}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  {Object.values(TestCaseStatus).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="mt-2 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting || !canEdit}>
                {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
