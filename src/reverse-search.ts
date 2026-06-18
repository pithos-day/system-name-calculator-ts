/**
 * Reverse search: find seed coordinates from a name.
 *
 * Ported from C# SystemNameCalculator.NameGen.ReverseSearch
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/ReverseSearch.cs
 *
 * NOTE: Exhaustive search iterates up to 2^32 seeds.
 * Use `onProgress` callback and `maxResults` to control execution.
 */

import type { SeedRange, WeightData, SearchResult } from "./types.js";
import { updateSeedUlong, rotateLeft32 } from "./seed.js";
import { Alphasets } from "./generator.js";
import {
  vowelInsertedAtStart,
  vowelInsertedAtEnd,
  getConsecutiveConsonants,
} from "./generator.js";
import { formatSystemName } from "./system-name.js";
import { formatRegionName, PROC_ADORNMENTS } from "./region-name.js";
import {
  formatRegionGrfCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
} from "./coords.js";

// ─── Constants ────────────────────────────────────────────────────────

const TINY_DOUBLE = 2.3283064370807974e-10;
const U32_MAX = 0xffffffff;
const SEARCH_PROGRESS_INTERVAL = 0x28f5c28; // ~43M iterations per progress tick

// ─── Public API ───────────────────────────────────────────────────────

export interface ReverseSearchOptions {
  galaxy: number;
  maxResults?: number;
  onProgress?: (found: number, progressPercent: number) => void;
}

/**
 * Find all seed values that produce the given system name in the given galaxy.
 *
 * @param name - System name (e.g. "Oyamagawa")
 * @param options - Search options including galaxy, max results, and progress callback
 * @returns Array of seed values (as number[] coordinate bytes, little-endian 8 bytes)
 */
export function findSystemSeeds(
  name: string,
  options: ReverseSearchOptions,
): number[][] {
  const ranges = constructSystemRanges(name, options.maxResults ?? 1, options.galaxy);
  if (ranges === null) return [];
  return exhaustiveSystemSearch(ranges, options.maxResults ?? 1, name, options.galaxy, options.onProgress);
}

/**
 * Find all seed values that produce the given region name in the given galaxy.
 *
 * @param name - Region name (e.g. "Uefertin Void" or "Sea of Aosh")
 * @param options - Search options including galaxy, max results, and progress callback
 * @returns Array of search results with seed and formatted coordinates
 */
export function findRegionSeeds(
  name: string,
  options: ReverseSearchOptions,
): SearchResult[] {
  const ranges = constructRegionRanges(name, options.maxResults ?? 1, options.galaxy);
  if (ranges === null) return [];
  const seeds = exhaustiveRegionSearch(ranges, options.maxResults ?? 1, name, options.galaxy, options.onProgress);

  return seeds.map((seedBytes) => {
    const seedNum = bytesToU64(seedBytes);
    const galaxyOffset = BigInt(options.galaxy) * 0x100000000n;
    const full = seedNum + galaxyOffset;
    return {
      seed: seedBytes,
      signalBoosterCoords: formatRegionBoosterCoords(full),
      rawCoords: formatRegionRawCoords(full),
      portalCoords: formatRegionGrfCoords(full),
    };
  });
}

// ─── System Search ────────────────────────────────────────────────────

