import nodemailer from "nodemailer";

import type { EmailProviderType } from "./prismaEnums";

export type EmailSettings = {
  providerType: EmailProviderType | null;
  fromName?: string | null;
  fromEmail?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  apiUrl?: string | null;
  apiKey?: string | null;
};

export type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const buildFromField = (fromName?: string | null, fromEmail?: string | null) => {
  if (!fromEmail) return undefined;
  if (fromName) return `${fromName} <${fromEmail}>`;
  return fromEmail;
};

const validateSettings = (settings: EmailSettings) => {
  if (!settings.providerType) {
    throw new Error("Email provider is not configured.");
  }

  if (!settings.fromEmail) {
    throw new Error("A from email address is required to send messages.");
  }

  if (settings.providerType === "SMTP") {
    if (!settings.smtpHost || !settings.smtpPort) {
      throw new Error("SMTP host and port are required for SMTP email.");
    }
  }

  if (settings.providerType === "API") {
    if (!settings.apiUrl || !settings.apiKey) {
      throw new Error("API URL and API key are required for API email.");
    }
  }
};

export const sendEmail = async (
  settings: EmailSettings,
  payload: SendEmailPayload
): Promise<void> => {
  validateSettings(settings);

  const from = buildFromField(settings.fromName, settings.fromEmail);

  if (settings.providerType === "SMTP") {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost ?? undefined,
      port: settings.smtpPort ?? 587,
      secure: (settings.smtpPort ?? 0) === 465,
      auth:
        settings.smtpUsername && settings.smtpPassword
          ? {
              user: settings.smtpUsername,
              pass: settings.smtpPassword,
            }
          : undefined,
    });

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return;
  }

  if (settings.providerType === "API") {
    const response = await fetch(settings.apiUrl ?? "", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        to: payload.to,
        from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || `Email provider responded with status ${response.status}`
      );
    }

    return;
  }

  throw new Error("Unsupported email provider type.");
};
