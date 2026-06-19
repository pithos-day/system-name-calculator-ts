import { describe, it, expect } from "vitest";
import { formatSystemName } from "../src/system-name.js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Convert a portal code + galaxy to the 12-byte seed format
 * expected by formatSystemName.
 *
 * Python: galacticCoords = portal & 0xFFFFFFFF
 *         systemIndex    = ((portal & 0x0FFF00000000) >> 24) | galaxy
 *
 * TS:     galacticCoords = shl(seed, 4) = first 4 bytes
 *         systemIndex    = shr(seed, 4) = last 8 bytes
 */
function portalToSeed(portal: bigint, galaxy: number): number[] {
  const galacticCoords = portal & 0xFFFFFFFFn;
  const systemIndex =
    ((portal & 0x0fff00000000n) >> 24n) | BigInt(galaxy);

  const seed = new Array<number>(12).fill(0);

  for (let i = 0; i < 4; i++) {
    seed[i] = Number((galacticCoords >> BigInt(i * 8)) & 0xFFn);
  }
  for (let i = 0; i < 4; i++) {
    seed[4 + i] = Number((systemIndex >> BigInt(i * 8)) & 0xFFn);
  }

  return seed;
}

describe("formatSystemName", () => {
  it("returns a non-empty string", () => {
    const seed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = formatSystemName(seed);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("first letter is uppercase", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result = formatSystemName(seed);
    expect(result[0]).toBe(result[0]!.toUpperCase());
  });

  it("produces consistent output for same seed", () => {
    const seed = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const a = formatSystemName(seed);
    const b = formatSystemName(seed);
    expect(a).toBe(b);
  });

  it("produces different output for different seeds", () => {
    const seed1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const seed2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const a = formatSystemName(seed1);
    const b = formatSystemName(seed2);
    expect(a).not.toBe(b);
  });

  it("output length is between 1 and 20 characters", () => {
    for (let i = 0; i < 10; i++) {
      const seed = Array.from({ length: 12 }, (_, j) => (i * 7 + j * 13) % 256);
      const result = formatSystemName(seed);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(20);
    }
  });

  it("matches nms_namegen for known portal codes", () => {
    const cases: [bigint, number, string][] = [
      [0x100000000n, 0, "Vartau-Qul"],
      [0x35f3545c3en, 0, "Dentum-Tona"],
      [0x706050403020100n, 0, "Fitegratov"],
    ];
    for (const [portal, galaxy, expected] of cases) {
      const seed = portalToSeed(portal, galaxy);
      expect(formatSystemName(seed)).toBe(expected);
    }
  });

  it("matches all nms_namegen system_names fixture", () => {
    const fixturePath = join(
      __dirname,
      "../nms_namegen/test/fixtures/system_names.json",
    );
    const fixtures: [string, string, string][] = JSON.parse(
      readFileSync(fixturePath, "utf8"),
    );

    for (const [expectedName, _coords, portalHex] of fixtures) {
      const portal = BigInt("0x" + portalHex);
      const seed = portalToSeed(portal, 0);
      expect(formatSystemName(seed)).toBe(expectedName);
    }
  });
});
