/**
 * Name generation engine.
 *
 * Ported from C# SystemNameCalculator.NameGen.Generator
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/Generator.cs
 */

import type { SeedCache } from "./types.js";
import { ALPHASETS } from "./data/alphabets.js";
import {
  multiply,
  add as addB,
  sub,
  shr,
  shl,
  and,
  or,
  formatShort,
  bytesToBigint,
} from "./byte-utils.js";
import { updateSeedCache } from "./seed.js";

// ─── Constants ────────────────────────────────────────────────────────

const TINY_DOUBLE = 2.3283064370807974e-10;
const VOWELS = "aeiou";

// ─── Letter Map Types ────────────────────────────────────────────────

type LetterMapWeight = { Item1: string; Item2: number };

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let _letterMapSync: Record<number, Record<string, unknown>> | null = null;

function getLetterMapSync(): Record<number, Record<string, unknown>> {
  if (_letterMapSync === null) {
    const data = require("./data/letter-map.json") as Record<string, Record<string, unknown>>;
    _letterMapSync = {};
    for (const key of Object.keys(data)) {
      _letterMapSync[Number(key)] = data[key]!;
    }
  }
  return _letterMapSync;
}

// ─── Main Generation Function ────────────────────────────────────────

/**
 * Generate a name from seed cache.
 *
 * C# Generator.GenerateName(ref byte[][] cache0, ref byte[][] cache1)
 */
export function generateName(
  cache0: [number[], number[]],
  cache1: [number[], number[], number[]],
): string {
  let alternateCharGetter = false;
  let name = getCharactersFromAlphaset(cache0, cache1);

  // C# line 22: cache0 = cache0.UpdateSeed()
  updateSeedCache({ c0: cache0, c1: cache1 });

  // C# line 23: check alternate getter
  // BitConverter.ToInt16(cache0[0].And(new byte[] { 0x01 }).Zxd(2))
  const check = and(cache0[0], [0x01]);
  const checkExt = zxd(check, 2);
  if (toInt16(checkExt) !== 0) alternateCharGetter = true;

  // C# line 24: cache0 = cache0.UpdateSeed()
  updateSeedCache({ c0: cache0, c1: cache1 });

  // C# line 25: register[0] = cache1[2].Add(0x01).Sub(cache1[1]).Multiply(cache0[0]).Shr(4).Add(cache1[1]).Sub(0x03)
  let reg0 = sub(addB(cache1[2], [0x01]), cache1[1]);
  reg0 = multiply(reg0, cache0[0]);
  reg0 = shr(reg0, 4);
  reg0 = addB(reg0, cache1[1]);
  reg0 = sub(reg0, [0x03]);

  // C# uses register[0].Sxd(2) for loop limit, but 'add' is decremented separately
  const addLimit = toInt16Signed(reg0);
  let add = addLimit;

  // C# line 29: if (0 < add)
  if (addLimit > 0) {
    let tries = 8;

    for (let i = 0; i < addLimit; i++) {
      updateSeedCache({ c0: cache0, c1: cache1 });

      const trigram = name.substring(i, i + 3);
      const alphasetIdx = cache1[0]![0]! % ALPHASETS.length;
      const charWeights = getStringWeights(trigram, alphasetIdx);

      let target = Math.fround(Number(bytesToBigint(cache0[0]!)) * TINY_DOUBLE);

      if (charWeights === null) {
        tries--;
        i--;

        // Adjust alphaset
        let val = addB(cache1[0], [0x01]);
        val = and(val, [0x07, 0x00, 0x00, 0x80]);
        cache1[0] = val;

        if (toInt32(zxd(cache1[0], 4)) < 0) {
          let adjusted = sub(cache1[0], [0x01]);
          adjusted = or(adjusted, [0xf8, 0xff, 0xff, 0xff]);
          adjusted = addB(adjusted, [0x01]);
          cache1[0] = adjusted;
        }

        if (tries === 0) {
          if (add < 3) break;

          const temp = getCharactersFromAlphaset(cache0, cache1);

          if (
            VOWELS.includes(name[i + 2]!) &&
            VOWELS.includes(temp[0]!)
          ) {
            name += "'";
          } else if (!VOWELS.includes(temp[0]!)) {
            updateSeedCache({ c0: cache0, c1: cache1 });
            const vowelIdx = shr(multiply(cache0[0]!, [0x05]), 4);
            name += VOWELS[vowelIdx[0]! % 5];
          }

          name += temp;
          tries = 1;
          i += 2;
          add -= 3;
        }
      } else {
        let index: number;

        if (alternateCharGetter) {
          target = Math.fround(target * (charWeights.length - 1));
          // C# extracts sign bit, builds float with exponent 0x3F (=0.5), adds to target
          // For positive target: (int)(0.5 + target) = floor(0.5 + target)
          index = Math.floor(0.5 + target);
        } else {
          let weight = 0;
          let j = 0;
          for (j = 0; j < charWeights.length; j++) {
            weight = Math.fround(weight + Math.fround(charWeights[j]![1]));
            if (weight >= target) break;
          }
          index = j;
        }

        if (index >= charWeights.length) index = charWeights.length - 1;
        if (index < 0) index = 0;

        name += charWeights[index]![0];
        add -= 1;
      }

      if (name.length > 63) name = name.substring(0, 64);
    }
  }

  // C# lines 103-118: vowel insertion at start
  // This section has `goto finalise` semantics - if certain conditions are met,
  // we skip the vowel insertion and jump to finalise.
  const first = name[0]!;
  const second = name[1]!;

  let skipStartVowel = false;

  if (!VOWELS.includes(first) && !VOWELS.includes(second)) {
    if (first !== "s" || !"hklmnprtwy".includes(second)) {
      // Check goto conditions
      if (second === "h" && "ctw".includes(first)) skipStartVowel = true;
      else if (second === "l" && "bcfgps".includes(first)) skipStartVowel = true;
      else if (second === "r" && "bcdfgkpt".includes(first)) skipStartVowel = true;
      else if (second === "w" && "dgt".includes(first)) skipStartVowel = true;
      else if (second === "y" && "hmr".includes(first)) skipStartVowel = true;
      else {
        name = insertVowel(name, cache0, 1);
      }
    }
  }

  // C# lines 120-136: finalise - vowel insertion at end
  // This ALWAYS runs (it's after the goto target)
  {
    const ult = name[name.length - 1]!;
    const penult = name[name.length - 2]!;

    if (name.length > 1) {
      if (penult !== "g" || VOWELS.includes(ult)) {
        if (ult === "b" && "gn".includes(penult)) name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "d" && "bdfghkmpst".includes(penult)) name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "g" && penult === "l") name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "p" && "bdhkt".includes(penult)) name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "r" && "bfg".includes(penult)) name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "t" && penult === "g") name = insertVowel(name, cache0, name.length - 1);
        else if (ult === "w" && !VOWELS.includes(penult)) name = insertVowel(name, cache0, name.length - 1);
      }
    }
  }

  // C# lines 138-144: consecutive consonant fix
  const consonanceIndex = getConsecutiveConsonants(name);
  if (consonanceIndex !== -1) {
    updateSeedCache({ c0: cache0, c1: cache1 });
    const offset = addB(shr(multiply(cache0[0]!, [0x03]), 4), [0x01]);
    const insertIdx = consonanceIndex + toInt32(zxd(offset, 4));
    if (insertIdx >= 0 && insertIdx <= name.length) {
      name = insertVowel(name, cache0, Math.min(insertIdx, name.length));
    }
  }

  return name;
}

