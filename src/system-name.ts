/**
 * System name generation from coordinates.
 *
 * Ported from C# SystemNameCalculator.NameGen.SystemName
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/SystemName.cs
 */

import type { SeedCache } from "./types.js";
import {
  multiply,
  add,
  shr,
  shl,
  rol,
  xor,
  formatBytes,
} from "./byte-utils.js";
import { CACHE_MULTIPLIER, updateSeedCache } from "./seed.js";
import { generateName } from "./generator.js";

// ─── System Name Generation ──────────────────────────────────────────

/**
 * Generate a system name from a byte array seed.
 *
 * C# SystemName.FormatName(byte[] seed)
 *
 * @param seed - 12-byte little-endian seed from coordinates
 * @returns Generated system name with first letter capitalized
 */
export function formatSystemName(seed: number[]): string {
  // C# line 21-22: Split seed into galactic coords and system index
  const galacticCoords = shl(seed, 4);
  const systemIndex = shr(seed, 4);

  const cache0: [number[], number[]] = [new Array<number>(), new Array<number>()];
  const cache1: [number[], number[], number[]] = [
    new Array<number>(),
    [0x06],
    new Array<number>(),
  ];

  // C# lines 32-35: Steps 1-6 (register initialization)
  const galCoordsInt = toInt32(galacticCoords);
  let reg0: number[];

  if (galCoordsInt === 0) {
    // If galactic coords is zero, add 1 first
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

  // C# lines 37-44: Step 8 (alphaset selection)
  const reg1Step8 = shr(multiply(shl(reg0, 4), [0x05]), 4);

  if (reg1Step8.length === 0 || reg1Step8.every((b) => b === 0)) {
    cache1[0] = [0x02];
  } else if (reg1Step8[0]! < 4) {
    cache1[0] = [reg1Step8[0]! + 0x02];
  } else {
    cache1[0] = [0x07];
  }

  // C# lines 46-52: Steps 9-14
  const reg1 = add(multiply(shl(reg0, 4), CACHE_MULTIPLIER), shr(reg0, 4));
  cache0[0] = shl(reg1, 4);
  cache1[2] = add(shr(multiply(cache0[0], [0x04]), 4), [0x06]);
  cache0[1] = shr(reg1, 4);

  // C# line 57: Generate the name
  let name = generateName(cache0, cache1);

  // C# line 58: Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.substring(1);

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