function constructSystemRanges(
  name: string,
  cap: number,
  galaxy: number,
): SeedRange[] | null {
  const origName = name;
  name = name.toLowerCase();

  // Validate name format (single word, 6-9 chars, valid generator output)
  if (
    name.split(" ").length !== 1 ||
    name.length > 9 ||
    name.length < 6 ||
    vowelInsertedAtStart(name[0]!, name[1]!) ||
    vowelInsertedAtEnd(name[name.length - 1]!, name[name.length - 2]!) ||
    getConsecutiveConsonants(name) !== -1
  ) {
    return null;
  }

  const weights = getWeightsForName(name, [0]);
  if (weights[0] === null) return null;

  const ranges: SeedRange[] = [];

  // Range 0: alphaset selection + name length
  ranges.push({
    botRange: [],
    topRange: [[0, U32_MAX]],
    updates: [],
    linkOffset: 2,
  });

  for (let i = 0; i <= 9 - name.length; i++) {
    ranges[0]!.botRange.push([
      Math.floor(((3 - i) * 0x100000000) / 4),
      Math.floor((((3 - i) * 0x100000000 + U32_MAX)) / 4),
    ]);
    ranges[0]!.updates.push(1);
  }

  // Weight-based ranges from name generation
  const weightRanges = getNameGenSeedRanges(weights, name, 6, [name.length, 9], false);
  ranges.push(...weightRanges);

  // Adornment check range (no adornment: bot >= 0xCCCCCCCD)
  ranges.push({
    botRange: [[0xcccccccd, U32_MAX]],
    topRange: [[0, U32_MAX]],
    updates: [1],
    linkOffset: 0,
  });

  return ranges;
}

function exhaustiveSystemSearch(
  ranges: SeedRange[],
  cap: number,
  name: string,
  galaxy: number,
  onProgress?: (found: number, progressPercent: number) => void,
): number[][] {
  const result: number[][] = [];
  let progress = 0;

  for (let i = 0; i <= U32_MAX; i++) {
    // Construct the full coordinate (galaxy in upper 32 bits)
    const current = i + galaxy * 0x100000000;
    const currentBig = BigInt(current);

    // Scramble: seed = (current ^ (galaxy/2)) * multiplier chain
    let seed = currentBig ^ (BigInt(galaxy) / 2n);
    seed = (seed * 0x64dd81482cbd31d7n) & 0xffffffffffffffffn;
    seed = ((((seed >> 32n) / 2n) ^ seed) * 0xe36aa5c613612997n) & 0xffffffffffffffffn;
    seed = ((seed >> 32n) / 2n) ^ seed;

    // Reconstruct seed with RotateLeft
    const bot = Number(seed & 0xffffffffn);
    const top = Number((seed >> 32n) & 0xffffffffn);
    const rotated = rotateLeft32(bot, 16);
    const newBot = (bot + ((rotated ^ top ^ bot) >>> 0)) | 0;
    let finalSeed = (BigInt(newBot) & 0xffffffffn) | ((BigInt(top) & 0xffffffffn) << 32n);
    if (bot === 0) finalSeed = (finalSeed + 1n) & 0xffffffffffffffffn;

    // Apply LCG step
    finalSeed = updateSeedUlong(finalSeed);

    if (trySeed(finalSeed, ranges)) {
      // Verify by generating name from the raw coordinate
      const coordBytes = u64ToBytes(currentBig);
      const generated = formatSystemName(coordBytes);
      if (generated.toLowerCase() === name.toLowerCase()) {
        result.push(u64ToBytes(currentBig));
        onProgress?.(result.length, progress);
      }
    }

    if (i % SEARCH_PROGRESS_INTERVAL === 0) {
      progress = Math.floor((i / U32_MAX) * 100);
      onProgress?.(result.length, progress);
    }

    if (result.length >= cap) break;
  }

  return result;
}

// ─── Region Search ────────────────────────────────────────────────────

