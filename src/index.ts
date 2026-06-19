/**
 * system-name-calculator-ts
 *
 * TypeScript port of the C# SystemNameCalculator.
 * Generates and reverse-searches No Man's Sky system and region names
 * from/to coordinates using the game's procedural generation algorithm.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type { SeedCache, WeightData, SeedRange, SearchResult } from "./types.js";

// ─── Coordinate Conversion ────────────────────────────────────────────

export {
  systemCoordsToByteArray,
  systemXCoordsToByteArray,
  regionCoordsToByteArray,
  regionXCoordsToByteArray,
  formatRegionGrfCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
} from "./coords.js";

// ─── Forward Transformation (Coordinates → Name) ─────────────────────

export { formatSystemName, systemName, portalToSeed } from "./system-name.js";
export { regionName, formatRegionName, PROC_ADORNMENTS } from "./region-name.js";
export { planetName, planetSeed, planetSeeds, systemAttributes } from "./planet.js";

// ─── Name Generation Engine ───────────────────────────────────────────

export {
  generateName,
  vowelInsertedAtStart,
  vowelInsertedAtEnd,
  getConsecutiveConsonants,
  Alphasets,
} from "./generator.js";

// ─── Reverse Search (Name → Coordinates) ─────────────────────────────

export {
  findSystemSeeds,
  findRegionSeeds,
  type ReverseSearchOptions,
} from "./reverse-search.js";

// ─── Low-Level Utilities ─────────────────────────────────────────────

export {
  parseHex,
  formatHex,
  hexToBytes,
  bytesToHex,
  bytesToBigint,
  bigintToBytes,
  formatBytes,
  formatShort,
  multiply,
  add,
  sub,
  shr,
  shl,
  rol,
  xor,
  and,
  or,
  sxd,
  zxd,
} from "./byte-utils.js";

export {
  updateSeedUlong,
  updateSeedCache,
  rotateLeft32,
  rotateLeft64,
  sxdUlong,
  nextUint,
  CACHE_MULTIPLIER,
} from "./seed.js";
