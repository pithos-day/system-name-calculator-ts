import { describe, it, expect } from "vitest";
import {
  systemName,
  regionName,
  planetName,
  planetSeed,
  planetSeeds,
  isValidSystemName,
  isValidRegionName,
  isValidPlanetName,
  validateName,
  findSystemSeeds,
  findRegionSeeds,
} from "../src/index.js";

describe("Name Validation", () => {
  const GALAXY = 9;
  const PORTAL_HEX = "102DFC63C321";
  const portal = BigInt("0x" + PORTAL_HEX);

  describe("System Name Validation", () => {
    it("validates actual generated system names", () => {
      const name = systemName(portal, GALAXY);
      const result = isValidSystemName(name);
      expect(result.valid).toBe(true);
    });

    it("rejects empty name", () => {
      expect(isValidSystemName("").valid).toBe(false);
    });

    it("rejects name not starting with uppercase", () => {
      expect(isValidSystemName("abc").valid).toBe(false);
    });

    it("rejects name with invalid characters", () => {
      expect(isValidSystemName("Abc123").valid).toBe(false);
    });

    it("rejects name with consecutive consonants", () => {
      // "bcdf" has 4 consecutive consonants (no vowel)
      expect(isValidSystemName("Abcdf").valid).toBe(false);
    });

    it("validates hyphenated names", () => {
      const name = systemName(portal, GALAXY);
      // If the name is not hyphenated, test with a valid hyphenated format
      if (!name.includes("-")) {
        expect(isValidSystemName("Abc-Def").valid).toBe(true);
      }
    });

    it("rejects multiple hyphens", () => {
      expect(isValidSystemName("Ab-Cd-Ef").valid).toBe(false);
    });

    it("validates Roman numeral suffix", () => {
      expect(isValidSystemName("Abcdef I").valid).toBe(true);
      expect(isValidSystemName("Abcdef XX").valid).toBe(true);
    });

    it("rejects invalid Roman numeral", () => {
      expect(isValidSystemName("Abcdef XXI").valid).toBe(false);
    });
  });

  describe("Region Name Validation", () => {
    it("validates actual generated region names", () => {
      const name = regionName(portal, GALAXY);
      const result = isValidRegionName(name);
      expect(result.valid).toBe(true);
    });

    it("validates region names with adornments", () => {
      expect(isValidRegionName("Sea of Abcdef").valid).toBe(true);
      expect(isValidRegionName("Clouds of Ghijk").valid).toBe(true);
    });

    it("rejects empty name", () => {
      expect(isValidRegionName("").valid).toBe(false);
    });

    it("rejects name with invalid characters", () => {
      expect(isValidRegionName("Abc123").valid).toBe(false);
    });
  });

  describe("Planet Name Validation", () => {
    it("validates actual generated planet names", () => {
      const ps = planetSeeds(portal, GALAXY);
      for (const seed of ps.planet_seeds) {
        const name = planetName(seed);
        const result = isValidPlanetName(name);
        expect(result.valid).toBe(true);
      }
    });

    it("validates planet name with adornment", () => {
      expect(isValidPlanetName("Abcdef Prime").valid).toBe(true);
      expect(isValidPlanetName("Abcdef Major").valid).toBe(true);
    });

    it("validates planet name with numeral", () => {
      expect(isValidPlanetName("Abcdef I").valid).toBe(true);
      expect(isValidPlanetName("Abcdef XX").valid).toBe(true);
    });

    it("validates planet name with shortcode", () => {
      expect(isValidPlanetName("Abcdef A0").valid).toBe(true);
      expect(isValidPlanetName("Abcdef Z79").valid).toBe(true);
    });

    it("rejects shortcode with invalid number", () => {
      expect(isValidPlanetName("Abcdef A80").valid).toBe(false);
    });

    it("validates planet name with longcode", () => {
      // Style 5: "%PROCSHORT% %LONGCODE%"
      expect(isValidPlanetName("Abcde 11/A1").valid).toBe(true);
      expect(isValidPlanetName("Abcd 99/Z9").valid).toBe(true);
    });

    it("rejects longcode with invalid number", () => {
      expect(isValidPlanetName("Abcdefgh 10/A1").valid).toBe(false);
      expect(isValidPlanetName("Abcdefgh 100/A1").valid).toBe(false);
    });

    it("rejects longcode with invalid digit", () => {
      expect(isValidPlanetName("Abcdefgh 11/A0").valid).toBe(false);
    });

    it("rejects empty name", () => {
      expect(isValidPlanetName("").valid).toBe(false);
    });
  });

  describe("validateName wrapper", () => {
    it("validates system names", () => {
      const name = systemName(portal, GALAXY);
      expect(validateName(name, "system").valid).toBe(true);
    });

    it("validates region names", () => {
      const name = regionName(portal, GALAXY);
      expect(validateName(name, "region").valid).toBe(true);
    });

    it("validates planet names", () => {
      const ps = planetSeeds(portal, GALAXY);
      const name = planetName(ps.planet_seeds[0]!);
      expect(validateName(name, "planet").valid).toBe(true);
    });

    it("rejects unknown type", () => {
      expect(validateName("test", "unknown" as any).valid).toBe(false);
    });
  });

  describe("Reverse Search Integration", () => {
    it("returns empty for invalid system name", () => {
      const results = findSystemSeeds("invalid123", {
        galaxy: GALAXY,
        maxResults: 10,
        galCoordsStart: 0,
        galCoordsEnd: 100,
      });
      expect(results.length).toBe(0);
    });

    it("returns empty for invalid region name", () => {
      const results = findRegionSeeds("invalid123", {
        galaxy: GALAXY,
        maxResults: 10,
        galCoordsStart: 0,
        galCoordsEnd: 100,
      });
      expect(results.length).toBe(0);
    });

    it("finds results for valid system name", () => {
      const name = systemName(portal, GALAXY);
      const rawX = Number(portal & 0xFFFn);
      const rawY = Number((portal >> 24n) & 0xFFn);
      const rawZ = Number((portal >> 12n) & 0xFFFn);
      const galCoords = ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;

      const results = findSystemSeeds(name, {
        galaxy: GALAXY,
        maxResults: 5,
        galCoordsStart: galCoords,
        galCoordsEnd: galCoords,
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
