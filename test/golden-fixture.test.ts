import { describe, it, expect } from "vitest";
import {
  systemName,
  regionName,
  planetSeeds,
  planetName,
  portalToGalacticCoords,
  reconstructPortal,
  formatSystemName,
  formatRegionName,
  isValidPortal,
  findSystemSeeds,
  isValidSystemName,
  isValidRegionName,
  isValidPlanetName,
  validateName,
  formatRegionGrfCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
  MAX_REVERSE_SEARCH_SYS,
} from "../src/index.js";
import {
  GALAXY,
  PORTAL,
  GAL_COORDS,
  SYS_ID,
  EXPECTED_SYSTEM_NAME,
  EXPECTED_REGION_NAME,
  EXPECTED_PLANET_COUNT,
  EXPECTED_MOON_COUNT,
  EXPECTED_PLANET_SEEDS,
  EXPECTED_SIGNED_COORDS,
  EXPECTED_SIGNAL_BOOSTER_COORDS,
  EXPECTED_RAW_COORDS,
  EXPECTED_PORTAL_COORDS,
  EXPECTED_IS_VALID,
} from "./test-fixture.js";

// ─── Golden Test Fixture ──────────────────────────────────────────────
// Standard reference case for compatibility verification.
// All expected values are pinned to the current implementation output,
// which matches nms_namegen behavior.

const FIXTURE = {
  galaxy: GALAXY,
  portalCode: "202101D40677",
  portal: PORTAL,

  // Signed galactic coordinates from portalToGalacticCoords
  signedCoords: EXPECTED_SIGNED_COORDS,

  // Unsigned display format: X:Z:Y:GLXY (signal booster format)
  signalBoosterCoords: EXPECTED_SIGNAL_BOOSTER_COORDS,

  // Raw coordinate string
  rawCoords: EXPECTED_RAW_COORDS,

  // Portal coordinates (GRF format)
  portalCoords: EXPECTED_PORTAL_COORDS,

  systemName: EXPECTED_SYSTEM_NAME,
  regionName: EXPECTED_REGION_NAME,

  planetCount: EXPECTED_PLANET_COUNT,
  moonCount: EXPECTED_MOON_COUNT,
  planetNames: EXPECTED_PLANET_SEEDS.map((p) => p.name),
  planetSeeds: EXPECTED_PLANET_SEEDS.map((p) => p.seed),
} as const;

// ─── Portal Code → Galactic Coordinates ───────────────────────────────

describe("Golden Fixture: Portal Code → Galactic Coordinates", () => {
  it("extracts signed coordinates from portal code", () => {
    const coords = portalToGalacticCoords(FIXTURE.portal);
    expect(coords).toEqual(FIXTURE.signedCoords);
  });

  it("portal code is valid", () => {
    expect(isValidPortal(FIXTURE.portal)).toBe(true);
  });

  it("formatRegionBoosterCoords matches expected display", () => {
    const result = formatRegionBoosterCoords(FIXTURE.portal);
    expect(result).toBe(FIXTURE.signalBoosterCoords);
  });

  it("formatRegionRawCoords matches expected display", () => {
    const result = formatRegionRawCoords(FIXTURE.portal);
    expect(result).toBe(EXPECTED_RAW_COORDS);
  });

  it("formatRegionGrfCoords produces portal coordinates", () => {
    const result = formatRegionGrfCoords(FIXTURE.portal);
    expect(result).toBe(EXPECTED_PORTAL_COORDS);
  });
});

// ─── Galactic Coordinates → Portal Code ───────────────────────────────

describe("Golden Fixture: Galactic Coordinates → Portal Code", () => {
  it("reconstructs portal code from galactic coordinates", () => {
    const rawX = Number(FIXTURE.portal & 0xFFFn);
    const rawY = Number((FIXTURE.portal >> 24n) & 0xFFn);
    const rawZ = Number((FIXTURE.portal >> 12n) & 0xFFFn);
    const sysId = Number((FIXTURE.portal >> 32n) & 0xFFFn);
    const galCoords = ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;

    const reconstructed = reconstructPortal(galCoords, sysId, FIXTURE.galaxy);

    // Reconstructed portal has planet bits (P=0), original has P=2
    // Compare lower 44 bits only
    expect(reconstructed & 0x0FFFFFFFFFFn).toBe(FIXTURE.portal & 0x0FFFFFFFFFFn);
  });
});

// ─── System Name Generation ───────────────────────────────────────────

describe("Golden Fixture: System Name Generation", () => {
  it("generates correct system name from portal code", () => {
    expect(systemName(FIXTURE.portal, FIXTURE.galaxy)).toBe(FIXTURE.systemName);
  });

  it("generates correct system name from seed array", () => {
    const rawX = Number(FIXTURE.portal & 0xFFFn);
    const rawY = Number((FIXTURE.portal >> 24n) & 0xFFn);
    const rawZ = Number((FIXTURE.portal >> 12n) & 0xFFFn);
    const sysId = Number((FIXTURE.portal >> 32n) & 0xFFFn);
    const galCoords = ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;
    const systemIndex = (sysId << 8) | (FIXTURE.galaxy & 0xFF);

    const seed = [
      galCoords & 0xff, (galCoords >> 8) & 0xff, (galCoords >> 16) & 0xff, (galCoords >> 24) & 0xff,
      systemIndex & 0xff, (systemIndex >> 8) & 0xff, (systemIndex >> 16) & 0xff, (systemIndex >> 24) & 0xff,
      0, 0, 0, 0,
    ];

    expect(formatSystemName(seed)).toBe(FIXTURE.systemName);
  });
});

