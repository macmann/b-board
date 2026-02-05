import { ResearchStatus } from "@/lib/prismaEnums";

import { type ResearchBacklogItem } from "./types";

export const UNASSIGNED_FILTER_VALUE = "unassigned";
export const GENERAL_RESEARCH_TYPE_VALUE = "general";

export type ResearchFilters = {
  statuses: ResearchStatus[];
  assignees: string[];
  types: string[];
  search: string;
};

export const defaultResearchFilters: ResearchFilters = {
  statuses: [],
  assignees: [],
  types: [],
  search: "",
};

const normalizeResearchType = (value?: string | null) =>
  value?.trim() ? value.trim() : GENERAL_RESEARCH_TYPE_VALUE;

export function researchMatchesFilters(
  item: ResearchBacklogItem,
  filters: ResearchFilters
) {
  if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
    return false;
  }

  if (filters.assignees.length > 0) {
    const assigneeId = item.assignee?.id ?? UNASSIGNED_FILTER_VALUE;
    if (!filters.assignees.includes(assigneeId)) {
      return false;
    }
  }

  if (filters.types.length > 0) {
    const typeValue = normalizeResearchType(item.researchType);
    if (!filters.types.includes(typeValue)) {
      return false;
    }
  }

  if (filters.search.trim()) {
    const searchValue = filters.search.trim().toLowerCase();
    const matches =
      item.title.toLowerCase().includes(searchValue) ||
      item.key.toLowerCase().includes(searchValue);
    if (!matches) return false;
  }

  return true;
}
