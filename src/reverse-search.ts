/**
 * Reverse search: find coordinates from a name.
 *
 * Finds portal codes / coordinates that produce a given system, region,
 * or planet name using the nms_namegen-compatible generation algorithms.
 *
 * NOTE: Exhaustive search iterates up to 2^32 seeds.
 * Use `maxResults` and `onProgress` to control execution time.
 *
 * @experimental
 * Reverse Search is an experimental feature and may return invalid or unreachable
 * Portal Codes. It is not a true inverse of the generation algorithm — it performs
 * brute-force iteration and heuristic filtering. Results should not be relied upon
 * for navigation, planet verification, or any production use.
 */

import type { SeedRange, WeightData, SearchResult } from "./types.js";
import { updateSeedUlong, rotateLeft32 } from "./seed.js";
import {
  vowelInsertedAtStart,
  vowelInsertedAtEnd,
  getConsecutiveConsonants,
} from "./generator.js";
import { formatSystemName, portalToSeed } from "./system-name.js";
import { formatRegionName, regionName, PROC_ADORNMENTS } from "./region-name.js";
import { planetName, planetSeed, planetSeeds, systemAttributes } from "./planet.js";
import {
  formatRegionGrfCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
} from "./coords.js";
import {
  isValidSystemName,
  isValidRegionName,
  isValidPlanetName,
  type ValidationResult,
} from "./name-validation.js";

// ─── Constants ────────────────────────────────────────────────────────

const U32_MAX = 0xffffffff;
const SEARCH_PROGRESS_INTERVAL = 0x04000000; // ~67M iterations per progress tick

/**
 * Heuristic filter for reverse search: skip system indices above this threshold.
 *
 * NOTE: This is NOT a hard constraint from the game's generation spec.
 * It is an optimization filter — in normal generation, SYS rarely exceeds 600.
 * Adjust this value if needed for edge cases.
 */
export const MAX_REVERSE_SEARCH_SYS = 600;

// ─── Public API ───────────────────────────────────────────────────────

export interface ReverseSearchOptions {
  galaxy: number;
  maxResults?: number;
  galCoordsStart?: number;
  galCoordsEnd?: number;
  onProgress?: (found: number, progressPercent: number) => void;
}

/**
 * Find portal codes that produce the given system name in the given galaxy.
 *
 * Searches by iterating galacticCoords (lower 32 bits of portal code)
 * and verifying that formatSystemName produces the target name.
 *
 * @deprecated
 * Reverse Search is experimental and may return invalid or unreachable Portal Codes.
 * Use only for exploration, debugging, or research purposes. Do not rely on results
 * for navigation, planet verification, or production use.
 *
 * @param name - System name (e.g. "Desnoz-Gasu", "Gamumu XIX")
 * @param options - Search options
 * @returns Array of SearchResult with seed, coordinates, and portal info
 */
export function findSystemSeeds(
  name: string,
  options: ReverseSearchOptions,
): SearchResult[] {
  // Validate name before expensive search
  const validation = isValidSystemName(name);
  if (!validation.valid) {
    return [];
  }

  const galaxy = options.galaxy;
  const cap = options.maxResults ?? 10;
  const start = options.galCoordsStart ?? 0;
  const end = options.galCoordsEnd ?? U32_MAX;

  const result: SearchResult[] = [];
  let progress = 0;

  for (let galCoords = start; galCoords <= end; galCoords++) {
    const galCoordsBytes = u32ToLEBytes(galCoords);

    // Try a range of systemIndex values (0-4095 for system_id, combined with galaxy)
    // The systemIndex = ((portal & 0x0FFF00000000) >> 24) | galaxy
    // This gives system_id in bits 8-19, galaxy in bits 0-7
    // Heuristic filter: skip high sysId values (optimization, not a hard constraint)
    for (let sysId = 0; sysId < 0x1000; sysId++) {
      if (sysId > MAX_REVERSE_SEARCH_SYS) break;
      const systemIndex = (sysId << 8) | (galaxy & 0xFF);
      const sysIndexBytes = u32ToLEBytes(systemIndex);

      // Build 12-byte seed: [galacticCoords(4), systemIndex(4), 0, 0, 0, 0]
      const seed = [...galCoordsBytes, ...sysIndexBytes, 0, 0, 0, 0];

      const generated = formatSystemName(seed);
      if (generated.toLowerCase() === name.toLowerCase()) {
        const portal = reconstructPortal(galCoords, sysId, galaxy);

        // Skip invalid portal codes (out of range or galactic center)
        if (!isValidPortal(portal)) continue;

        result.push({
          seed,
          signalBoosterCoords: formatRegionBoosterCoords(portal),
          rawCoords: formatRegionRawCoords(portal),
          portalCoords: formatRegionGrfCoords(portal),
        });
      }

      if (result.length >= cap) break;
    }

    if (galCoords % SEARCH_PROGRESS_INTERVAL === 0) {
      progress = Math.floor((galCoords / U32_MAX) * 100);
      options.onProgress?.(result.length, progress);
    }

    if (result.length >= cap) break;
  }

  return result;
}

