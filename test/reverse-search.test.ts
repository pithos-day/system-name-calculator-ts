import { describe, it, expect } from "vitest";
import {
  systemName,
  regionName,
  formatSystemName,
  formatRegionName,
  findSystemSeeds,
  findRegionSeeds,
  reconstructPortal,
} from "../src/index.js";

describe("Reverse Search", () => {
  const GALAXY = 9;
  const PORTAL_HEX = "102DFC63C321";
  const portal = BigInt("0x" + PORTAL_HEX);

  // Extract galCoords from portal for targeted search
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);
  const sysId = Number((portal >> 32n) & 0xFFFn);
  const galCoords =
    ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;

  it("reconstructPortal produces portal (without planet bits)", () => {
    const result = reconstructPortal(galCoords, sysId, GALAXY);

    // reconstructPortal doesn't set planet bits (P=0), original has P=1
    // So mask out planet bits for comparison
    const resultMasked = result & 0x0FFFFFFFFFFn;
    const portalMasked = portal & 0x0FFFFFFFFFFn;
    expect(resultMasked).toBe(portalMasked);
  });

  it("findSystemSeeds finds portal for known system name (single galCoords)", () => {
    const expectedName = systemName(portal, GALAXY);

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
    const expectedName = regionName(portal, GALAXY);

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
    const expectedSystem = systemName(portal, GALAXY);

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
    const expectedName = systemName(portal, GALAXY);

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
