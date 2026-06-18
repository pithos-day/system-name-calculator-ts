/**
 * Seed operations for the name generator.
 *
 * Ported from C# SystemNameCalculator.Utils.RandomExtensions
 * @see SystemNameCalculator/SystemNameCalculator/Utils/RandomExtensions.cs
 *
 * And from ByteExtensions.UpdateSeed:
 * @see SystemNameCalculator/SystemNameCalculator/Utils/ByteExtensions.cs
 */

import type { SeedCache } from "./types.js";
import { multiply, add, shr, shl } from "./byte-utils.js";

// ─── Constants ────────────────────────────────────────────────────────

/** LCG multiplier used in UpdateSeed (32-bit) */
export const LCG_MULTIPLIER = 0x5A76F899n;

/** Multiplier for cache scrambling: { 0x99, 0xF8, 0x76, 0x5A } little-endian */
export const CACHE_MULTIPLIER = [0x99, 0xf8, 0x76, 0x5a];

/** 64-bit mask for overflow emulation */
const MASK64 = 0xFFFFFFFFFFFFFFFFn;

/** 32-bit mask */
const MASK32 = 0xFFFFFFFFn;

// ─── UpdateSeed (ulong version) ──────────────────────────────────────

/**
 * 32-bit LCG seed update operating on a 64-bit value.
 *
 * C# code:
 * ```
 * seed = unchecked(((seed & 0xFFFFFFFF) * 0x5A76F899) + (seed >> 32));
 * ```
 *
 * @param seed - 64-bit unsigned seed (bigint)
 * @returns Updated 64-bit seed
 */
export function updateSeedUlong(seed: bigint): bigint {
  const lo = seed & MASK32;
  const hi = seed >> 32n;
  return ((lo * LCG_MULTIPLIER) & MASK64) + hi;
}

// ─── UpdateSeed (cache version) ───────────────────────────────────────

/**
 * Update the byte-array seed cache (LCG step).
 *
 * C# code:
 * ```
 * byte[] result = cache[0].Multiply(Multiplier).Add(cache[1]);
 * cache[0] = result.Shl(4);
 * cache[1] = result.Shr(4);
 * ```
 *
 * @param cache - The seed cache to update (mutated in place)
 * @param move - Number of update steps (default 1)
 * @returns The updated cache
 */
export function updateSeedCache(cache: SeedCache, move: number = 1): SeedCache {
  for (let i = 0; i < move; i++) {
    const result = add(multiply(cache.c0[0], CACHE_MULTIPLIER), cache.c0[1]);
    cache.c0[0] = shl(result, 4);
    cache.c0[1] = shr(result, 4);
  }
  return cache;
}

// ─── Seed Scrambling (64-bit) ─────────────────────────────────────────

/**
 * Rotate left for 32-bit unsigned values.
 * C# `BitOperations.RotateLeft(bot, 16)` where bot is uint.
 */
export function rotateLeft32(value: number, count: number): number {
  // Use >>> 0 to get unsigned 32-bit representation
  const val = value >>> 0;
  count = count % 32;
  if (count === 0) return val;
  const shifted = (val << count) >>> 0;
  const rotated = (shifted | (val >>> (32 - count))) >>> 0;
  return rotated;
}

/**
 * Rotate left for 64-bit unsigned values (bigint).
 */
export function rotateLeft64(value: bigint, count: bigint): bigint {
  count = count % 64n;
  if (count === 0n) return value & MASK64;
  const shifted = (value << count) & MASK64;
  const rotated = (shifted | (value >> (64n - count))) & MASK64;
  return rotated;
}

/**
 * Sign-extend a ulong value to a 32-bit signed int.
 *
 * C# code:
 * ```
 * public static int Sxd(this ulong self, int bitLength)
 * {
 *     string extendee = Convert.ToString((long)self, 2).PadLeft(bitLength, '0');
 *     extendee = extendee.PadLeft(32, extendee[0]);
 *     return Convert.ToInt32(extendee, 2);
 * }
 * ```
 */
export function sxdUlong(value: bigint, bitLength: number): number {
  const mask = (1n << BigInt(bitLength)) - 1n;
  const masked = value & mask;
  const signBit = 1n << BigInt(bitLength - 1);
  if (masked & signBit) {
    const extended = masked | (~mask & MASK64);
    return Number(BigInt.asIntN(32, extended));
  } else {
    return Number(masked);
  }
}

/**
 * Generate a random uint in range [lower, upper).
 *
 * C# code:
 * ```
 * public static uint NextUint(this Random random, uint lower, uint upper)
 * {
 *     return (uint)(lower + (upper - lower) * random.NextDouble());
 * }
 */
export function nextUint(lower: number, upper: number): number {
  return Math.floor(lower + (upper - lower) * Math.random());
}