function constructRegionRanges(
  name: string,
  cap: number,
  galaxy: number,
): SeedRange[] | null {
  const origName = name;
  let adorn = -1;
  const split = name.split(" ");

  // Check for adornment
  for (let i = 0; i < PROC_ADORNMENTS.length; i++) {
    const adornParts = PROC_ADORNMENTS[i]!.split(" ");
    if (split.length === 2 && adornParts[1] === split[1]) {
      name = split[0]!;
      adorn = i;
    } else if (split.length > 2 && adornParts[0] === split[0]) {
      name = split[split.length - 1]!;
      adorn = i;
    }
  }

  name = name.toLowerCase();

  // Validate name format
  if (
    name.split(" ").length !== 1 ||
    name.length > 9 ||
    name.length < 6 ||
    vowelInsertedAtStart(name[0]!, name[1]!) ||
    vowelInsertedAtEnd(name[name.length - 1]!, name[name.length - 2]!) ||
    getConsecutiveConsonants(name) !== -1
  ) {
    return null;
  }

  const weights = getWeightsForName(name, [0]);
  if (weights[0] === null) return null;

  const ranges: SeedRange[] = [];

  // Range 0: alphaset + name length
  ranges.push({
    botRange: [],
    topRange: [[0, U32_MAX]],
    updates: [],
    linkOffset: 2,
  });

  for (let i = 0; i <= 9 - name.length; i++) {
    ranges[0]!.botRange.push([
      Math.floor(((3 - i) * 0x100000000) / 4),
      Math.floor((((3 - i) * 0x100000000 + U32_MAX)) / 4),
    ]);
    ranges[0]!.updates.push(1);
  }

  // Weight-based ranges
  const weightRanges = getNameGenSeedRanges(weights, name, 6, [name.length, 9], false);
  ranges.push(...weightRanges);

  // Adornment check range
  if (adorn === -1) {
    ranges.push({
      botRange: [[0xcccccccd, U32_MAX]],
      topRange: [[0, U32_MAX]],
      updates: [1],
      linkOffset: 0,
    });
  } else {
    ranges.push({
      botRange: [[0, 0xcccccccc]],
      topRange: [[0, U32_MAX]],
      updates: [1],
      linkOffset: 0,
    });
    ranges.push({
      botRange: [
        [
          Math.floor((adorn * 0x100000000) / 20),
          Math.floor(((adorn * 0x100000000 + U32_MAX)) / 20),
        ],
      ],
      topRange: [[0, U32_MAX]],
      updates: [1],
      linkOffset: 0,
    });
  }

  return ranges;
}

function exhaustiveRegionSearch(
  ranges: SeedRange[],
  cap: number,
  name: string,
  galaxy: number,
  onProgress?: (found: number, progressPercent: number) => void,
): number[][] {
  const result: number[][] = [];
  let progress = 0;

  for (let i = 0; i <= U32_MAX; i++) {
    const current = i + galaxy * 0x100000000;
    const currentBig = BigInt(current);

    // Same scramble as system search
    let seed = currentBig ^ (BigInt(galaxy) / 2n);
    seed = (seed * 0x64dd81482cbd31d7n) & 0xffffffffffffffffn;
    seed = ((((seed >> 32n) / 2n) ^ seed) * 0xe36aa5c613612997n) & 0xffffffffffffffffn;
    seed = ((seed >> 32n) / 2n) ^ seed;

    const bot = Number(seed & 0xffffffffn);
    const top = Number((seed >> 32n) & 0xffffffffn);
    const rotated = rotateLeft32(bot, 16);
    const newBot = (bot + ((rotated ^ top ^ bot) >>> 0)) | 0;
    let finalSeed = (BigInt(newBot) & 0xffffffffn) | ((BigInt(top) & 0xffffffffn) << 32n);
    if (bot === 0) finalSeed = (finalSeed + 1n) & 0xffffffffffffffffn;

    finalSeed = updateSeedUlong(finalSeed);

    if (trySeed(finalSeed, ranges)) {
      const coordBytes = u64ToBytes(currentBig);
      const generated = formatRegionName(coordBytes);
      if (generated.toLowerCase() === name.toLowerCase()) {
        result.push(coordBytes);
        onProgress?.(result.length, progress);
      }
    }

    if (i % SEARCH_PROGRESS_INTERVAL === 0) {
      progress = Math.floor((i / U32_MAX) * 100);
      onProgress?.(result.length, progress);
    }

    if (result.length >= cap) break;
  }

  return result;
}

