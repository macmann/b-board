import { sendContactEmail } from "@/lib/contactMailer";
import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

const sanitize = (value: string) => value.trim();

const getClientIdentifier = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
};

const isRateLimited = (identifier: string) => {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(identifier, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count += 1;
  rateLimitMap.set(identifier, entry);
  return false;
};

type ContactInput = {
  fullName: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

const validatePayload = (body: unknown): { errors: Record<string, string>; sanitized: ContactInput } => {
  const fallback: ContactInput = { fullName: "", email: "", company: "", subject: "", message: "" };

  if (typeof body !== "object" || body === null) {
    return { errors: { general: "Invalid payload." }, sanitized: fallback };
  }

  const payload = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const fullName = typeof payload.fullName === "string" ? sanitize(payload.fullName) : "";
  const email = typeof payload.email === "string" ? sanitize(payload.email) : "";
  const company = typeof payload.company === "string" ? sanitize(payload.company) : "";
  const subject = typeof payload.subject === "string" ? sanitize(payload.subject) : "";
  const message = typeof payload.message === "string" ? sanitize(payload.message) : "";

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length > 120) {
    errors.fullName = "Full name must be under 120 characters.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!/.+@.+\..+/.test(email)) {
    errors.email = "Please provide a valid email.";
  } else if (email.length > 150) {
    errors.email = "Email must be under 150 characters.";
  }

  if (company.length > 150) {
    errors.company = "Company must be under 150 characters.";
  }

  if (!subject) {
    errors.subject = "Subject is required.";
  } else if (subject.length > 200) {
    errors.subject = "Subject must be under 200 characters.";
  }

  if (!message) {
    errors.message = "Message is required.";
  } else if (message.length > 1500) {
    errors.message = "Message must be under 1500 characters.";
  }

  return {
    errors,
    sanitized: { fullName, email, company, subject, message },
  };
};

export async function POST(request: Request) {
  const clientIdentifier = getClientIdentifier(request);
  if (isRateLimited(clientIdentifier)) {
    return NextResponse.json(
      { ok: false, message: "Too many contact attempts. Please try again soon." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Failed to parse contact payload", error);
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const { errors, sanitized } = validatePayload(body);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: "Please provide the required fields.", errors },
      { status: 400 }
    );
  }

  try {
    await sendContactEmail({
      ...sanitized,
      ip: clientIdentifier,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send contact email", error);
    return NextResponse.json(
      { ok: false, message: "We could not send your message right now. Please try again." },
      { status: 500 }
    );
  }
}
