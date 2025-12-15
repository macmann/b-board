import { Prisma } from "@prisma/client";

export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  // Ensure the value is JSON-serializable.
  // If it cannot be stringified, return a safe object describing the failure.
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch (e) {
    return {
      error: "NON_SERIALIZABLE_JSON",
      message: String(e),
    } as Prisma.InputJsonValue;
  }
}
