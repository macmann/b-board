import { describe, expect, it } from "vitest";

import { toInputJsonValue } from "../json";

describe("toInputJsonValue", () => {
  it("returns serializable object unchanged", () => {
    const value = { a: 1, b: ["test"], nested: { ok: true } };

    const result = toInputJsonValue(value);

    expect(result).toEqual(value);
  });

  it("returns error object for circular reference", () => {
    const value: Record<string, unknown> = { name: "circular" };
    value.self = value;

    const result = toInputJsonValue(value);

    expect(result).toEqual({
      error: "NON_SERIALIZABLE_JSON",
      message: expect.stringContaining("Converting circular structure to JSON"),
    });
  });
});
