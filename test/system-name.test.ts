import { describe, it, expect } from "vitest";
import { formatSystemName, systemName, portalToSeed } from "../src/system-name.js";
import {
  regionName,
  planetName,
  planetSeed,
  planetSeeds,
  systemAttributes,
} from "../src/index.js";
import { readFileSync } from "fs";
import { join } from "path";

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

  it("matches nms_namegen for full portal code verification", () => {
    const portal = 0x102dfc63c321n;
    const galaxy = 9;

    expect(systemName(portal, galaxy)).toBe("Desnoz-Gasu");
    expect(regionName(portal, galaxy)).toBe("Ejblifirtc");
    expect(planetSeed(portal, galaxy)).toBe(0x73d7e3db769c634bn);

    const sa = systemAttributes(portal, galaxy);
    expect(sa.planet_count).toBe(4);
    expect(sa.prime_planet_count).toBe(1);
    expect(sa.safe_start_planet).toBe(2);

    const ps = planetSeeds(portal, galaxy);
    expect(ps.planet_count).toBe(5);
    expect(ps.moon_count).toBe(0);
    expect(ps.planet_seeds.length).toBe(5);

    expect(planetName(ps.planet_seeds[0]!)).toBe("Toftusa E10");
    expect(planetName(ps.planet_seeds[1]!)).toBe("Asklepus P1");
    expect(planetName(ps.planet_seeds[2]!)).toBe("Tival Gamma");
    expect(planetName(ps.planet_seeds[3]!)).toBe("Roxandrac Zush");
    expect(planetName(ps.planet_seeds[4]!)).toBe("Ranianus D19");
  });
});