// ─── Vowel Insertion ─────────────────────────────────────────────────

function insertVowel(
  name: string,
  cache0: [number[], number[]],
  index: number,
): string {
  // C# InsertVowel: seed.UpdateSeed() where seed = cache0
  // Uses cache0[0] and cache0[1] (matching fixed updateSeedCache)
  updateSeedCache({ c0: cache0, c1: [[], [], []] });
  const result = multiply(cache0[0]!, [0x05]);
  const shrResult = shr(result, 4);
  const vowelIdx = shrResult[0]! % 5;
  const vowel = VOWELS[vowelIdx];
  return name.substring(0, index) + vowel + name.substring(index);
}

// ─── Alphaset Operations ─────────────────────────────────────────────

function getCharactersFromAlphaset(
  cache0: [number[], number[]],
  cache1: [number[], number[], number[]],
): string {
  updateSeedCache({ c0: cache0, c1: cache1 });

  const alphasetIdx = cache1[0]![0]! % ALPHASETS.length;
  const alphaset = ALPHASETS[alphasetIdx]!;
  const poolSize = Math.floor(alphaset.length / 3);

  const register0 = multiply(cache0[0]!, toLittleEndianBytes(poolSize));
  const register1 = formatShort(multiply(shr(register0, 4), [0x03]));

  const startIdx = toInt16(register1);
  const endIdx = toInt16(addB(register1, [0x03]));

  return alphaset.substring(Math.max(0, startIdx), Math.min(alphaset.length, endIdx));
}

