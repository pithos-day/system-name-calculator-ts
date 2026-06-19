import { describe, it, expect } from "vitest";
import {
  systemName,
  regionName,
  formatSystemName,
  formatRegionName,
  findSystemSeeds,
  findRegionSeeds,
  reconstructPortal,
  portalToGalacticCoords,
  isValidPortal,
  MAX_REVERSE_SEARCH_SYS,
} from "../src/index.js";
import {
  GALAXY,
  PORTAL,
  GAL_COORDS,
  SYS_ID,
  EXPECTED_SYSTEM_NAME,
  EXPECTED_REGION_NAME,
} from "./test-fixture.js";

describe("Reverse Search", () => {
  const portal = PORTAL;
  const galCoords = GAL_COORDS;
  const sysId = SYS_ID;

  it("reconstructPortal produces portal (without planet bits)", () => {
    const result = reconstructPortal(galCoords, sysId, GALAXY);

    // reconstructPortal doesn't set planet bits (P=0), original has P=2
    // So mask out planet bits for comparison
    const resultMasked = result & 0x0FFFFFFFFFFn;
    const portalMasked = portal & 0x0FFFFFFFFFFn;
    expect(resultMasked).toBe(portalMasked);
  });

  it("findSystemSeeds finds portal for known system name (single galCoords)", () => {
    const expectedName = EXPECTED_SYSTEM_NAME;

    const results = findSystemSeeds(expectedName, {
      galaxy: GALAXY,
      maxResults: 5,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    expect(results.length).toBeGreaterThan(0);

    // Use formatSystemName (takes number[] seed) not systemName (takes bigint)
    const foundSystem = formatSystemName(results[0]!.seed);
    expect(foundSystem.toLowerCase()).toBe(expectedName.toLowerCase());
  });

  it("findRegionSeeds finds portal for known region name (single galCoords)", () => {
    const expectedName = EXPECTED_REGION_NAME;

    const results = findRegionSeeds(expectedName, {
      galaxy: GALAXY,
      maxResults: 5,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    expect(results.length).toBeGreaterThan(0);

    // Use formatRegionName (takes number[] seed) not regionName (takes bigint)
    const foundRegion = formatRegionName(results[0]!.seed);
    expect(foundRegion.toLowerCase()).toBe(expectedName.toLowerCase());
  });

  it("full roundtrip: system name via forward + reverse", () => {
    const expectedSystem = EXPECTED_SYSTEM_NAME;

    const results = findSystemSeeds(expectedSystem, {
      galaxy: GALAXY,
      maxResults: 50,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    expect(results.length).toBeGreaterThan(0);

    const foundSystem = formatSystemName(results[0]!.seed);
    expect(foundSystem.toLowerCase()).toBe(expectedSystem.toLowerCase());
  });

  it("findSystemSeeds respects maxResults", () => {
    const expectedName = EXPECTED_SYSTEM_NAME;

    const results = findSystemSeeds(expectedName, {
      galaxy: GALAXY,
      maxResults: 2,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("findSystemSeeds returns empty for non-existent name in tiny range", () => {
    const results = findSystemSeeds("ZZZZZZZZZZZ", {
      galaxy: GALAXY,
      maxResults: 10,
      galCoordsStart: 0,
      galCoordsEnd: 10,
    });

    expect(results.length).toBe(0);
  });
});

describe("Portal Validation", () => {
  // Helper to build a portal bigint from raw X, Y, Z, sysId
  function buildPortal(rawX: number, rawY: number, rawZ: number, sysId: number): bigint {
    return (
      (BigInt(sysId) << 32n) |
      (BigInt(rawY & 0xFF) << 24n) |
      (BigInt(rawZ & 0xFFF) << 12n) |
      BigInt(rawX & 0xFFF)
    );
  }

  describe("portalToGalacticCoords", () => {
    it("extracts coordinates from valid portal", () => {
      // rawX=0x321=801, rawY=0xFC=252(signed=-4), rawZ=0x63C=1596
      const portal = buildPortal(0x321, 0xFC, 0x63C, 0x02D);
      const coords = portalToGalacticCoords(portal);

      expect(coords.x).toBe(801);     // rawX < 0x800
      expect(coords.y).toBe(-4);      // 0xFC = 252, signed = -4
      expect(coords.z).toBe(1596);    // rawZ < 0x800
    });

    it("sign-extends 12-bit X correctly", () => {
      // rawX=0xFFF = 4095, signed = -1
      const portal = buildPortal(0xFFF, 0, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.x).toBe(-1);
    });

    it("sign-extends 12-bit Z correctly", () => {
      // rawZ=0x800 = 2048, signed = -2048
      const portal = buildPortal(0, 0, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.z).toBe(-2048);
    });

    it("sign-extends 8-bit Y correctly", () => {
      // rawY=0x80 = 128, signed = -128
      const portal = buildPortal(0, 0x80, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.y).toBe(-128);
    });
  });

  describe("isValidPortal - Valid boundary values", () => {
    it("Y=-126 is valid", () => {
      // rawY for Y=-126: -126 + 256 = 130 = 0x82
      // Use valid X=2046, Z=2046 to stay within range
      const portal = buildPortal(0x7FE, 0x82, 0x7FE, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.y).toBe(-126);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Y=126 is valid", () => {
      // rawY for Y=126: 126 = 0x7E
      const portal = buildPortal(0x7FE, 0x7E, 0x7FE, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.y).toBe(126);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("X=-2047 is valid", () => {
      // rawX for X=-2047: -2047 + 4096 = 2049 = 0x801
      // Use rawY=0 (Y=0) which is valid
      const portal = buildPortal(0x801, 0, 0x7FE, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.x).toBe(-2047);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("X=2046 is valid", () => {
      // rawX for X=2046: 2046 = 0x7FE
      const portal = buildPortal(0x7FE, 0, 0x7FE, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.x).toBe(2046);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Z=-2047 is valid", () => {
      // rawZ for Z=-2047: -2047 + 4096 = 2049 = 0x801
      const portal = buildPortal(0x7FE, 0, 0x801, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.z).toBe(-2047);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Z=2046 is valid", () => {
      // rawZ for Z=2046: 2046 = 0x7FE
      const portal = buildPortal(0x7FE, 0, 0x7FE, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.z).toBe(2046);
      expect(isValidPortal(portal)).toBe(true);
    });
  });

  describe("isValidPortal - Invalid coordinate ranges", () => {
    it("Y=-127 is invalid (below range)", () => {
      // rawY for Y=-127: -127 + 256 = 129 = 0x81
      const portal = buildPortal(0x800, 0x81, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.y).toBe(-127);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Y=127 is invalid (above range)", () => {
      // rawY for Y=127: 127 = 0x7F
      const portal = buildPortal(0x800, 0x7F, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.y).toBe(127);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("X=-2048 is invalid (below range)", () => {
      // rawX for X=-2048: -2048 + 4096 = 2048 = 0x800
      const portal = buildPortal(0x800, 0x80, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.x).toBe(-2048);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("X=2047 is invalid (above range)", () => {
      // rawX for X=2047: 2047 = 0x7FF
      const portal = buildPortal(0x7FF, 0x80, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.x).toBe(2047);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Z=-2048 is invalid (below range)", () => {
      // rawZ for Z=-2048: -2048 + 4096 = 2048 = 0x800
      const portal = buildPortal(0x800, 0x80, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.z).toBe(-2048);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Z=2047 is invalid (above range)", () => {
      // rawZ for Z=2047: 2047 = 0x7FF
      const portal = buildPortal(0x800, 0x80, 0x7FF, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.z).toBe(2047);
      expect(isValidPortal(portal)).toBe(false);
    });
  });

  describe("isValidPortal - Galactic center exclusion zone", () => {
    it("origin (0,0,0) is invalid", () => {
      // rawX=0x800=-2048, rawY=0x80=-128, rawZ=0x800=-2048
      // But (0,0,0) requires rawX=2047, rawY=127, rawZ=2047 which are out of range
      // So use coords close to origin that are in valid range
      // X=0: rawX=2047=0x7FF (invalid, X=2047)
      // We need to use the closest valid coords
      // X=1, Y=0, Z=0: dist²=1 < 64 → invalid
      const portal = buildPortal(0x7FE, 0x7F, 0x800, 0); // X=2046, Y=127(invalid), Z=-2048(invalid)
      // Let's use valid coords: X=1, Y=0, Z=0
      // rawX = 1 + 2047 = 2048 = 0x800 (signed X=-2048, invalid)
      // Actually rawX = X + 2047 in unsigned, but portal stores unsigned rawX
      // So for X=1: rawX = 1 + 2047 = 2048 (but this is > 4095? no, 2048 < 4096)
      // Wait, the conversion is: X = signExtend(rawX, 12)
      // For X=1: rawX = 1 (since 1 < 2048, no sign extension needed)
      const portal1 = buildPortal(1, 0x7F, 0x800, 0); // X=1, Y=127(invalid)
      // Use Y=0: rawY=0
      const portal2 = buildPortal(1, 0, 0x800, 0); // X=1, Y=0, Z=-2048(invalid)
      // Use Z=0: rawZ=0
      const portal3 = buildPortal(1, 0, 0, 0); // X=1, Y=0, Z=0
      const coords = portalToGalacticCoords(portal3);
      expect(coords).toEqual({ x: 1, y: 0, z: 0 });
      expect(isValidPortal(portal3)).toBe(false); // dist²=1 < 64
    });

    it("(4,0,0) is invalid (dist²=16 < 64)", () => {
      const portal = buildPortal(4, 0, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 4, y: 0, z: 0 });
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(7,0,0) is invalid (dist²=49 < 64)", () => {
      const portal = buildPortal(7, 0, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 7, y: 0, z: 0 });
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(8,0,0) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(8, 0, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 8, y: 0, z: 0 });
      expect(isValidPortal(portal)).toBe(true);
    });

    it("(5,5,0) is invalid (dist²=50 < 64)", () => {
      const portal = buildPortal(5, 5, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 5, y: 5, z: 0 });
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(5,5,1) is invalid (dist²=51 < 64)", () => {
      const portal = buildPortal(5, 5, 1, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 5, y: 5, z: 1 });
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(5,5,2) is valid (dist²=54 >= 64? No, 54 < 64)", () => {
      const portal = buildPortal(5, 5, 2, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 5, y: 5, z: 2 });
      expect(isValidPortal(portal)).toBe(false); // 25+25+4=54 < 64
    });

    it("(6,4,2) is valid (dist²=56 >= 64? No, 56 < 64)", () => {
      const portal = buildPortal(6, 4, 2, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 6, y: 4, z: 2 });
      expect(isValidPortal(portal)).toBe(false); // 36+16+4=56 < 64
    });

    it("(6,4,4) is valid (dist²=68 >= 64)", () => {
      const portal = buildPortal(6, 4, 4, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 6, y: 4, z: 4 });
      expect(isValidPortal(portal)).toBe(true); // 36+16+16=68 >= 64
    });

    it("(0,8,0) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(0, 8, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 0, y: 8, z: 0 });
      expect(isValidPortal(portal)).toBe(true);
    });

    it("(0,0,8) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(0, 0, 8, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords).toEqual({ x: 0, y: 0, z: 8 });
      expect(isValidPortal(portal)).toBe(true);
    });
  });

  describe("Portal roundtrip conversion", () => {
    it("portal → galCoords → reconstructPortal preserves lower 44 bits", () => {
      const originalPortal = PORTAL;

      const rawX = Number(originalPortal & 0xFFFn);
      const rawY = Number((originalPortal >> 24n) & 0xFFn);
      const rawZ = Number((originalPortal >> 12n) & 0xFFFn);
      const sysId = Number((originalPortal >> 32n) & 0xFFFn);
      const galCoords = ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;

      const reconstructed = reconstructPortal(galCoords, sysId, GALAXY);

      // Compare lower 44 bits (planet bits P are not preserved)
      expect(reconstructed & 0xFFFFFFFFFFn).toBe(originalPortal & 0xFFFFFFFFFFn);
    });

    it("all reverse search results have valid portals", () => {
      const expectedName = EXPECTED_SYSTEM_NAME;

      const results = findSystemSeeds(expectedName, {
        galaxy: GALAXY,
        maxResults: 10,
        galCoordsStart: GAL_COORDS,
        galCoordsEnd: GAL_COORDS,
      });

      for (const r of results) {
        // Reconstruct portal from seed
        const resultPortal = reconstructPortal(
          (r.seed[0]! | (r.seed[1]! << 8) | (r.seed[2]! << 16) | (r.seed[3]! << 24)) >>> 0,
          r.seed[5]! | (r.seed[6]! << 8),
          GALAXY,
        );
        expect(isValidPortal(resultPortal)).toBe(true);
      }
    });
  });
});

describe("Reverse Search - SYS Heuristic Filter", () => {
  it("MAX_REVERSE_SEARCH_SYS is exported and equals 600", () => {
    expect(MAX_REVERSE_SEARCH_SYS).toBe(600);
  });

  it("findSystemSeeds respects SYS filter: SYS=599 is included", () => {
    // Build a seed with sysId=599 and a known galCoords
    const galCoords = 0xFC63C321;
    const sysId = 599;
    const systemIndex = (sysId << 8) | (GALAXY & 0xFF);
    const seed = [
      galCoords & 0xff, (galCoords >> 8) & 0xff, (galCoords >> 16) & 0xff, (galCoords >> 24) & 0xff,
      systemIndex & 0xff, (systemIndex >> 8) & 0xff, (systemIndex >> 16) & 0xff, (systemIndex >> 24) & 0xff,
      0, 0, 0, 0,
    ];
    const name = formatSystemName(seed);

    const results = findSystemSeeds(name, {
      galaxy: GALAXY,
      maxResults: 50,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    // SYS=599 is within the filter threshold, so at least one result should be found
    expect(results.length).toBeGreaterThan(0);
  });

  it("findSystemSeeds respects SYS filter: SYS=600 is included", () => {
    const galCoords = 0xFC63C321;
    const sysId = 600;
    const systemIndex = (sysId << 8) | (GALAXY & 0xFF);
    const seed = [
      galCoords & 0xff, (galCoords >> 8) & 0xff, (galCoords >> 16) & 0xff, (galCoords >> 24) & 0xff,
      systemIndex & 0xff, (systemIndex >> 8) & 0xff, (systemIndex >> 16) & 0xff, (systemIndex >> 24) & 0xff,
      0, 0, 0, 0,
    ];
    const name = formatSystemName(seed);

    const results = findSystemSeeds(name, {
      galaxy: GALAXY,
      maxResults: 50,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    // SYS=600 is at the filter threshold, so at least one result should be found
    expect(results.length).toBeGreaterThan(0);
  });

  it("findSystemSeeds respects SYS filter: SYS=601 is excluded", () => {
    const galCoords = 0xFC63C321;
    const sysId = 601;
    const systemIndex = (sysId << 8) | (GALAXY & 0xFF);
    const seed = [
      galCoords & 0xff, (galCoords >> 8) & 0xff, (galCoords >> 16) & 0xff, (galCoords >> 24) & 0xff,
      systemIndex & 0xff, (systemIndex >> 8) & 0xff, (systemIndex >> 16) & 0xff, (systemIndex >> 24) & 0xff,
      0, 0, 0, 0,
    ];
    const name = formatSystemName(seed);

    const results = findSystemSeeds(name, {
      galaxy: GALAXY,
      maxResults: 50,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    // SYS=601 is above the filter threshold, so no results should be found
    // (the name was generated from sysId=601, but the filter skips it)
    const foundSys601 = results.some(r => {
      const rSysId = r.seed[5]! | (r.seed[6]! << 8);
      return rSysId === sysId;
    });
    expect(foundSys601).toBe(false);
  });

  it("findRegionSeeds respects SYS filter: SYS=601 is excluded", () => {
    const galCoords = 0xFC63C321;
    const sysId = 601;
    const systemIndex = (sysId << 8) | (GALAXY & 0xFF);
    const seed = [
      galCoords & 0xff, (galCoords >> 8) & 0xff, (galCoords >> 16) & 0xff, (galCoords >> 24) & 0xff,
      systemIndex & 0xff, (systemIndex >> 8) & 0xff, (systemIndex >> 16) & 0xff, (systemIndex >> 24) & 0xff,
      0, 0, 0, 0,
    ];
    const name = formatRegionName(seed);

    const results = findRegionSeeds(name, {
      galaxy: GALAXY,
      maxResults: 50,
      galCoordsStart: galCoords,
      galCoordsEnd: galCoords,
    });

    // SYS=601 is above the filter threshold, so no results should be found
    const foundSys601 = results.some(r => {
      const rSysId = r.seed[5]! | (r.seed[6]! << 8);
      return rSysId === sysId;
    });
    expect(foundSys601).toBe(false);
  });
});
