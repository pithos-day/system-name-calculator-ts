import { describe, it, expect } from "vitest";
import {
  regionName,
  formatRegionName,
  PROC_ADORNMENTS,
} from "../src/region-name.js";
import {
  GALAXY,
  PORTAL,
  EXPECTED_REGION_NAME,
} from "./test-fixture.js";

describe("regionName", () => {
  it("matches standard fixture portal code", () => {
    expect(regionName(PORTAL, GALAXY)).toBe(EXPECTED_REGION_NAME);
  });

  it("matches all nms_namegen region_names fixture", async () => {
    let readFileSync: (path: string, encoding: BufferEncoding) => string;
    let join: (...parts: string[]) => string;
    try {
      readFileSync = (await import("fs")).readFileSync;
      join = (await import("path")).join;
    } catch {
      return; // Skip if fs/path unavailable (browser environment)
    }
    const fixturePath = join(
      new URL(".", import.meta.url).pathname,
      "../nms_namegen/test/fixtures/region_names.json",
    );
    let raw: string;
    try {
      raw = readFileSync(fixturePath, "utf8");
    } catch {
      return; // Skip if fixture file not found
    }
    const fixtures: Record<string, string> = JSON.parse(raw);

    for (const [grf, expectedName] of Object.entries(fixtures)) {
      const grfBigInt = BigInt(grf);
      const portal_code = grfBigInt & 0xFFFFFFFFn;
      const galaxy = Number(grfBigInt >> 32n);
      expect(regionName(portal_code, galaxy)).toBe(expectedName);
    }
  });
});

describe("formatRegionName (legacy)", () => {
  it("returns a non-empty string", () => {
    const seed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = formatRegionName(seed);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("first letter is uppercase", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = formatRegionName(seed);
    expect(result[0]).toBe(result[0]!.toUpperCase());
  });

  it("produces consistent output for same seed", () => {
    const seed = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const a = formatRegionName(seed);
    const b = formatRegionName(seed);
    expect(a).toBe(b);
  });

  it("produces different output for different seeds", () => {
    const seed1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const seed2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const a = formatRegionName(seed1);
    const b = formatRegionName(seed2);
    expect(a).not.toBe(b);
  });
});

describe("PROC_ADORNMENTS", () => {
  it("has 20 adornments", () => {
    expect(PROC_ADORNMENTS.length).toBe(20);
  });

  it("all contain {} placeholder", () => {
    for (const adorn of PROC_ADORNMENTS) {
      expect(adorn).toContain("{}");
    }
  });
});