// ─── Range Validation ─────────────────────────────────────────────────

function trySeed(seed: bigint, ranges: SeedRange[]): boolean {
  const linkInfo: [number, number][] = [];

  for (let i = 0; i < ranges.length; i++) {
    const bot = Number(seed & 0xffffffffn) >>> 0;

    let index: number;
    const linkIdx = linkInfo.findIndex((x) => x[0] === i);
    if (linkIdx !== -1) {
      index = linkInfo[linkIdx]![1];
      linkInfo.splice(linkIdx, 1);
    } else {
      index = ranges[i]!.botRange.findIndex(
        (x) => bot >= x[0] && bot <= x[1],
      );
    }

    if (ranges[i]!.linkOffset !== 0) {
      linkInfo.push([i + ranges[i]!.linkOffset, index]);
    }

    if (
      index === -1 ||
      bot < ranges[i]!.botRange[index]![0] ||
      bot > ranges[i]!.botRange[index]![1]
    ) {
      return false;
    }

    for (let j = 0; j < ranges[i]!.updates[index]!; j++) {
      seed = updateSeedUlong(seed);
    }
  }

  return true;
}

// ─── Weight Analysis ──────────────────────────────────────────────────

function alphasetStringIndex(str: string, set: number): number {
  const alphaset = Alphasets[set]!;
  for (let i = 0; i < alphaset.length; i += 3) {
    if (str === alphaset.substring(i, i + 3)) return i;
  }
  return -1;
}

function getNameGenSeedRanges(
  data: (WeightData | null)[],
  name: string,
  constant: number,
  add: [number, number],
  alternate: boolean,
): SeedRange[] {
  const result: SeedRange[] = [];

  for (let i = 0; i < (data[0] !== null ? data[0]!.weights.length : 0) + 2; i++) {
    result.push({
      botRange: [],
      topRange: [[0, U32_MAX]],
      updates: [],
      linkOffset: 0,
    });
  }

  // Range 0: first trigram alphaset index
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) continue;
    const wd = data[i]!;
    const seedbase = Math.floor(
      (alphasetStringIndex(name.substring(0, 3), wd.alphaset) / 3) * 0x100000000,
    );
    const divisor = Math.floor(Alphasets[wd.alphaset]!.length / 3);
    result[0]!.botRange.push([
      Math.floor(seedbase / divisor),
      Math.floor((seedbase + U32_MAX) / divisor),
    ]);
    result[0]!.updates.push(2);
  }
  result[0]!.linkOffset = 2;

  // Range 1: name length constraint
  for (let i = 0; i <= add[1] - add[0]; i++) {
    result[1]!.botRange.push([
      Math.floor(
        ((name.length - constant) * 0x100000000) /
          (add[1] - constant - i + 1),
      ),
      Math.floor(
        (((name.length - constant) * 0x100000000 + U32_MAX)) /
          (add[1] - constant - i + 1),
      ),
    ]);
    result[1]!.updates.push(1);
  }

  // Ranges 2+: per-character weight ranges
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) continue;
    const wd = data[i]!;
    for (let j = 0; j < wd.weights.length; j++) {
      const rangeIdx = j + 2;
      if (rangeIdx >= result.length) continue;

      if (j === wd.weights.length - 1) {
        result[rangeIdx]!.updates.push(1);
        result[rangeIdx]!.linkOffset = 0;
      } else {
        const nextWd = wd;
        result[rangeIdx]!.updates.push(
          ((nextWd.alphaset - wd.alphaset + 8) % 8) + 1,
        );
        result[rangeIdx]!.linkOffset = 1;
      }

      if (alternate) {
        result[rangeIdx]!.botRange.push([
          Math.floor(
            ((wd.index - 0.5) / (wd.weights.length - 1) / TINY_DOUBLE) >>> 0,
          ),
          Math.floor(
            ((wd.index + 0.5) / (wd.weights.length - 1) / TINY_DOUBLE) >>> 0,
          ),
        ]);
      } else {
        let sum = 0;
        for (let k = 0; k <= wd.index; k++) {
          sum += wd.weights[k]![1];
        }
        result[rangeIdx]!.botRange.push([
          Math.floor(((sum - wd.weights[wd.index]![1]) / TINY_DOUBLE) >>> 0),
          Math.floor((sum / TINY_DOUBLE) >>> 0),
        ]);
      }
    }
  }

  return verifyRanges(result);
}

