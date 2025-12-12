import { IssueHistoryField } from "./prismaEnums";

// Inline-editable fields for issues. Mapping ensures every editable field is tracked in history.
export type EditableIssuePatchField =
  | "type"
  | "status"
  | "priority"
  | "storyPoints"
  | "assigneeId"
  | "epicId";

export const EDITABLE_FIELD_TO_HISTORY_FIELD: Record<EditableIssuePatchField, IssueHistoryField> = {
  type: IssueHistoryField.TYPE,
  status: IssueHistoryField.STATUS,
  priority: IssueHistoryField.PRIORITY,
  storyPoints: IssueHistoryField.STORY_POINTS,
  assigneeId: IssueHistoryField.ASSIGNEE,
  epicId: IssueHistoryField.EPIC,
};
