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

  const isSmtpProvider =
    settings.providerType === "SMTP" ||
    settings.providerType === "MS365" ||
    settings.providerType === "GOOGLE_MAIL";

  if (isSmtpProvider) {
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

export type SendEmailOptions = {
  requestId?: string;
  enableVerify?: boolean;
};

export type SendEmailResult = {
  messageId?: string;
  response?: string;
  verified?: boolean;
};

type NodemailerError = Error & {
  code?: string;
  command?: string;
  response?: string;
  responseCode?: number;
};

const maskValue = (value?: string | null) => {
  if (!value) return value;
  if (value.length <= 2) return "*".repeat(value.length);
  return `${value.slice(0, 1)}***${value.slice(-1)}`;
};

const logTransportEvent = (
  level: "info" | "error",
  message: string,
  options?: { requestId?: string; meta?: Record<string, unknown> }
) => {
  const payload = {
    level,
    message,
    requestId: options?.requestId,
    timestamp: new Date().toISOString(),
    ...options?.meta,
  };

  const logger = level === "error" ? console.error : console.info;
  logger(payload);
};

const getSmtpHint = (error: NodemailerError) => {
  switch (error.code) {
    case "EAUTH":
      return "SMTP auth failed. Check username/password.";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "SMTP host unreachable. Check host/port/network.";
    case "ECONNECTION":
    case "ETIMEDOUT":
    case "ESOCKET":
      return "SMTP server timeout. Check connectivity and firewall.";
    default:
      return undefined;
  }
};

export const sendEmail = async (
  settings: EmailSettings,
  payload: SendEmailPayload,
  options: SendEmailOptions = {}
): Promise<SendEmailResult> => {
  validateSettings(settings);

  const from = buildFromField(settings.fromName, settings.fromEmail);

  const isSmtpProvider =
    settings.providerType === "SMTP" ||
    settings.providerType === "MS365" ||
    settings.providerType === "GOOGLE_MAIL";

  if (isSmtpProvider) {
    const port = settings.smtpPort ?? 587;
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost ?? undefined,
      port,
      secure: port === 465,
      requireTLS: port === 587 ? true : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth:
        settings.smtpUsername && settings.smtpPassword
          ? {
              user: settings.smtpUsername,
              pass: settings.smtpPassword,
            }
          : undefined,
    });

    logTransportEvent("info", "SMTP transporter configured", {
      requestId: options.requestId,
      meta: {
        host: settings.smtpHost,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        user: maskValue(settings.smtpUsername),
        from,
      },
    });

    if (options.enableVerify) {
      try {
        await transporter.verify();
        logTransportEvent("info", "SMTP transporter verified", {
          requestId: options.requestId,
        });
      } catch (error) {
        logTransportEvent("error", "SMTP transporter verification failed", {
          requestId: options.requestId,
          meta: { error },
        });
        throw error as NodemailerError;
      }
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      logTransportEvent("info", "SMTP message sent", {
        requestId: options.requestId,
        meta: { messageId: info.messageId, response: info.response },
      });

      return { messageId: info.messageId, response: info.response };
    } catch (error) {
      const err = error as NodemailerError;
      logTransportEvent("error", "SMTP send failed", {
        requestId: options.requestId,
        meta: {
          code: err.code,
          command: err.command,
          response: err.response,
          responseCode: err.responseCode,
          stack: err.stack,
        },
      });

      err.message = err.message || "Unable to send email via SMTP.";
      throw err;
    }
  }

  if (settings.providerType === "API") {
    logTransportEvent("info", "Sending email via API provider", {
      requestId: options.requestId,
      meta: { url: settings.apiUrl },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(settings.apiUrl ?? "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        signal: controller.signal,
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

      logTransportEvent("info", "API email sent", {
        requestId: options.requestId,
        meta: { status: "ok" },
      });

      return {};
    } catch (error) {
      logTransportEvent("error", "API email send failed", {
        requestId: options.requestId,
        meta: { error },
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Unsupported email provider type.");
};

export const getEmailErrorHint = (error: unknown) => {
  const nodemailerError = error as NodemailerError | undefined;
  if (!nodemailerError) return undefined;

  if (nodemailerError.code) {
    return getSmtpHint(nodemailerError);
  }

  return undefined;
};
