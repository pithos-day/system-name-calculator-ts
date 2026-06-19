/**
 * Shared test fixture for golden tests.
 *
 * All portal-code-related tests should use this single fixture
 * to ensure consistent, reproducible verification across the test suite.
 *
 * Standard fixture:
 *   Galaxy: 0 (Euclid)
 *   Portal Code: 202101D40677
 *   Galactic Coordinates: 0E77:007F:07FF:085B
 */

import {
  systemName,
  regionName,
  planetSeeds,
  planetName,
  portalToGalacticCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
  formatRegionGrfCoords,
  isValidPortal,
  systemAttributes,
} from "../src/index.js";

// ─── Core Fixture Values ──────────────────────────────────────────────

export const GALAXY = 0;
export const PORTAL_CODE_HEX = "202101D40677";
export const PORTAL = BigInt("0x" + PORTAL_CODE_HEX);
export const GALACTIC_COORDS = "0E77:007F:07FF:085B";

// ─── Derived Coordinate Values ────────────────────────────────────────

// galCoords for reverse search (32-bit packed: Y[31:24] | Z[23:12] | X[11:0])
const rawX = Number(PORTAL & 0xFFFn);
const rawY = Number((PORTAL >> 24n) & 0xFFn);
const rawZ = Number((PORTAL >> 12n) & 0xFFFn);
export const SYS_ID = Number((PORTAL >> 32n) & 0xFFFn);
export const GAL_COORDS = ((rawY << 24) | (rawZ << 12) | rawX) >>> 0;

// ─── Expected Generation Results ──────────────────────────────────────

export const EXPECTED_SYSTEM_NAME = systemName(PORTAL, GALAXY);
export const EXPECTED_REGION_NAME = regionName(PORTAL, GALAXY);

// planetSeeds returns planet_count planets + moon_count moons
const ps = planetSeeds(PORTAL, GALAXY);
export const EXPECTED_PLANET_COUNT = ps.planet_count;
export const EXPECTED_MOON_COUNT = ps.moon_count;
export const EXPECTED_PLANET_SEEDS = ps.planet_seeds.map((s) => ({
  seed: s,
  name: planetName(s),
}));

// ─── Expected Coordinate Formatting ───────────────────────────────────

export const EXPECTED_SIGNED_COORDS = portalToGalacticCoords(PORTAL);
export const EXPECTED_SIGNAL_BOOSTER_COORDS = formatRegionBoosterCoords(PORTAL);
export const EXPECTED_RAW_COORDS = formatRegionRawCoords(PORTAL);
export const EXPECTED_PORTAL_COORDS = formatRegionGrfCoords(PORTAL);
export const EXPECTED_IS_VALID = isValidPortal(PORTAL);

// ─── Expected System Attributes ───────────────────────────────────────

export const EXPECTED_SYSTEM_ATTRIBUTES = systemAttributes(PORTAL, GALAXY);
