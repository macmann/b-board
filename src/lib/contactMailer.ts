import nodemailer from "nodemailer";

type ContactPayload = {
  fullName: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
  ip?: string;
  userAgent?: string;
};

const getEnv = (key: string) => process.env[key];

const buildTransport = () => {
  const host = getEnv("SMTP_HOST");
  const portValue = getEnv("SMTP_PORT");
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");

  if (!host || !portValue || !user || !pass) {
    throw new Error("SMTP configuration is incomplete for contact email.");
  }

  const port = Number(portValue);

  if (Number.isNaN(port)) {
    throw new Error("SMTP_PORT must be a number.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export async function sendContactEmail(payload: ContactPayload) {
  const transporter = buildTransport();
  const to = getEnv("CONTACT_TO") ?? "admin@bboard.site";
  const from = getEnv("SMTP_FROM") ?? "B Board <no-reply@bboard.site>";

  const timestamp = new Date().toISOString();
  const companyLine = payload.company ? `Company: ${payload.company}\n` : "";
  const ipLine = payload.ip ? `IP: ${payload.ip}\n` : "";
  const userAgentLine = payload.userAgent ? `User-Agent: ${payload.userAgent}\n` : "";

  const text =
    `New contact request on B Board marketing site\n\n` +
    `Name: ${payload.fullName}\n` +
    `Email: ${payload.email}\n` +
    companyLine +
    `Subject: ${payload.subject}\n` +
    `Message:\n${payload.message}\n\n` +
    `Submitted at: ${timestamp}\n` +
    ipLine +
    userAgentLine;

  await transporter.sendMail({
    from,
    to,
    replyTo: payload.email,
    subject: `[Contact] ${payload.subject} — ${payload.fullName}`,
    text,
  });
}
