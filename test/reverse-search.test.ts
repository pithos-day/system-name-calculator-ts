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
  galacticCoordsToPortal,
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

  // Helper to parse portalToGalacticCoords string output into signed values
  function parseCoords(str: string): { x: number; y: number; z: number } {
    const [hx, hy, hz] = str.split(":");
    const x = parseInt(hx!, 16) - 2047;
    const yRaw = parseInt(hy!, 16);
    const y = yRaw >= 0x8000 ? yRaw - 0x10000 : yRaw;
    const z = parseInt(hz!, 16) - 2047;
    return { x, y, z };
  }

  describe("portalToGalacticCoords", () => {
    it("returns XXXX:YYYY:ZZZZ:SSSS format string", () => {
      const portal = buildPortal(0x321, 0xFC, 0x63C, 0x02D);
      const coords = portalToGalacticCoords(portal);
      expect(typeof coords).toBe("string");
      expect(coords).toMatch(/^[0-9A-F]{4}:[0-9A-F]{4}:[0-9A-F]{4}:[0-9A-F]{4}$/);
    });

    it("extracts coordinates from valid portal", () => {
      // rawX=0x321=801, rawY=0xFC=252(signed=-4), rawZ=0x63C=1596, sysId=0x02D=45
      const portal = buildPortal(0x321, 0xFC, 0x63C, 0x02D);
      const coords = portalToGalacticCoords(portal);

      // X = 801 + 2047 = 2848 = 0x0B20
      // Y = -4 + 127 = 123 = 0x007B
      // Z = 1596 + 2047 = 3643 = 0x0E3B
      // S = 45 = 0x002D
      expect(coords).toBe("0B20:007B:0E3B:002D");
    });

    it("offsets 12-bit X correctly (+2047)", () => {
      // rawX=0xFFF = 4095, X = 4095 + 2047 = 6142 = 0x17FE
      const portal = buildPortal(0xFFF, 0, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(coords.startsWith("17FE:")).toBe(true);
      expect(parseCoords(coords).x).toBe(4095);
    });

    it("offsets 12-bit Z correctly (+2047)", () => {
      // rawZ=0x800 = 2048, Z = 2048 + 2047 = 4095 = 0x0FFF
      const portal = buildPortal(0, 0, 0x800, 0);
      const coords = portalToGalacticCoords(portal);
      expect(parseCoords(coords).z).toBe(2048);
    });

    it("offsets 8-bit Y correctly (+127, signed)", () => {
      // rawY=0x80 = 128, signed = -128, Y = -128 + 127 = -1 = 0xFFFF
      const portal = buildPortal(0, 0x80, 0, 0);
      const coords = portalToGalacticCoords(portal);
      expect(parseCoords(coords).y).toBe(-1);
    });

    it("extracts systemId in 4th field", () => {
      const portal = buildPortal(0, 0, 0, 0x123);
      const coords = portalToGalacticCoords(portal);
      expect(coords.endsWith(":0123")).toBe(true);
    });
  });

  describe("isValidPortal - Valid boundary values", () => {
    it("Y=-126 is valid", () => {
      // rawY for Y=-126: -126 + 256 = 130 = 0x82
      // Use valid rawX=2046 (X=2046), rawZ=2046 (Z=2046) to stay within range
      const portal = buildPortal(2046, 0x82, 2046, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Y=126 is valid", () => {
      // rawY for Y=126: 126 = 0x7E
      const portal = buildPortal(2046, 0x7E, 2046, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("X=-2047 is valid", () => {
      // rawX for X=-2047: 0x801 = 2049 (sign-extends to -2047)
      // Use rawY=0 (Y=0) which is valid, rawZ=2046 (Z=2046)
      const portal = buildPortal(0x801, 0, 2046, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("X=2046 is valid", () => {
      // rawX for X=2046: 2046 = 0x7FE
      const portal = buildPortal(0x7FE, 0, 2046, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Z=-2047 is valid", () => {
      // rawZ for Z=-2047: 0x801 = 2049 (sign-extends to -2047)
      const portal = buildPortal(2046, 0, 0x801, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("Z=2046 is valid", () => {
      // rawZ for Z=2046: 2046 = 0x7FE
      const portal = buildPortal(2046, 0, 0x7FE, 0);
      expect(isValidPortal(portal)).toBe(true);
    });
  });

  describe("isValidPortal - Invalid coordinate ranges", () => {
    it("Y=-127 is invalid (below range)", () => {
      // rawY for Y=-127: -127 + 256 = 129 = 0x81
      const portal = buildPortal(0x800, 0x81, 0x800, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Y=127 is invalid (above range)", () => {
      // rawY for Y=127: 127 = 0x7F
      const portal = buildPortal(0x800, 0x7F, 0x800, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("X=-2048 is invalid (below range)", () => {
      // rawX for X=-2048: 0x800 = 2048
      const portal = buildPortal(0x800, 0, 0x800, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("X=2047 is invalid (above range)", () => {
      // rawX for X=2047: 0x7FF = 2047
      const portal = buildPortal(0x7FF, 0, 0x800, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Z=-2048 is invalid (below range)", () => {
      // rawZ for Z=-2048: 0x800 = 2048
      const portal = buildPortal(0x800, 0, 0x800, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("Z=2047 is invalid (above range)", () => {
      // rawZ for Z=2047: 0x7FF = 2047
      const portal = buildPortal(0x800, 0, 0x7FF, 0);
      expect(isValidPortal(portal)).toBe(false);
    });
  });

  describe("isValidPortal - Galactic center exclusion zone", () => {
    it("(1,0,0) is invalid (dist²=1 < 64)", () => {
      const portal = buildPortal(1, 0, 0, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(4,0,0) is invalid (dist²=16 < 64)", () => {
      const portal = buildPortal(4, 0, 0, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(7,0,0) is invalid (dist²=49 < 64)", () => {
      const portal = buildPortal(7, 0, 0, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(8,0,0) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(8, 0, 0, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("(5,5,0) is invalid (dist²=50 < 64)", () => {
      const portal = buildPortal(5, 5, 0, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(5,5,1) is invalid (dist²=51 < 64)", () => {
      const portal = buildPortal(5, 5, 1, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(5,5,2) is invalid (dist²=54 < 64)", () => {
      const portal = buildPortal(5, 5, 2, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(6,4,2) is invalid (dist²=56 < 64)", () => {
      const portal = buildPortal(6, 4, 2, 0);
      expect(isValidPortal(portal)).toBe(false);
    });

    it("(6,4,4) is valid (dist²=68 >= 64)", () => {
      const portal = buildPortal(6, 4, 4, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("(0,8,0) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(0, 8, 0, 0);
      expect(isValidPortal(portal)).toBe(true);
    });

    it("(0,0,8) is valid (dist²=64 >= 64)", () => {
      const portal = buildPortal(0, 0, 8, 0);
      expect(isValidPortal(portal)).toBe(true);
    });
  });

  describe("galacticCoordsToPortal", () => {
    it("converts coords string to portal hex string starting with 1", () => {
      const portal = galacticCoordsToPortal("0B20:007B:0E3B:002D");
      expect(typeof portal).toBe("string");
      expect(portal).toMatch(/^1[0-9A-F]{11}$/);
    });

    it("roundtrips with portalToGalacticCoords", () => {
      const original = buildPortal(0x321, 0xFC, 0x63C, 0x02D);
      const coords = portalToGalacticCoords(original);
      const reconstructed = galacticCoordsToPortal(coords);

      // Compare lower 44 bits (planet bits differ: original P=0, reconstructed P=1)
      const origMasked = (original & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      const reconMasked = (BigInt("0x" + reconstructed) & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      expect(reconMasked).toBe(origMasked);
    });

    it("roundtrips with known fixture portal", () => {
      const coords = portalToGalacticCoords(PORTAL);
      const reconstructed = galacticCoordsToPortal(coords);
      // Mask planet bits for comparison (fixture P=2, reconstructed P=1)
      const reconMasked = (BigInt("0x" + reconstructed) & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      const expected = (PORTAL & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      expect(reconMasked).toBe(expected);
    });

    it("handles negative Y coordinates", () => {
      // Y=-1 → hex "FFFF", rawY should be 0x80
      const portal = buildPortal(0, 0x80, 0, 0);
      const coords = portalToGalacticCoords(portal);
      const reconstructed = galacticCoordsToPortal(coords);
      // P=1, sysId=0, rawY=0x80, rawZ=0, rawX=0
      expect(reconstructed).toBe("100080000000");
    });

    it("handles max boundary values", () => {
      // X=6142 (rawX=0xFFF), Y=253 (rawY=0x7D), Z=6142 (rawZ=0xFFF), S=4095
      const portal = buildPortal(0xFFF, 0x7D, 0xFFF, 0xFFF);
      const coords = portalToGalacticCoords(portal);
      const reconstructed = galacticCoordsToPortal(coords);
      // Mask planet bits for comparison
      const reconMasked = (BigInt("0x" + reconstructed) & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      const expected = (portal & 0xFFFFFFFFFFn).toString(16).toUpperCase().padStart(12, "0");
      expect(reconMasked).toBe(expected);
    });

    it("throws on invalid format", () => {
      expect(() => galacticCoordsToPortal("invalid")).toThrow("Invalid galactic coords format");
      expect(() => galacticCoordsToPortal("AAAA:BBBB:CCCC")).toThrow("Invalid galactic coords format");
      expect(() => galacticCoordsToPortal("AAAA:BBBB:CCCC:DDDD:EEEE")).toThrow("Invalid galactic coords format");
    });

    it("throws on invalid hex values", () => {
      expect(() => galacticCoordsToPortal("ZZZZ:0000:0000:0000")).toThrow("Invalid hex values");
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
