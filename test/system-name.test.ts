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
import {
  GALAXY,
  PORTAL,
  EXPECTED_SYSTEM_NAME,
  EXPECTED_REGION_NAME,
  EXPECTED_PLANET_COUNT,
  EXPECTED_MOON_COUNT,
  EXPECTED_PLANET_SEEDS,
  EXPECTED_SYSTEM_ATTRIBUTES,
} from "./test-fixture.js";

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

  it("matches standard fixture portal code", () => {
    const seed = portalToSeed(PORTAL, GALAXY);
    expect(formatSystemName(seed)).toBe(EXPECTED_SYSTEM_NAME);
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

  it("generates correct names from standard fixture", () => {
    expect(systemName(PORTAL, GALAXY)).toBe(EXPECTED_SYSTEM_NAME);
    expect(regionName(PORTAL, GALAXY)).toBe(EXPECTED_REGION_NAME);
    expect(planetSeed(PORTAL, GALAXY)).toBe(EXPECTED_PLANET_SEEDS[1]!.seed);

    const sa = systemAttributes(PORTAL, GALAXY);
    expect(sa.planet_count).toBe(EXPECTED_SYSTEM_ATTRIBUTES.planet_count);
    expect(sa.prime_planet_count).toBe(EXPECTED_SYSTEM_ATTRIBUTES.prime_planet_count);
    expect(sa.safe_start_planet).toBe(EXPECTED_SYSTEM_ATTRIBUTES.safe_start_planet);

    const ps = planetSeeds(PORTAL, GALAXY);
    expect(ps.planet_count).toBe(EXPECTED_PLANET_COUNT);
    expect(ps.moon_count).toBe(EXPECTED_MOON_COUNT);
    expect(ps.planet_seeds.length).toBeGreaterThanOrEqual(EXPECTED_PLANET_COUNT);

    for (let i = 0; i < EXPECTED_PLANET_COUNT; i++) {
      expect(planetName(ps.planet_seeds[i]!)).toBe(EXPECTED_PLANET_SEEDS[i]!.name);
    }
  });
});