/**
 * Find portal codes that produce the given region name in the given galaxy.
 *
 * @deprecated
 * Reverse Search is experimental and may return invalid or unreachable Portal Codes.
 * Use only for exploration, debugging, or research purposes. Do not rely on results
 * for navigation, planet verification, or production use.
 *
 * @param name - Region name (e.g. "Ejblifirtc", "Sea of Aosh")
 * @param options - Search options
 * @returns Array of SearchResult with seed, coordinates, and portal info
 */
export function findRegionSeeds(
  name: string,
  options: ReverseSearchOptions,
): SearchResult[] {
  // Validate name before expensive search
  const validation = isValidRegionName(name);
  if (!validation.valid) {
    return [];
  }

  const galaxy = options.galaxy;
  const cap = options.maxResults ?? 10;
  const start = options.galCoordsStart ?? 0;
  const end = options.galCoordsEnd ?? U32_MAX;

  const result: SearchResult[] = [];
  let progress = 0;

  for (let galCoords = start; galCoords <= end; galCoords++) {
    const galCoordsBytes = u32ToLEBytes(galCoords);

    for (let sysId = 0; sysId < 0x1000; sysId++) {
      if (sysId > MAX_REVERSE_SEARCH_SYS) break;
      const systemIndex = (sysId << 8) | (galaxy & 0xFF);
      const sysIndexBytes = u32ToLEBytes(systemIndex);

      const seed = [...galCoordsBytes, ...sysIndexBytes, 0, 0, 0, 0];

      const generated = formatRegionName(seed);
      if (generated.toLowerCase() === name.toLowerCase()) {
        const portal = reconstructPortal(galCoords, sysId, galaxy);

        // Skip invalid portal codes (out of range or galactic center)
        if (!isValidPortal(portal)) continue;

        result.push({
          seed,
          signalBoosterCoords: formatRegionBoosterCoords(portal),
          rawCoords: formatRegionRawCoords(portal),
          portalCoords: formatRegionGrfCoords(portal),
        });
      }

      if (result.length >= cap) break;
    }

    if (galCoords % SEARCH_PROGRESS_INTERVAL === 0) {
      progress = Math.floor((galCoords / U32_MAX) * 100);
      options.onProgress?.(result.length, progress);
    }

    if (result.length >= cap) break;
  }

  return result;
}

/**
 * Find planet names for a given portal code and galaxy.
 * Returns all planet names generated from that system.
 *
 * @deprecated
 * This helper is associated with the experimental Reverse Search feature.
 * Use with caution — results are for exploration and debugging only.
 */
export function findPlanetNames(
  portalCode: bigint,
  galaxy: number,
): { index: number; seed: string; name: string }[] {
  const ps = planetSeeds(portalCode, galaxy);
  return ps.planet_seeds.map((seed, i) => ({
    index: i + 1,
    seed: "0x" + seed.toString(16).toUpperCase().padStart(16, "0"),
    name: planetName(seed),
  }));
}

/**
 * Validate a name for reverse search.
 *
 * @deprecated
 * This helper is associated with the experimental Reverse Search feature.
 * Use with caution — validation is heuristic and does not guarantee
 * that Reverse Search will produce valid or reachable Portal Codes.
 *
 * @param name - Name to validate
 * @param type - Type of name: "system", "region", or "planet"
 * @returns ValidationResult with valid flag and optional reason
 */
