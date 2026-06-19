/**
 * Reverse search: find coordinates from a name.
 *
 * Finds portal codes / coordinates that produce a given system, region,
 * or planet name using the nms_namegen-compatible generation algorithms.
 *
 * NOTE: Exhaustive search iterates up to 2^32 seeds.
 * Use `maxResults` and `onProgress` to control execution time.
 */

import type { SeedRange, WeightData, SearchResult } from "./types.js";
import { updateSeedUlong, rotateLeft32 } from "./seed.js";
import { Alphasets } from "./generator.js";
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

// ─── Constants ────────────────────────────────────────────────────────

const TINY_DOUBLE = 2.3283064370807974e-10;
const U32_MAX = 0xffffffff;
const SEARCH_PROGRESS_INTERVAL = 0x04000000; // ~67M iterations per progress tick

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
 * @param name - System name (e.g. "Desnoz-Gasu", "Gamumu XIX")
 * @param options - Search options
 * @returns Array of SearchResult with seed, coordinates, and portal info
 */
export function findSystemSeeds(
  name: string,
  options: ReverseSearchOptions,
): SearchResult[] {
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
    for (let sysId = 0; sysId < 0x1000; sysId++) {
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
 * @param name - Region name (e.g. "Ejblifirtc", "Sea of Aosh")
 * @param options - Search options
 * @returns Array of SearchResult with seed, coordinates, and portal info
 */
export function findRegionSeeds(
  name: string,
  options: ReverseSearchOptions,
): SearchResult[] {
  const galaxy = options.galaxy;
  const cap = options.maxResults ?? 10;
  const start = options.galCoordsStart ?? 0;
  const end = options.galCoordsEnd ?? U32_MAX;

  const result: SearchResult[] = [];
  let progress = 0;

  for (let galCoords = start; galCoords <= end; galCoords++) {
    const galCoordsBytes = u32ToLEBytes(galCoords);

    for (let sysId = 0; sysId < 0x1000; sysId++) {
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

/**
 * Convert a 64-bit bigint to an 8-byte little-endian array.
 */
function u64ToBytes(val: bigint): number[] {
  const bytes: number[] = [];
  let v = val & 0xffffffffffffffffn;
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return bytes;
}

/**
 * Convert a little-endian byte array to a 64-bit bigint.
 */
function bytesToU64(bytes: number[]): bigint {
  let val = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    val = (val << 8n) | BigInt(bytes[i]! & 0xff);
  }
  return val;
}

// ─── Portal Validation ────────────────────────────────────────────────

/**
 * Extract signed galactic coordinates from a portal code.
 *
 * Portal format: 0xPSSSYYZZZXXX
 *   rawX = XXX (12 bits, 0-4095)
 *   rawY = YY  (8 bits, 0-255, signed)
 *   rawZ = ZZZ (12 bits, 0-4095)
 *
 * Signed coordinates:
 *   X = signExtend(rawX, 12) → range -2048 to 2047
 *   Y = signExtend(rawY, 8)  → range -128 to 127
 *   Z = signExtend(rawZ, 12) → range -2048 to 2047
 */
export function portalToGalacticCoords(portal: bigint): { x: number; y: number; z: number } {
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);

  // Sign-extend 12-bit values
  const x = rawX >= 0x800 ? rawX - 0x1000 : rawX;
  // Sign-extend 8-bit value
  const y = rawY >= 0x80 ? rawY - 0x100 : rawY;
  // Sign-extend 12-bit values
  const z = rawZ >= 0x800 ? rawZ - 0x1000 : rawZ;

  return { x, y, z };
}

/**
 * Check if a portal code represents a valid, reachable location.
 *
 * Valid coordinate ranges:
 *   Y: -126 to 126
 *   X: -2047 to 2046
 *   Z: -2047 to 2046
 *
 * Galactic center exclusion zone:
 *   Y² + Z² + X² < 64 → unreachable
 */
export function isValidPortal(portal: bigint): boolean {
  const { x, y, z } = portalToGalacticCoords(portal);

  // Check coordinate ranges
  if (y < -126 || y > 126) return false;
  if (x < -2047 || x > 2046) return false;
  if (z < -2047 || z > 2046) return false;

  // Check galactic center exclusion zone (sphere with radius 8)
  const distSq = y * y + z * z + x * x;
  if (distSq < 64) return false;

  return true;
}
