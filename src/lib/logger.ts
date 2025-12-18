import { getRequestContext } from "./requestContext";

type LogLevel = "info" | "error" | "debug";

const normalizeMeta = (meta?: unknown) => {
  if (!meta) return undefined;

  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      ...(process.env.NODE_ENV !== "production" && meta.stack
        ? { stack: meta.stack }
        : {}),
    };
  }

  if (
    typeof meta === "object" &&
    meta !== null &&
    "error" in meta &&
    (meta as { error?: unknown }).error instanceof Error
  ) {
    const { error, ...rest } = meta as { error?: Error } & Record<string, unknown>;

    return {
      ...rest,
      error: {
        name: error?.name,
        message: error?.message,
        ...(process.env.NODE_ENV !== "production" && error?.stack
          ? { stack: error.stack }
          : {}),
      },
    };
  }

  return meta;
};

const emit = (level: LogLevel, message: string, meta?: unknown) => {
  const context = getRequestContext();
  const payload: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context?.requestId ? { requestId: context.requestId } : {}),
    ...(context?.userId ? { userId: context.userId } : {}),
  };

  const normalizedMeta = normalizeMeta(meta);
  if (normalizedMeta !== undefined) {
    payload.meta = normalizedMeta;
  }

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "debug") {
    console.debug(payload);
    return;
  }

  console.info(payload);
};

export const logInfo = (message: string, meta?: unknown) => emit("info", message, meta);

export const logDebug = (message: string, meta?: unknown) => emit("debug", message, meta);

export const logError = (message: string, meta?: unknown) => emit("error", message, meta);
