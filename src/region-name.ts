/**
 * Region name generation from coordinates.
 *
 * Ported from nms_namegen region.py regionName()
 * Matches the Python reference implementation exactly.
 */

import type { SeedCache } from "./types.js";
import {
  multiply,
  add,
  shr,
  shl,
  xor,
  bigintToBytes,
  bytesToBigint,
} from "./byte-utils.js";
import { CACHE_MULTIPLIER, updateSeedCache } from "./seed.js";
import { generateName } from "./generator.js";
import { MASK64, CONST_A, CONST_B } from "./constants.js";

/**
 * Region adornments (proc-gen suffixes/prefixes).
 * Matches nms_namegen region.py region_name_adornments
 */
export const PROC_ADORNMENTS: string[] = [
  "{} Adjunct",
  "{} Void",
  "{} Expanse",
  "{} Terminus",
  "{} Boundary",
  "{} Fringe",
  "{} Cluster",
  "{} Mass",
  "{} Band",
  "{} Cloud",
  "{} Nebula",
  "{} Quadrant",
  "{} Sector",
  "{} Anomaly",
  "{} Conflux",
  "{} Instability",
  "Sea of {}",
  "The Arm of {}",
  "{} Spur",
  "{} Shallows",
];

// ─── Region Name Generation ──────────────────────────────────────────

/**
 * Generate a region name from portal code and galaxy.
 *
 * Matches nms_namegen region.py regionName(portal_code, galaxy) exactly.
 *
 * @param portalCode - Portal code as integer (format: 0xPSSSYYZZZXXX)
 * @param galaxy - Galaxy number (Euclid = 0)
 * @returns Generated region name with optional adornment
 */
export function regionName(portalCode: bigint, galaxy: number): string {
  // Step 1: Murmur-like hash derivation (region.py lines 48-54)
  let register = BigInt(galaxy) >> 1n;
  register ^= (BigInt(galaxy) << 32n) | (portalCode & 0xFFFFFFFFn);
  register = (register * CONST_A) & MASK64;
  register = (((register >> 33n) ^ register) * CONST_B) & MASK64;
  register = (register >> 33n) ^ register;

  // Step 2: Derive PRNG seed (region.py lines 56-65)
  let seedHigh =
    ((((register & 0xFFFF0000n) >> 16n) | ((register & 0x0000FFFFn) << 16n)) ^
      (register & 0xFFFFFFFFn) ^
      (register >> 32n)) &
    MASK64;

  let seed = register & 0xFFFFFFFFn;
  if (seedHigh === 0n) seedHigh = 1n;
  seed |= seedHigh << 32n;

  // Step 3: Initialize PRNG cache from seed
  const cache0: [number[], number[]] = [
    bigintToBytes(seed & 0xFFFFFFFFn),
    bigintToBytes(seed >> 32n),
  ];
  const cache1: [number[], number[], number[]] = [
    [0x00], // alphaset_index = 0
    [0x06], // min_length = 6
    new Array<number>(),
  ];

  // Step 4: Compute max_length = rng.random(4) + 6 (region.py lines 68-69)
  updateSeedCache({ c0: cache0, c1: cache1 });
  const maxLenProduct = multiply(cache0[0]!, [0x04]);
  const maxLenHigh = shr(maxLenProduct, 4);
  const max_length = (maxLenHigh[0] ?? 0) + 6;
  cache1[2] = [max_length];

  // Step 5: Generate name (region.py lines 70-72)
  let name = generateName(cache0, cache1);
  name = name.charAt(0).toUpperCase() + name.substring(1);

  // Step 6: Check for adornment (region.py lines 74-77)
  updateSeedCache({ c0: cache0, c1: cache1 });
  const check = multiply(cache0[0]!, [0x64]);
  const checkHigh = shr(check, 4);
  if ((checkHigh[0] ?? 0) < 0x50) {
    updateSeedCache({ c0: cache0, c1: cache1 });
    const adornIdxProduct = multiply(cache0[0]!, [0x14]);
    const adornIdxHigh = shr(adornIdxProduct, 4);
    const adornIndex = (adornIdxHigh[0] ?? 0) % PROC_ADORNMENTS.length;
    name = PROC_ADORNMENTS[adornIndex]!.replace("{}", name);
  }

  return name;
}

// ─── Backward-compatible API ──────────────────────────────────────────

/**
 * Legacy API: generate region name from byte array seed.
 *
 * @deprecated Use regionName(portalCode, galaxy) instead.
 */
export function formatRegionName(seed: number[]): string {
  // Convert seed bytes to portal code and galaxy
  // Seed is little-endian byte array: [galactic_coords (4 bytes LE), upper (4 bytes LE)]
  // But the old C# format uses a different hash, so this is kept for backward compatibility
  // with the reverse-search which uses its own seed derivation.
  const portalCode = bytesToBigint(seed.slice(0, 4));
  const galaxy = bytesToBigint(seed.slice(4, 8));
  return regionName(portalCode, Number(galaxy));
}

// ─── Utility ─────────────────────────────────────────────────────────
