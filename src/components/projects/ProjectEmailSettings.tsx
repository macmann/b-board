"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import { ProjectRole } from "@/lib/roles";
import { EmailProviderType } from "@/lib/prismaEnums";

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50";

const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

const EMAIL_REGEX = /.+@.+\..+/i;

const SMTP_PRESETS: Partial<
  Record<ProviderType, { label: string; smtpHost: string; smtpPort: number }>
> = {
  [EmailProviderType.MS365]: {
    label: "Microsoft 365 (SMTP)",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
  [EmailProviderType.GOOGLE_MAIL]: {
    label: "Google Mail (SMTP)",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
  },
};

const isSmtpProvider = (providerType: ProviderType | null) =>
  providerType === EmailProviderType.SMTP ||
  providerType === EmailProviderType.MS365 ||
  providerType === EmailProviderType.GOOGLE_MAIL;

type ProviderType = keyof typeof EmailProviderType;

type EmailSettingsResponse = {
  providerType: ProviderType | null;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number | null;
  smtpUsername: string;
  apiUrl: string;
  hasSmtpPassword: boolean;
  hasApiKey: boolean;
};

type ProjectEmailSettingsProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

export default function ProjectEmailSettings({
  projectId,
  projectRole,
}: ProjectEmailSettingsProps) {
  const [settings, setSettings] = useState<EmailSettingsResponse>({
    providerType: null,
    fromName: "",
    fromEmail: "",
    smtpHost: "",
    smtpPort: null,
    smtpUsername: "",
    apiUrl: "",
    hasSmtpPassword: false,
    hasApiKey: false,
  });
  const [smtpPassword, setSmtpPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const canManage = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  const loadSettings = async () => {
    if (!canManage) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/settings/email`);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Unable to load email settings.");
      }

      const data = (await response.json()) as EmailSettingsResponse;
      setSettings(data);
      setSmtpPassword("");
      setApiKey("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading settings."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, canManage]);

  const handleProviderChange = (value: string) => {
    const providerType = (value as ProviderType | "") || null;

    setSettings((prev) => {
      const preset = providerType ? SMTP_PRESETS[providerType] : null;

      return {
        ...prev,
        providerType,
        smtpHost: preset?.smtpHost ?? prev.smtpHost,
        smtpPort: preset?.smtpPort ?? prev.smtpPort,
      };
    });
  };

  const validateSettings = (): string | null => {
    if (!settings.providerType) return null;

    if (!settings.fromEmail) {
      return "From email is required when configuring email.";
    }

    if (!EMAIL_REGEX.test(settings.fromEmail)) {
      return "Enter a valid from email address.";
    }

    if (isSmtpProvider(settings.providerType)) {
      if (!settings.smtpHost) return "SMTP host is required for SMTP.";
      if (!settings.smtpPort || Number.isNaN(settings.smtpPort)) {
        return "SMTP port must be provided.";
      }
      if (settings.smtpPort <= 0) {
        return "SMTP port must be a positive number.";
      }
    }

    if (settings.providerType === EmailProviderType.API) {
      if (!settings.apiUrl) return "API URL is required for API email.";
    }

    return null;
  };

  const handleSaveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    setIsSaving(true);
    setStatus(null);
    setError(null);

    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/settings/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          smtpPort: settings.smtpPort ?? undefined,
          smtpPassword: smtpPassword || undefined,
          apiKey: apiKey || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to save email settings.");
      }

      const data = (await response.json()) as EmailSettingsResponse;
      setSettings(data);
      setStatus("Email settings saved.");
      setSmtpPassword("");
      setApiKey("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving settings."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    setInviteStatus(null);
    setError(null);

    const targetEmail = inviteEmail.trim();

    if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
      setInviteStatus("Enter a valid recipient email.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      25_000
    );

    setIsSending(true);

    const requestStartedAt = new Date().toISOString();
    if (process.env.NODE_ENV !== "production") {
      console.info("[send-invite] start", { email: targetEmail, requestStartedAt });
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/email/send-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? "Failed to send invite email.";
        const requestIdText = data?.requestId
          ? ` Request ID: ${data.requestId}.`
          : "";
        throw new Error(`${message}${requestIdText}`);
      }

      const data = await response.json();
      const requestIdText = data?.requestId ? ` Request ID: ${data.requestId}.` : "";
      setInviteStatus(
        data?.message
          ? `${data.message}${requestIdText}`
          : `Invite sent successfully.${requestIdText}`
      );
      setInviteEmail("");

      if (process.env.NODE_ENV !== "production") {
        console.info("[send-invite] completed", {
          email: targetEmail,
          status: response.status,
        });
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const message = isAbort
        ? "Request timed out. Check server logs."
        : err instanceof Error
          ? err.message
          : "An unexpected error occurred while sending the invite.";

      if (process.env.NODE_ENV !== "production") {
        console.error("[send-invite] error", {
          email: targetEmail,
          error: err,
        });
      }

      setInviteStatus(message);
    } finally {
      clearTimeout(timeoutId);
      setIsSending(false);
    }
  };

  const disabled = !canManage || isLoading;

  return (
    <section
      id="email-settings"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Email settings
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure how board invitations are sent.
          </p>
        </div>
        <Button variant="ghost" onClick={loadSettings} disabled={isLoading || !canManage}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClasses} htmlFor="providerType">
              Email provider
            </label>
            <select
              id="providerType"
              value={settings.providerType ?? ""}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={disabled}
              className={inputClasses}
            >
              <option value="">Disabled</option>
              <option value={EmailProviderType.SMTP}>Custom SMTP</option>
              <option value={EmailProviderType.MS365}>
                {SMTP_PRESETS[EmailProviderType.MS365]?.label ?? "Microsoft 365 (SMTP)"}
              </option>
              <option value={EmailProviderType.GOOGLE_MAIL}>
                {SMTP_PRESETS[EmailProviderType.GOOGLE_MAIL]?.label ?? "Google Mail (SMTP)"}
              </option>
              <option value={EmailProviderType.API}>Custom API</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClasses} htmlFor="fromEmail">
              From email
            </label>
            <input
              id="fromEmail"
              type="email"
              value={settings.fromEmail}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, fromEmail: e.target.value }))
              }
              className={inputClasses}
              disabled={disabled}
              placeholder="notifications@yourdomain.com"
            />
          </div>

          <div className="space-y-1">
            <label className={labelClasses} htmlFor="fromName">
              From name (optional)
            </label>
            <input
              id="fromName"
              type="text"
              value={settings.fromName}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, fromName: e.target.value }))
              }
              className={inputClasses}
              disabled={disabled}
              placeholder="Board notifications"
            />
          </div>

          {isSmtpProvider(settings.providerType) && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="smtpHost">
                SMTP host
              </label>
              <input
                id="smtpHost"
                type="text"
                value={settings.smtpHost}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, smtpHost: e.target.value }))
                }
                className={inputClasses}
                disabled={disabled}
                placeholder="smtp.mailprovider.com"
              />
            </div>
          )}

          {isSmtpProvider(settings.providerType) && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="smtpPort">
                SMTP port
              </label>
              <input
                id="smtpPort"
                type="number"
                min={1}
                value={settings.smtpPort ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    smtpPort: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                  }))
                }
                className={inputClasses}
                disabled={disabled}
                placeholder="587"
              />
            </div>
          )}

          {isSmtpProvider(settings.providerType) && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="smtpUsername">
                SMTP username
              </label>
              <input
                id="smtpUsername"
                type="text"
                value={settings.smtpUsername}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, smtpUsername: e.target.value }))
                }
                className={inputClasses}
                disabled={disabled}
                placeholder="username"
              />
            </div>
          )}

          {isSmtpProvider(settings.providerType) && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="smtpPassword">
                SMTP password
              </label>
              <input
                id="smtpPassword"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className={inputClasses}
                disabled={disabled}
                placeholder={settings.hasSmtpPassword ? "••••••••" : "password"}
              />
              {settings.hasSmtpPassword && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leave blank to keep the existing password.
                </p>
              )}
            </div>
          )}

          {settings.providerType === EmailProviderType.API && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="apiUrl">
                API endpoint URL
              </label>
              <input
                id="apiUrl"
                type="url"
                value={settings.apiUrl}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, apiUrl: e.target.value }))
                }
                className={inputClasses}
                disabled={disabled}
                placeholder="https://api.emailservice.com/send"
              />
            </div>
          )}

          {settings.providerType === EmailProviderType.API && (
            <div className="space-y-1">
              <label className={labelClasses} htmlFor="apiKey">
                API key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClasses}
                disabled={disabled}
                placeholder={settings.hasApiKey ? "••••••••" : "api-key"}
              />
              {settings.hasApiKey && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leave blank to keep the existing API key.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Only project admins and product owners can manage email settings.
          </div>
          <Button type="submit" disabled={disabled || isSaving}>
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        </div>

        {status && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">
            {status}
          </div>
        )}
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Send board invite
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Send a one-time invite email using the configured provider.
        </p>

        <form onSubmit={handleSendInvite} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="grow space-y-1">
            <label className={labelClasses} htmlFor="inviteEmail">
              Recipient email
            </label>
            <input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={inputClasses}
              disabled={disabled}
              placeholder="teammate@company.com"
            />
          </div>
          <Button type="submit" disabled={disabled || isSending}>
            {isSending ? "Sending..." : "Send invite"}
          </Button>
        </form>

        {inviteStatus && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {inviteStatus}
          </div>
        )}
      </div>
    </section>
  );
}
