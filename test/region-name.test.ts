import { describe, it, expect } from "vitest";
import {
  regionName,
  formatRegionName,
  PROC_ADORNMENTS,
} from "../src/region-name.js";
import { readFileSync } from "fs";
import { join } from "path";

describe("regionName", () => {
  it("matches Python test case: Jeffriy Instability", () => {
    expect(regionName(0x01fbff285671n, 9)).toBe("Jeffriy Instability");
  });

  it("matches all nms_namegen region_names fixture", () => {
    const fixturePath = join(
      __dirname,
      "../nms_namegen/test/fixtures/region_names.json",
    );
    const fixtures: Record<string, string> = JSON.parse(
      readFileSync(fixturePath, "utf8"),
    );

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
