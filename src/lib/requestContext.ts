import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { Role } from "./prismaEnums";

export type RequestContext = {
  requestId: string;
  userId?: string;
  roles?: Role[];
  ip?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

const getHeaderValue = (request: NextRequest | Request | undefined, key: string) => {
  try {
    const headers = (request as any)?.headers;
    if (!headers) return undefined;
    if (typeof headers.get === "function") {
      return headers.get(key) ?? undefined;
    }
    return headers[key] ?? headers[key.toLowerCase()];
  } catch (error) {
    return undefined;
  }
};

const extractContextFromRequest = (
  request?: NextRequest | Request
): Omit<RequestContext, "requestId"> => {
  const forwardedFor = getHeaderValue(request, "x-forwarded-for");
  const ip =
    (typeof forwardedFor === "string" && forwardedFor.split(",")[0].trim()) ||
    (request as any)?.ip ||
    undefined;
  const userAgent = getHeaderValue(request, "user-agent") ?? undefined;

  return {
    ip,
    userAgent,
  };
};

export function withRequestContext<T>(
  request: NextRequest | Request | undefined,
  handler: () => T | Promise<T>,
  overrides: Partial<RequestContext> = {}
): T | Promise<T> {
  const base: RequestContext = {
    requestId: overrides.requestId ?? getHeaderValue(request, "x-request-id") ?? randomUUID(),
    ...extractContextFromRequest(request),
    ...overrides,
  };

  return storage.run(base, handler);
}

export function setRequestContext(partial: Partial<RequestContext>) {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, partial);
}

export function setRequestContextUser(userId?: string, roles?: Role[]) {
  setRequestContext({ userId, ...(roles ? { roles } : {}) });
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
