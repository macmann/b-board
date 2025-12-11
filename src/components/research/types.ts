import { ResearchStatus } from "@/lib/prismaEnums";

export type ResearchBacklogItem = {
  id: string;
  key: string;
  title: string;
  status: ResearchStatus;
  position?: number | null;
  researchType?: string | null;
  assignee?: { id: string; name: string } | null;
  dueDate?: string | Date | null;
  linkedIssuesCount?: number;
  updatedAt: string | Date;
};