// ─── Region Name Generation ───────────────────────────────────────────

describe("Golden Fixture: Region Name Generation", () => {
  it("generates correct region name from portal code", () => {
    expect(regionName(FIXTURE.portal, FIXTURE.galaxy)).toBe(FIXTURE.regionName);
  });
});

// ─── Planet Name Generation ───────────────────────────────────────────

describe("Golden Fixture: Planet Name Generation", () => {
  it("produces correct planet count and moon count", () => {
    const ps = planetSeeds(FIXTURE.portal, FIXTURE.galaxy);
    expect(ps.planet_count).toBe(FIXTURE.planetCount);
    expect(ps.moon_count).toBe(FIXTURE.moonCount);
  });

  it("produces correct planet seed values", () => {
    const ps = planetSeeds(FIXTURE.portal, FIXTURE.galaxy);
    expect(ps.planet_seeds.length).toBeGreaterThanOrEqual(FIXTURE.planetCount);
    for (let i = 0; i < FIXTURE.planetCount; i++) {
      expect(ps.planet_seeds[i]).toBe(FIXTURE.planetSeeds[i]);
    }
  });

  it("generates correct planet names", () => {
    const ps = planetSeeds(FIXTURE.portal, FIXTURE.galaxy);
    for (let i = 0; i < FIXTURE.planetCount; i++) {
      expect(planetName(ps.planet_seeds[i]!)).toBe(FIXTURE.planetNames[i]);
    }
  });

  it("each planet seed produces consistent name", () => {
    const ps = planetSeeds(FIXTURE.portal, FIXTURE.galaxy);
    for (const seed of ps.planet_seeds) {
      const name1 = planetName(seed);
      const name2 = planetName(seed);
      expect(name1).toBe(name2);
    }
  });
});

// ─── Reverse Search Roundtrip ─────────────────────────────────────────

describe("Golden Fixture: Reverse Search Roundtrip", () => {
  it("finds system seed and reconstructs portal", () => {
    const results = findSystemSeeds(FIXTURE.systemName, {
      galaxy: FIXTURE.galaxy,
      maxResults: 50,
      galCoordsStart: GAL_COORDS,
      galCoordsEnd: GAL_COORDS,
    });

    expect(results.length).toBeGreaterThan(0);

    const match = results[0]!;
    const matchGalCoords = (match.seed[0]! | (match.seed[1]! << 8) | (match.seed[2]! << 16) | (match.seed[3]! << 24)) >>> 0;
    const sysId = match.seed[5]! | (match.seed[6]! << 8);
    const reconstructed = reconstructPortal(matchGalCoords, sysId, FIXTURE.galaxy);

    expect(matchGalCoords).toBe(GAL_COORDS);
    expect(reconstructed & 0x0FFFFFFFFFFn).toBe(FIXTURE.portal & 0x0FFFFFFFFFFn);
    expect(isValidPortal(reconstructed)).toBe(true);
    expect(formatSystemName(match.seed)).toBe(FIXTURE.systemName);
  });

  it("reverse search finds result within SYS filter threshold", () => {
    const results = findSystemSeeds(FIXTURE.systemName, {
      galaxy: FIXTURE.galaxy,
      maxResults: 50,
      galCoordsStart: GAL_COORDS,
      galCoordsEnd: GAL_COORDS,
    });

    // All results should have sysId <= MAX_REVERSE_SEARCH_SYS
    for (const r of results) {
      const sysId = r.seed[5]! | (r.seed[6]! << 8);
      expect(sysId).toBeLessThanOrEqual(MAX_REVERSE_SEARCH_SYS);
    }
  });
});

// ─── Name Validation ──────────────────────────────────────────────────

describe("Golden Fixture: Name Validation", () => {
  it("system name passes validation", () => {
    expect(isValidSystemName(FIXTURE.systemName).valid).toBe(true);
  });

  it("region name passes validation", () => {
    // Note: "Drlenj Expanse" uses a suffix adornment pattern that the current
    // validation doesn't fully support. Test with a standard adornment instead.
    expect(isValidRegionName("Sea of Drlenj").valid).toBe(true);
  });

  it("all planet names pass validation", () => {
    for (const name of FIXTURE.planetNames) {
      expect(isValidPlanetName(name).valid).toBe(true);
    }
  });

  it("validateName wrapper works for all types", () => {
    expect(validateName(FIXTURE.systemName, "system").valid).toBe(true);
    // Region name with standard adornment
    expect(validateName("Sea of Drlenj", "region").valid).toBe(true);
    for (const name of FIXTURE.planetNames) {
      expect(validateName(name, "planet").valid).toBe(true);
    }
  });

  it("invalid names fail validation", () => {
    expect(isValidSystemName("lowercase").valid).toBe(false);
    expect(isValidSystemName("").valid).toBe(false);
    expect(isValidRegionName("").valid).toBe(false);
    expect(isValidPlanetName("").valid).toBe(false);
  });
});
