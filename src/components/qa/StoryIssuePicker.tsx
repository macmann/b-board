import { useEffect, useMemo, useState } from "react";
import type { Issue } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import type { IssueSummary } from "./TestCaseList";

type StoryIssuePickerProps = {
  projectId: string;
  value: string | null;
  onChange: (issueId: string | null, summary?: IssueSummary | null) => void;
  initialStory?: IssueSummary | null;
  disabled?: boolean;
};

type IssueSearchResult = Pick<Issue, "id" | "key" | "title">;

export function StoryIssuePicker({
  projectId,
  value,
  onChange,
  initialStory,
  disabled = false,
}: StoryIssuePickerProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [results, setResults] = useState<IssueSearchResult[]>([]);
  const [selected, setSelected] = useState<IssueSummary | null>(initialStory ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setSelected(initialStory ?? null);
    if (initialStory) {
      setSearchTerm(initialStory.key ?? initialStory.title ?? "");
    }
  }, [initialStory?.id]);

  const debouncedTerm = useMemo(() => searchTerm.trim(), [searchTerm]);

  useEffect(() => {
    if (!debouncedTerm) {
      setResults([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setError("");

      try {
        const response = await fetch(
          `/api/projects/${projectId}/standup/search-issues?query=${encodeURIComponent(
            debouncedTerm
          )}&take=10`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Failed to search issues (${response.status})`);
        }

        const data = (await response.json()) as IssueSearchResult[];
        setResults(data);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          console.error("[StoryIssuePicker] search error", searchError);
          setError("Unable to search issues right now.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [debouncedTerm, projectId]);

  const handleSelect = (issue: IssueSearchResult) => {
    const summary: IssueSummary = {
      id: issue.id,
      key: issue.key ?? null,
      title: issue.title ?? null,
    };

    setSelected(summary);
    setSearchTerm(issue.key ?? issue.title ?? "");
    onChange(issue.id, summary);
    setResults([]);
  };

  const handleClear = () => {
    setSelected(null);
    setSearchTerm("");
    onChange(null, null);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700" htmlFor="storyIssue">
        Story (optional)
      </label>
      {selected && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">{selected.key ?? "Story"}</p>
            {selected.title && <p className="text-xs text-slate-500 line-clamp-2">{selected.title}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={disabled}>
            Clear
          </Button>
        </div>
      )}
      <input
        id="storyIssue"
        name="storyIssue"
        placeholder="Search issues by key or title"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        disabled={disabled}
        className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      {isSearching && (
        <p className="text-xs text-slate-500">Searching…</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {results.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200 shadow-sm">
          {results.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => handleSelect(issue)}
              className="flex w-full flex-col items-start gap-1 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0 disabled:cursor-not-allowed"
              disabled={disabled}
            >
              <span className="text-sm font-semibold text-slate-900">{issue.key ?? "Issue"}</span>
              {issue.title && <span className="text-xs text-slate-600">{issue.title}</span>}
            </button>
          ))}
        </div>
      )}
      {value && !selected && (
        <p className="text-xs text-slate-500">Linked story will be updated on save.</p>
      )}
    </div>
  );
}