// ─── Weight Lookup ───────────────────────────────────────────────────

function getStringWeights(
  str: string,
  alphaset: number,
): [string, number][] | null {
  const letterMap = getLetterMapSync();
  const alphasetMap = letterMap[alphaset];
  if (!alphasetMap) return null;

  const entry = alphasetMap[str[0]!];
  if (!entry) return null;

  return recursiveSearch(entry as [string, unknown, string][], str);
}

function recursiveSearch(
  arr: [string, unknown, string][],
  str: string,
): [string, number][] | null {
  let result: [string, number][] | null = null;
  let i = 0;

  while (result === null) {
    if (i >= arr.length) return null;

    const node = arr[i]!;
    const key = node[0] as string;
    const childrenOrWeights = node[1];
    const nodeType = node[2] as string;

    if (nodeType === "ja") {
      const strBytes = new TextEncoder().encode(str.substring(0, 3));
      const keyBytes = new TextEncoder().encode(key.substring(0, 3));
      if (bytesToSignedInt32(strBytes) > bytesToSignedInt32(keyBytes)) {
        result = recursiveSearch(childrenOrWeights as [string, unknown, string][], str);
      }
    } else if (nodeType === "jz") {
      if (key === str) {
        const weights = childrenOrWeights as { Item1: string; Item2: number }[];
        return weights.map((w) => [w.Item1, w.Item2]);
      }
      result = null;
    }

    i++;
  }

  return result;
}

// ─── Validation Helpers ──────────────────────────────────────────────

export function vowelInsertedAtStart(first: string, second: string): boolean {
  if (!VOWELS.includes(first) && !VOWELS.includes(second)) {
    if (first !== "s" || !"hklmnprtwy".includes(second)) {
      if (second === "h" && "ctw".includes(first)) return false;
      if (second === "l" && "bcfgps".includes(first)) return false;
      if (second === "r" && "bcdfgkpt".includes(first)) return false;
      if (second === "w" && "dgt".includes(first)) return false;
      if (second === "y" && "hmr".includes(first)) return false;
      return true;
    }
  }
  return false;
}

export function vowelInsertedAtEnd(ult: string, penult: string): boolean {
  if (penult !== "g" || VOWELS.includes(ult)) {
    if (ult === "b" && "gn".includes(penult)) return true;
    if (ult === "d" && "bdfghkmpst".includes(penult)) return true;
    if (ult === "g" && penult === "l") return true;
    if (ult === "p" && "bdhkt".includes(penult)) return true;
    if (ult === "r" && "bfg".includes(penult)) return true;
    if (ult === "t" && penult === "g") return true;
    if (ult === "w" && !VOWELS.includes(penult)) return true;
  }
  return false;
}

export function getConsecutiveConsonants(name: string): number {
  let consonance = 0;
  for (let i = 0; i < name.length; i++) {
    if (consonance < 3) {
      if (!VOWELS.includes(name[i]!)) consonance++;
      else consonance = 0;
    } else {
      if (!"aeiouy".includes(name[i]!)) return i - 3;
      else consonance = 0;
    }
  }
  return -1;
}

// ─── Utility Functions ───────────────────────────────────────────────

function toInt16(arr: number[]): number {
  if (arr.length === 0) return 0;
  let val = 0;
  for (let i = Math.min(arr.length, 2) - 1; i >= 0; i--) {
    val = (val << 8) | (arr[i]! & 0xff);
  }
  if (val >= 0x8000) val -= 0x10000;
  return val;
}

function toInt32(arr: number[]): number {
  if (arr.length === 0) return 0;
  let val = 0;
  for (let i = Math.min(arr.length, 4) - 1; i >= 0; i--) {
    val = (val << 8) | (arr[i]! & 0xff);
  }
  if (val >= 0x80000000) val -= 0x100000000;
  return val;
}

function toInt16Signed(arr: number[]): number {
  return toInt16(arr);
}

function zxd(arr: number[], extend: number): number[] {
  if (arr.length >= extend) return [...arr];
  return [...arr, ...new Array(extend - arr.length).fill(0)];
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

function bytesToSignedInt32(bytes: Uint8Array): number {
  let val = 0;
  const len = Math.min(bytes.length, 4);
  for (let i = len - 1; i >= 0; i--) {
    val = (val << 8) | (bytes[i]! & 0xff);
  }
  if (val >= 0x80000000) val -= 0x100000000;
  return val;
}

export { ALPHASETS as Alphasets };
