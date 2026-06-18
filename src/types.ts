/**
 * Shared type definitions for SystemNameCalculator.
 *
 * Ported from C# SystemNameCalculator project.
 * @see https://github.com/.../SystemNameCalculator/NameGen/Generator.cs
 * @see https://github.com/.../SystemNameCalculator/NameGen/ReverseSearch.cs
 */

/**
 * Seed cache used by Generator.GenerateName and name formatters.
 *
 * In C# this is represented as `byte[][]` with:
 *   cache0 = [byte[], byte[]]  (2 elements)
 *   cache1 = [byte[], byte[], byte[]]  (3 elements)
 *
 * Each element is a little-endian byte array (number[]).
 */
export interface SeedCache {
  c0: [number[], number[]];
  c1: [number[], number[], number[]];
}

/**
 * Weight data for reverse search.
 * Maps a trigram to its possible next characters with probabilities.
 */
export interface WeightData {
  weights: [string, number][];
  alphaset: number;
  index: number;
}

/**
 * Seed range used in reverse search to narrow the search space.
 */
export interface SeedRange {
  botRange: [number, number][];
  topRange: [number, number][];
  updates: number[];
  linkOffset: number;
}

/**
 * Result of a reverse search operation.
 */
export interface SearchResult {
  seed: number[];
  signalBoosterCoords?: string;
  rawCoords?: string;
  portalCoords?: string;
}
