/**
 * System name generation from coordinates.
 *
 * Ported from C# SystemNameCalculator.NameGen.SystemName
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/SystemName.cs
 *
 * Aligned with nms_namegen system.py systemName() behavior including
 * hyphenated names and Roman numeral suffixes.
 */

import type { SeedCache } from "./types.js";
import {
  multiply,
  add,
  shr,
  shl,
  rol,
  xor,
  bytesToBigint,
} from "./byte-utils.js";
import { CACHE_MULTIPLIER, updateSeedCache } from "./seed.js";
import { generateName } from "./generator.js";

// ─── Constants ────────────────────────────────────────────────────────

const ROMAN_NUMERALS = [
  "I", "II", "III", "IV", "V", "VI", "VII",
  "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
  "XVII", "XVIII", "XIX", "XX",
];

// ─── System Name Generation ──────────────────────────────────────────

/**
 * Generate a system name from a byte array seed.
 *
 * Matches nms_namegen system.py systemName() behavior including
 * hyphenated names and Roman numeral suffixes.
 *
 * @param seed - 12-byte little-endian seed from coordinates
 * @returns Generated system name with first letter capitalized
 */
export function formatSystemName(seed: number[]): string {
  // Split seed into galactic coords and system index
  const galacticCoords = shl(seed, 4);
  const systemIndex = shr(seed, 4);

  const cache0: [number[], number[]] = [new Array<number>(), new Array<number>()];
  const cache1: [number[], number[], number[]] = [
    new Array<number>(),
    [0x06],
    new Array<number>(),
  ];

  // Steps 1-6 (register initialization)
  const galCoordsInt = toInt32(galacticCoords);
  let reg0: number[];

  if (galCoordsInt === 0) {
    reg0 = add(
      multiply(add(galacticCoords, [0x01]), CACHE_MULTIPLIER),
      xor(rol(galacticCoords, 2), xor(galacticCoords, systemIndex)),
    );
  } else {
    reg0 = add(
      multiply(galacticCoords, CACHE_MULTIPLIER),
      xor(rol(galacticCoords, 2), xor(galacticCoords, systemIndex)),
    );
  }

  // Step 8 (alphaset selection)
  const reg1Step8 = shr(multiply(shl(reg0, 4), [0x05]), 4);

  if (reg1Step8.length === 0 || reg1Step8.every((b) => b === 0)) {
    cache1[0] = [0x02];
  } else if (reg1Step8[0]! < 4) {
    cache1[0] = [reg1Step8[0]! + 0x02];
  } else {
    cache1[0] = [0x07];
  }

  // Steps 9-14
  const reg1 = add(multiply(shl(reg0, 4), CACHE_MULTIPLIER), shr(reg0, 4));
  cache0[0] = shl(reg1, 4);
  cache1[2] = add(shr(multiply(cache0[0], [0x04]), 4), [0x06]);
  cache0[1] = shr(reg1, 4);

  // Generate the base name
  let name = generateName(cache0, cache1);

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.substring(1);

  // Hyphenated names (nms_namegen system.py lines 58-75)
  if (name.length < 8) {
    const r = randomRange(cache0, cache1, 4);
    if (r < 2) {
      const alphasetReg = randomRange(cache0, cache1, 5);

      let alphasetIdx: number;
      if (alphasetReg === 0) {
        alphasetIdx = 0x02;
      } else if (alphasetReg < 4) {
        alphasetIdx = alphasetReg + 0x02;
      } else {
        alphasetIdx = 0x07;
      }

      // Set cache1 for min_length=3, max_length=5
      cache1[0] = [alphasetIdx];
      cache1[1] = [0x03];
      cache1[2] = [0x05];

      const name2 = generateName(cache0, cache1);
      name = `${name}-${name2.charAt(0).toUpperCase() + name2.substring(1)}`;
    }
  }

  // Roman numeral suffix (nms_namegen system.py lines 78-84)
  if (randomRange(cache0, cache1, 0x0A) < 0x03) {
    const n = randomRange(cache0, cache1, 19) + 1;
    name = `${name} ${ROMAN_NUMERALS[n - 1]}`;
  }

  return name;
}

// ─── Utility ─────────────────────────────────────────────────────────

/**
 * Compute random(range) matching nms_namegen PRNG.random():
 * advance seed by one LCG step, then return ((seed & 0xFFFFFFFF) * range) >> 32
 */
function randomRange(
  cache0: [number[], number[]],
  cache1: [number[], number[], number[]],
  range: number,
): number {
  updateSeedCache({ c0: cache0, c1: cache1 });
  const product = multiply(cache0[0]!, toLittleEndianBytes(range));
  const highBytes = shr(product, 4);
  return highBytes[0] ?? 0;
}

function toInt32(arr: number[]): number {
  if (arr.length === 0) return 0;
  let val = 0;
  const len = Math.min(arr.length, 4);
  for (let i = len - 1; i >= 0; i--) {
    val = (val << 8) | (arr[i]! & 0xff);
  }
  if (val >= 0x80000000) val -= 0x100000000;
  return val;
}

function toLittleEndianBytes(value: number): number[] {
  if (value === 0) return [0];
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.push(v & 0xff);
    v >>= 8;
  }
  return bytes;
}
