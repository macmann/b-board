import { afterEach, describe, expect, it, vi } from "vitest";

const loadConfig = async () => import("../config/appConfig");

describe("appConfig", () => {
  afterEach(() => {
    delete process.env.HOMEPAGE_ENABLED;
    vi.resetModules();
  });

  it("treats missing env as disabled", async () => {
    const { homepageEnabled, isHomepageEnabled } = await loadConfig();

    expect(homepageEnabled).toBe(false);
    expect(isHomepageEnabled()).toBe(false);
  });

  it("enables homepage when env is 1", async () => {
    process.env.HOMEPAGE_ENABLED = "1";

    const { homepageEnabled, isHomepageEnabled } = await loadConfig();

    expect(homepageEnabled).toBe(true);
    expect(isHomepageEnabled()).toBe(true);
  });

  it("disables homepage for other values", async () => {
    process.env.HOMEPAGE_ENABLED = "0";

    const { homepageEnabled, isHomepageEnabled } = await loadConfig();

    expect(homepageEnabled).toBe(false);
    expect(isHomepageEnabled()).toBe(false);
  });
});