export function validateName(
  name: string,
  type: "system" | "region" | "planet",
): ValidationResult {
  switch (type) {
    case "system":
      return isValidSystemName(name);
    case "region":
      return isValidRegionName(name);
    case "planet":
      return isValidPlanetName(name);
    default:
      return { valid: false, reason: `Unknown name type: ${type}` };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Reconstruct a portal code from galacticCoords, system_id, and galaxy.
 *
 * Portal format: 0xPSSSYYZZZXXX
 *   galacticCoords = (YY << 24) | (ZZZ << 12) | XXX
 *   system_id = SSS
 *   P = 0 (default)
 */
export function reconstructPortal(galCoords: number, systemId: number, galaxy: number): bigint {
  // Extract X, Y, Z from galacticCoords
  const x = galCoords & 0xFFF;           // bits 0-11
  const y = (galCoords >> 24) & 0xFF;    // bits 24-31
  const z = (galCoords >> 12) & 0xFFF;   // bits 12-23

  // Build portal: 0xPSSSYYZZZXXX
  const portal = BigInt(systemId) << 32n |
    BigInt(y) << 24n |
    BigInt(z) << 12n |
    BigInt(x);

  return portal;
}

/**
 * Convert a 32-bit integer to a 4-byte little-endian array.
 */
function u32ToLEBytes(val: number): number[] {
  return [
    val & 0xff,
    (val >> 8) & 0xff,
    (val >> 16) & 0xff,
    (val >> 24) & 0xff,
  ];
}

// ─── Portal Validation ────────────────────────────────────────────────

const COORD_OFFSET_XZ = 2047;
const COORD_OFFSET_Y = 127;

/**
 * Convert a portal code to galactic coordinates string.
 *
 * Portal format: 0xPSSSYYZZZXXX
 *   rawX = XXX (12 bits, 0-4095)
 *   rawY = YY  (8 bits, 0-255, signed)
 *   rawZ = ZZZ (12 bits, 0-4095)
 *   SSS = system id (12 bits)
 *
 * Output format: "XXXX:YYYY:ZZZZ:SSSS"
 *   X = rawX + 2047
 *   Y = signed(rawY) + 127
 *   Z = rawZ + 2047
 *   S = systemId
 *   Each value is 4-digit uppercase hex, zero-padded.
 */
export function portalToGalacticCoords(portal: bigint): string {
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);
  const systemId = Number((portal >> 32n) & 0xFFFn);

  const x = rawX + COORD_OFFSET_XZ;
  const ySigned = rawY >= 0x80 ? rawY - 256 : rawY;
  const y = ySigned + COORD_OFFSET_Y;
  const z = rawZ + COORD_OFFSET_XZ;

  const hexX = (x & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  const hexY = (y & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  const hexZ = (z & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  const hexS = systemId.toString(16).toUpperCase().padStart(4, "0");

  return `${hexX}:${hexY}:${hexZ}:${hexS}`;
}

/**
 * Check if a portal code represents a valid, reachable location.
 *
 * Computes signed galactic coordinates directly from raw portal bits:
 *   Y: -126 to 126
 *   X: -2047 to 2046
 *   Z: -2047 to 2046
 *
 * Galactic center exclusion zone:
 *   Y² + Z² + X² < 64 → unreachable
 */
/**
 * Convert a galactic coordinates string to a portal code string.
 *
 * Input format: "XXXX:YYYY:ZZZZ:SSSS"
 *   XXXX = X coordinate (unsigned hex, offset +2047)
 *   YYYY = Y coordinate (unsigned hex, offset +127, signed)
 *   ZZZZ = Z coordinate (unsigned hex, offset +2047)
 *   SSSS = system id (unsigned hex)
 *
 * Output: Portal code as uppercase hex string (no 0x prefix).
 *   Format: "PSSSYYZZZXXX" (12 hex digits, P=0)
 */
export function galacticCoordsToPortal(coords: string): string {
  const parts = coords.split(":");
  if (parts.length !== 4) {
    throw new Error(`Invalid galactic coords format: "${coords}" (expected "XXXX:YYYY:ZZZZ:SSSS")`);
  }

  const xRaw = parseInt(parts[0]!, 16);
  const yRaw = parseInt(parts[1]!, 16);
  const zRaw = parseInt(parts[2]!, 16);
  const sysId = parseInt(parts[3]!, 16);

  if (isNaN(xRaw) || isNaN(yRaw) || isNaN(zRaw) || isNaN(sysId)) {
    throw new Error(`Invalid hex values in coords: "${coords}"`);
  }

  // Reverse the offsets: X/Z -2047, Y -127 (signed)
  const rawX = (xRaw - COORD_OFFSET_XZ) & 0xFFF;
  const ySigned = yRaw >= 0x8000 ? yRaw - 0x10000 : yRaw;
  const rawY = (ySigned - COORD_OFFSET_Y) & 0xFF;
  const rawZ = (zRaw - COORD_OFFSET_XZ) & 0xFFF;

  // Build portal: 0x0SSSYYZZZXXX
  const portal = BigInt(sysId & 0xFFF) << 32n |
    BigInt(rawY) << 24n |
    BigInt(rawZ) << 12n |
    BigInt(rawX);

  return portal.toString(16).toUpperCase().padStart(12, "0");
}

/**
 * Check if a portal code represents a valid, reachable location.
 *
 * Computes signed galactic coordinates directly from raw portal bits:
 *   Y: -126 to 126
 *   X: -2047 to 2046
 *   Z: -2047 to 2046
 *
 * Galactic center exclusion zone:
 *   Y² + Z² + X² < 64 → unreachable
 */
export function isValidPortal(portal: bigint): boolean {
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);

  // Sign-extend to signed coordinates
  const x = rawX >= 0x800 ? rawX - 0x1000 : rawX;
  const y = rawY >= 0x80 ? rawY - 0x100 : rawY;
  const z = rawZ >= 0x800 ? rawZ - 0x1000 : rawZ;

  // Check coordinate ranges
  if (y < -126 || y > 126) return false;
  if (x < -2047 || x > 2046) return false;
  if (z < -2047 || z > 2046) return false;

  // Check galactic center exclusion zone (sphere with radius 8)
  const distSq = y * y + z * z + x * x;
  if (distSq < 64) return false;

  return true;
}
