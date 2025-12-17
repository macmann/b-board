import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from "@/lib/prismaEnums";

import { type BacklogTableIssue } from "./BacklogTable";

export type BacklogFilters = {
  statuses: IssueStatus[];
  assignees: string[];
  types: IssueType[];
  priorities: IssuePriority[];
  epics: string[];
  search: string;
};

export const UNASSIGNED_FILTER_VALUE = "unassigned";

export const defaultBacklogFilters: BacklogFilters = {
  statuses: [],
  assignees: [],
  types: [],
  priorities: [],
  epics: [],
  search: "",
};

export const normalizeSearch = (value: string) => value.trim().toLowerCase();

export function issueMatchesFilters(
  issue: BacklogTableIssue,
  filters: BacklogFilters,
  searchTerm: string
) {
  const statusMatch =
    filters.statuses.length === 0 || filters.statuses.includes(issue.status);

  const assigneeMatch =
    filters.assignees.length === 0 ||
    (issue.assignee
      ? filters.assignees.includes(issue.assignee.id)
      : filters.assignees.includes(UNASSIGNED_FILTER_VALUE));

  const typeMatch =
    filters.types.length === 0 || filters.types.includes(issue.type);

  const priorityMatch =
    filters.priorities.length === 0 ||
    filters.priorities.includes(issue.priority);

  const epicMatch =
    filters.epics.length === 0 ||
    (issue.epic ? filters.epics.includes(issue.epic.id) : false);

  const normalizedSearch = normalizeSearch(searchTerm);
  const searchMatch =
    normalizedSearch.length === 0 ||
    issue.title.toLowerCase().includes(normalizedSearch) ||
    (issue.key ? issue.key.toLowerCase().includes(normalizedSearch) : false);

  return (
    statusMatch &&
    assigneeMatch &&
    typeMatch &&
    priorityMatch &&
    epicMatch &&
    searchMatch
  );
}
