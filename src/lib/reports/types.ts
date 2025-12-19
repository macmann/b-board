export type ReportFilter = {
  from: Date;
  to: Date;
  projectId?: string | null;
};

export type EmptyState = {
  isEmpty: boolean;
  reason?: string;
};
