import type { ProjectSettings } from "@prisma/client";
import type { IssueStatus } from "./prismaEnums";
import { sendEmail } from "./email";

type ProjectInfo = {
  name: string;
  settings: ProjectSettings | null;
};

type IssueInfo = {
  id: string;
  key: string | null;
  title: string;
  status: IssueStatus;
};

type UserInfo = {
  name: string | null;
  email: string | null;
};

type AssigneeNotificationParams = {
  project: ProjectInfo;
  issue: IssueInfo;
  assignee: UserInfo | null;
};

const buildIssueLabel = (issue: IssueInfo) =>
  issue.key ? `${issue.key} · ${issue.title}` : issue.title;

export const sendAssigneeNotification = async ({
  project,
  issue,
  assignee,
}: AssigneeNotificationParams) => {
  if (!project.settings?.emailProvider) return;
  if (!project.settings.emailFromAddress) return;
  if (project.settings.emailAssignmentNotifications === false) return;
  if (!assignee?.email) return;

  const subject = `[B Board] New assignment: ${buildIssueLabel(issue)}`;
  const statusLine = `Status: ${issue.status}`;
  const text = [
    `Hi ${assignee.name ?? "there"},`,
    "",
    `You've been assigned to "${issue.title}" in ${project.name}.`,
    statusLine,
    "",
    "Log in to view the ticket details.",
  ].join("\n");

  const html = `
    <p>Hi ${assignee.name ?? "there"},</p>
    <p>You've been assigned to "<strong>${issue.title}</strong>" in <strong>${project.name}</strong>.</p>
    <p><strong>${statusLine}</strong></p>
    <p>Log in to view the ticket details.</p>
  `;

  await sendEmail(
    {
      providerType: project.settings.emailProvider,
      fromName: project.settings.emailFromName,
      fromEmail: project.settings.emailFromAddress,
      smtpHost: project.settings.smtpHost,
      smtpPort: project.settings.smtpPort,
      smtpUsername: project.settings.smtpUsername,
      smtpPassword: project.settings.smtpPassword,
      apiUrl: project.settings.apiUrl,
      apiKey: project.settings.apiKey,
    },
    {
      to: assignee.email,
      subject,
      text,
      html,
    }
  );
};
