/**
 * Region name generation from coordinates.
 *
 * Ported from C# SystemNameCalculator.NameGen.RegionName
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/RegionName.cs
 */

import type { SeedCache } from "./types.js";
import {
  multiply,
  add,
  shr,
  shl,
  rol,
  xor,
} from "./byte-utils.js";
import { updateSeedCache } from "./seed.js";
import { generateName } from "./generator.js";

// ─── Constants ────────────────────────────────────────────────────────

/**
 * Region adornments (proc-gen suffixes/prefixes).
 * C# RegionName.ProcAdornments
 */
export const PROC_ADORNMENTS: string[] = [
  "%NAME% Adjunct",
  "%NAME% Void",
  "%NAME% Expanse",
  "%NAME% Terminus",
  "%NAME% Boundary",
  "%NAME% Fringe",
  "%NAME% Cluster",
  "%NAME% Mass",
  "%NAME% Band",
  "%NAME% Cloud",
  "%NAME% Nebula",
  "%NAME% Quadrant",
  "%NAME% Sector",
  "%NAME% Anomaly",
  "%NAME% Conflux",
  "%NAME% Instability",
  "Sea of %NAME%",
  "The Arm of %NAME%",
  "%NAME% Spur",
  "%NAME% Shallows",
];

// ─── Region Name Generation ──────────────────────────────────────────

/**
 * Generate a region name from a byte array seed.
 *
 * C# RegionName.FormatName(byte[] seed)
 *
 * @param seed - 10-byte little-endian seed from coordinates
 * @returns Generated region name with optional adornment
 */
export function formatRegionName(seed: number[]): string {
  const cache0: [number[], number[]] = [new Array<number>(), new Array<number>()];
  const cache1: [number[], number[], number[]] = [
    [0x00],
    [0x06],
    new Array<number>(),
  ];

  // C# lines 23-24: register[0] = seed.Shr(4); register[0][0] /= 2
  let reg0 = shr(seed, 4);
  if (reg0.length > 0) {
    reg0[0] = Math.floor(reg0[0]! / 2);
  }

  // C# line 25: register[0] = register[0].Xor(seed).Multiply(0xD731BD2C4881DD64)
  // Note: C# byte array is little-endian, so {0xD7, 0x31, 0xBD, 0x2C, 0x48, 0x81, 0xDD, 0x64}
  const MULTIPLIER_A = [0xd7, 0x31, 0xbd, 0x2c, 0x48, 0x81, 0xdd, 0x64];
  reg0 = multiply(xor(reg0, seed), MULTIPLIER_A);

  // C# line 26: Array.Resize(ref register[0], 8)
  while (reg0.length < 8) reg0.push(0);

  // C# lines 29-31: register[0] = (uint)(Shr(4) / 2).Xor(register[0]).Multiply(0xE36AA5C613612997)
  const MULTIPLIER_B = [0x97, 0x29, 0x61, 0x13, 0xc6, 0xa5, 0x6a, 0xe3];
  const shr4 = shr(reg0, 4);
  const uint32Div2 = Math.floor(toUint32(shr4) / 2);
  const uint32Bytes = uint32ToBytes(uint32Div2);
  reg0 = multiply(xor(uint32Bytes, reg0), MULTIPLIER_B);

  // C# line 33: Array.Resize(ref register[0], 8)
  while (reg0.length < 8) reg0.push(0);

  // C# lines 37: register[0] = (uint)(Shr(4) / 2).Xor(register[0])
  const shr4_2 = shr(reg0, 4);
  const uint32Div2_2 = Math.floor(toUint32(shr4_2) / 2);
  const uint32Bytes_2 = uint32ToBytes(uint32Div2_2);
  reg0 = xor(uint32Bytes_2, reg0);

  // C# lines 39-40: cache0 setup
  const reg0Shl4 = shl(reg0, 4);
  cache0[1] = xor(xor(rol(reg0Shl4, 2), shr(reg0, 4)), reg0Shl4);
  cache0[0] = reg0Shl4;

  // C# line 42: if cache0[0] is zero, add 1
  if (toInt32(cache0[0]) === 0) {
    cache0[0] = add(cache0[0], [0x01]);
  }

  // C# line 44: cache0 = cache0.UpdateSeed()
  updateSeedCache({ c0: cache0, c1: cache1 });

  // C# line 45: cache1[2] = cache0[0].Multiply(0x04).Shr(4).Add(0x06)
  cache1[2] = add(shr(multiply(cache0[0], [0x04]), 4), [0x06]);

  // C# line 49: Generate the name
  let name = generateName(cache0, cache1);

  // C# line 50: Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.substring(1);

  // C# line 52: cache0 = cache0.UpdateSeed()
  updateSeedCache({ c0: cache0, c1: cache1 });

  // C# lines 54-57: Check for adornment
  const check = multiply(cache0[0], [0x64]);
  const checkShr = shr(check, 4);
  if (checkShr[0] !== undefined && checkShr[0] < 0x50) {
    updateSeedCache({ c0: cache0, c1: cache1 });
    const adornIdx = multiply(cache0[0], [0x14]);
    const adornShr = shr(adornIdx, 4);
    const adornIndex = adornShr[0]! % PROC_ADORNMENTS.length;
    name = PROC_ADORNMENTS[adornIndex]!.replace("%NAME%", name);
  }

  return name;
}

// ─── Utility ─────────────────────────────────────────────────────────

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

function toUint32(arr: number[]): number {
  if (arr.length === 0) return 0;
  let val = 0;
  const len = Math.min(arr.length, 4);
  for (let i = len - 1; i >= 0; i--) {
    val = (val << 8) | (arr[i]! & 0xff);
  }
  return val >>> 0;
}

function uint32ToBytes(val: number): number[] {
  return [
    val & 0xff,
    (val >> 8) & 0xff,
    (val >> 16) & 0xff,
    (val >> 24) & 0xff,
  ];
}
