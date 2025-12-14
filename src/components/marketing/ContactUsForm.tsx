"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

const initialFormState = {
  fullName: "",
  email: "",
  company: "",
  subject: "",
  message: "",
};

type FormState = typeof initialFormState;
type FormErrors = Partial<Record<keyof FormState, string>>;

type StatusState = { type: "idle" | "success" | "error"; message: string };

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const emailPattern = /.+@.+\..+/i;

  if (!form.fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (form.fullName.length > 120) {
    errors.fullName = "Full name must be under 120 characters.";
  }

  if (!form.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(form.email)) {
    errors.email = "Enter a valid email address.";
  } else if (form.email.length > 150) {
    errors.email = "Email must be under 150 characters.";
  }

  if (form.company && form.company.length > 150) {
    errors.company = "Company name must be under 150 characters.";
  }

  if (!form.subject.trim()) {
    errors.subject = "Subject is required.";
  } else if (form.subject.length > 200) {
    errors.subject = "Subject must be under 200 characters.";
  }

  if (!form.message.trim()) {
    errors.message = "Message is required.";
  } else if (form.message.length > 1500) {
    errors.message = "Message must be under 1500 characters.";
  }

  return errors;
}

export function ContactUsForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data: { ok?: boolean; message?: string } | undefined = await response.json().catch(() => undefined);

      if (!response.ok || !data?.ok) {
        const message = data?.message ?? "We could not send your message. Please try again.";
        setStatus({ type: "error", message });
        return;
      }

      setStatus({ type: "success", message: "Thanks for reaching out! We'll respond shortly." });
      setForm(initialFormState);
      setErrors({});
    } catch (error) {
      console.error("Contact form submission failed", error);
      setStatus({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200/80 bg-white/80 shadow-lg backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
      <CardContent className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={form.fullName}
                onChange={handleChange("fullName")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="Alex Product"
              />
              {errors.fullName ? <p className="text-xs text-rose-500">{errors.fullName}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange("email")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="you@company.com"
              />
              {errors.email ? <p className="text-xs text-rose-500">{errors.email}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor="company">
                Company (optional)
              </label>
              <input
                id="company"
                name="company"
                type="text"
                value={form.company}
                onChange={handleChange("company")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="B Board"
              />
              {errors.company ? <p className="text-xs text-rose-500">{errors.company}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={form.subject}
                onChange={handleChange("subject")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="Requesting a demo"
              />
              {errors.subject ? <p className="text-xs text-rose-500">{errors.subject}</p> : null}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              value={form.message}
              onChange={handleChange("message")}
              className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              placeholder="Tell us about your team, use case, and timelines."
            />
            {errors.message ? <p className="text-xs text-rose-500">{errors.message}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              {status.type === "success" ? (
                <p className="text-emerald-600 dark:text-emerald-400">{status.message}</p>
              ) : status.type === "error" ? (
                <p className="text-rose-500">{status.message || "Something went wrong. Please try again."}</p>
              ) : hasErrors ? (
                <p className="text-rose-500">Please fix the highlighted fields.</p>
              ) : (
                <p>We respond within one business day.</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? "Sending..." : "Send message"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