function verifyRanges(ranges: SeedRange[]): SeedRange[] {
  for (const range of ranges) {
    for (let j = 0; j < range.botRange.length; j++) {
      const [lo, hi] = range.botRange[j]!;
      if (hi < lo) {
        range.botRange[j] = [lo, U32_MAX];
      }
    }
  }
  return ranges;
}

function getWeightsForName(
  name: string,
  alphasets: number[],
): (WeightData | null)[] {
  const loop = name.length - 3;
  const result: (WeightData | null)[] = [];
  const graph: Map<string, { status: number; data: WeightData | null }> = new Map();

  for (let i = 0; i < alphasets.length; i++) {
    const setIdx = alphasets[i]!;
    const start = getStringWeights(name.substring(0, 3), setIdx);
    const idx = start !== null ? start.findIndex((x) => x[0] === name[3]) : -1;

    if (start === null || idx === -1) {
      result.push(null);
      continue;
    }

    const weightDataList: WeightData[] = [
      { weights: start, alphaset: setIdx, index: idx },
    ];

    let prev = setIdx;
    let tries = 8;

    for (let j = 1; j < loop; j++) {
      let found = false;
      for (let k = 0; k < tries; k++) {
        const loc = (k + prev) % 8;
        const key = `${loc},${j}`;

        const cached = graph.get(key);
        if (cached !== undefined) {
          if (cached.data !== null) {
            weightDataList.push(cached.data);
            prev = loc;
            tries -= k;
            found = true;
            break;
          } else if (cached.status === -1) {
            if (k === tries - 1) {
              result.push(null);
              found = true;
              break;
            }
          } else {
            result.push(null);
            found = true;
            break;
          }
        } else {
          const weights = getStringWeights(name.substring(j, j + 3), loc);
          if (weights === null) {
            graph.set(key, { status: -1, data: null });
            if (k === tries - 1) {
              result.push(null);
              found = true;
              break;
            }
          } else {
            const nextIdx = weights.findIndex((x) => x[0] === name[j + 3]);
            if (nextIdx !== -1) {
              const wd: WeightData = { weights, alphaset: loc, index: nextIdx };
              graph.set(key, { status: 1, data: wd });
              weightDataList.push(wd);
              prev = loc;
              tries -= k;
              found = true;
              break;
            } else {
              graph.set(key, { status: -2, data: null });
              result.push(null);
              found = true;
              break;
            }
          }
        }
      }
      if (found) continue;
    }

    if (result.length <= i) {
      result.push(weightDataList.length > 0 ? weightDataList[0]! : null);
    }
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getStringWeights(
  str: string,
  alphaset: number,
): [string, number][] | null {
  // Lazy-load the letter map (same pattern as generator.ts)
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

function bytesToSignedInt32(bytes: Uint8Array): number {
  let val = 0;
  const len = Math.min(bytes.length, 4);
  for (let i = len - 1; i >= 0; i--) {
    val = (val << 8) | (bytes[i]! & 0xff);
  }
  if (val >= 0x80000000) val -= 0x100000000;
  return val;
}

function u64ToBytes(val: bigint): number[] {
  const bytes: number[] = [];
  let v = val & 0xffffffffffffffffn;
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return bytes;
}

function bytesToU64(bytes: number[]): bigint {
  let val = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    val = (val << 8n) | BigInt(bytes[i]! & 0xff);
  }
  return val;
}
