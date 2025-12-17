import type { NextRequest } from "next/server";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalhostUrl = (value: string) => /localhost|127\.0\.0\.1/i.test(value);

export const resolveAppUrl = (request: NextRequest) => {
  const envUrl = process.env.APP_URL?.trim();

  if (envUrl) {
    const normalized = stripTrailingSlash(envUrl);

    if (process.env.NODE_ENV === "production" && isLocalhostUrl(normalized)) {
      throw new Error("APP_URL must not point to localhost in production.");
    }

    return normalized;
  }

  const derivedUrl = stripTrailingSlash(
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  );

  if (process.env.NODE_ENV === "production" && isLocalhostUrl(derivedUrl)) {
    throw new Error("APP_URL is required in production to generate invite links.");
  }

  return derivedUrl;
};
