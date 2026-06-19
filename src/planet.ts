/**
 * Planet name generation.
 *
 * Ported from nms_namegen planet.py, system.py, and iprng.py.
 * Matches the Python reference implementation exactly.
 */

import { generateName } from "./generator.js";
import { updateSeedCache, updateSeedUlong } from "./seed.js";
import {
  multiply,
  add,
  shr,
  shl,
  xor,
} from "./byte-utils.js";

// ─── Constants ────────────────────────────────────────────────────────

const MASK64 = 0xFFFFFFFFFFFFFFFFn;
const MASK32 = 0xFFFFFFFFn;
const CONST_A = 0x64DD81482CBD31D7n;
const CONST_B = 0xE36AA5C613612997n;
const MULTIPLIER = 0x5A76F899n;
const TINY_DOUBLE = 2.3283064370807974e-10;

const ROMAN_NUMERALS = [
  "I", "II", "III", "IV", "V", "VI", "VII",
  "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
  "XVII", "XVIII", "XIX", "XX",
];

const PLANET_ADORNMENTS = [
  "Prime",
  "Major",
  "Minor",
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Omega",
  "Sigma",
  "Tau",
];

const PLANET_STYLES = [
  "%PROCNORM%",
  "%PROCNORM% %ADORNMENT%",
  "%PROCNORM% %NUMERAL%",
  "%PROCNORM% %SHORTCODE%",
  "%PROCLONG% %PROCSHORT%",
  "%PROCSHORT% %LONGCODE%",
  "%PROCNORM%",
  "%PROCNORM% %ADORNMENT%",
  "%PROCNORM% %NUMERAL%",
  "Style 9",
  "New %PROCNORM%",
];

// ─── PRNG (matching nms_namegen prng.py) ──────────────────────────────

interface PRNGState {
  seed: bigint;
}

function prngUpdateSeed(state: PRNGState): void {
  state.seed = ((state.seed & MASK32) * MULTIPLIER) + (state.seed >> 32n);
}

function prngRandom(state: PRNGState, range: number): number {
  prngUpdateSeed(state);
  return Number(((state.seed & MASK32) * BigInt(range)) >> 32n);
}

function prngRandi(state: PRNGState): number {
  prngUpdateSeed(state);
  return Number(state.seed & MASK32);
}

// ─── indexPrimedPRNG (matching nms_namegen iprng.py) ─────────────────

function ror64(x: bigint, r: number): bigint {
  r &= 63;
  if (r < 0) r = 64 + r;
  if (r === 0) return x;
  return ((x >> BigInt(r)) | (x << BigInt(64 - r))) & MASK64;
}

function hashRound(
  a: bigint, b: bigint, c: bigint, d: bigint,
  rota: number, rotb: number,
): [bigint, bigint, bigint, bigint] {
  const a1 = (ror64(b, rota) ^ c) & MASK64;
  const b1 = (ror64(a, rotb) ^ d) & MASK64;
  const c1 = (b1 + c) & MASK64;
  const d1 = (a1 + d) & MASK64;
  return [a1, b1, c1, d1];
}

function doHash(
  a: bigint, b: bigint, c: bigint, d: bigint,
  key: bigint, seed: bigint,
): bigint[] {
  let o = [0n, 0n, 0n, 0n];

  [a, b, c, d] = hashRound(a, b, c, d, -0x17, 0x18);
  [a, b, c, d] = hashRound(a, b, c, d, -0x5, 0x1B);
  a = (a + key + 1n) & MASK64;
  d = (d + key + 1n) & MASK64;
  [a, b, c, d] = hashRound(a, b, c, d, -0x19, 0x1F);
  [a, b, c, d] = hashRound(a, b, c, d, 0x12, -0xC);
  [a, b, c, d] = hashRound(a, b, c, d, 0x6, -0x16);
  [a, b, c, d] = hashRound(a, b, c, d, -0x20, -0x20);
  a = (a + seed + 2n) & MASK64;
  d = (d + key + seed + 2n) & MASK64;
  [a, b, c, d] = hashRound(a, b, c, d, -0xE, -0x10);
  [a, b, c, d] = hashRound(b, a, d, c, 0x7, 0xC);
  [a, b, c, d] = hashRound(b, a, d, c, -0x17, 0x18);
  [a, b, c, d] = hashRound(a, b, c, d, -0x5, 0x1B);
  a = (a + 3n) & MASK64;
  b = (b + key) & MASK64;
  c = (c + key) & MASK64;
  d = (d + 3n + seed) & MASK64;
  [a, b, c, d] = hashRound(a, b, c, d, -0x19, 0x1F);
  [a, b, c, d] = hashRound(a, b, c, d, 0x12, -0xC);
  [a, b, c, d] = hashRound(a, b, c, d, 0x6, -0x16);
  [a, b, c, d] = hashRound(a, b, c, d, -0x20, -0x20);
  a = (a + 4n) & MASK64;
  b = (b + seed) & MASK64;
  c = (c + seed + key) & MASK64;
  d = (d + 4n) & MASK64;
  [a, b, c, d] = hashRound(a, b, c, d, -0xE, -0x10);
  [a, b, c, d] = hashRound(a, b, c, d, 0xC, 0x7);
  [a, b, c, d] = hashRound(a, b, c, d, -0x17, 0x18);
  o[0] = (c + seed) & MASK64;
  o[1] = (ror64(a, 0x1B) ^ d) & MASK64;
  o[2] = d;
  o[3] = ((ror64(b, -0x5) ^ c) + 5n) & MASK64;
  return o;
}

function indexPrimedPRNG(lUA: bigint): bigint {
  let o = [0n, 0n, 0n, 0n];
  let oCounter = 0;

  const seed = lUA & 0xFFFFFFFFFFn;
  const system_id = Number((lUA >> 0x20n) >> 8n) & 0xFFF;
  const key = (seed ^ 0x1BD11BDAA9FC1A22n) & MASK64;

  let a = seed;
  let b = (ror64(seed, 7) ^ seed) & MASK64;
  let c = (b + a) & MASK64;
  let d = (seed + seed) & MASK64;
  o = doHash(a, b, c, d, key, seed);

  if (system_id >= 9) {
    const system_index = system_id - 1;
    const sys_high = (system_index - 8) >> 3;
    oCounter = (system_index - 8) & 7;

    a = BigInt(sys_high + 1) + seed;
    b = (ror64(a, 7) ^ a) & MASK64;
    c = (b + a) & MASK64;
    d = (a + a) & MASK64;
    o = doHash(a, b, c, d, key, seed);
  } else {
    oCounter = system_id - 1;
  }

  const index = oCounter >> 1;
  oCounter += 1;

  let out: bigint;
  if (!(1 & oCounter)) {
    out = (o[index]! >> 0x20n) & MASK64;
  } else {
    out = o[index]! & MASK64;
  }

  return out;
}

// ─── voxelAttributes (matching nms_namegen region.py) ────────────────

interface VoxelAttributes {
  guide_star_count: number;
  black_hole_count: number;
  atlas_station_count: number;
  inside_gap: number;
  guide_star_renegade_count: number;
}

function voxelAttributes(portal_code: bigint): VoxelAttributes {
  const attrs: VoxelAttributes = {
    guide_star_count: 0x78,
    black_hole_count: 1,
    atlas_station_count: 1,
    inside_gap: 0,
    guide_star_renegade_count: 0,
  };

  const x = Number(portal_code & 0xFFFn);
  const y = Number((portal_code & 0xFF000000n) >> 24n);
  const z = Number((portal_code & 0xFFF000n) >> 12n);

  const distance = Math.sqrt(x * x + y * y + z * z);

  if (distance < 8.0) {
    attrs.guide_star_count = 0;
    attrs.black_hole_count = 0;
    attrs.atlas_station_count = 0;
    attrs.inside_gap = 1;
  }

  if (distance < 1440.0 && distance > 8.0) {
    let diff = distance - 8.0;
    diff *= 120.0;
    diff /= 1440.0;
    if (diff < 0.0) diff = 0.0;
    if (diff > 0x78) diff = 0x78;
    attrs.guide_star_renegade_count = 0x78 - diff;
  }

  return attrs;
}

// ─── systemAttributes (matching nms_namegen system.py) ───────────────

interface SystemAttributes {
  planet_count: number;
  prime_planet_count: number;
  safe_start_planet: number;
}

export function systemAttributes(portal_code: bigint, galaxy: number): SystemAttributes {
  const pc = portal_code & 0xFFFFFFFFFFFn;
  const system_id = Number((pc & 0xFFF00000000n) >> 32n);
  const universalAddress = ((BigInt(system_id) << 8n) | BigInt(galaxy & 0xFF)) << 32n |
    (pc & 0xFFFFFFFFn);

  const va = voxelAttributes(pc);
  const systemSeed = indexPrimedPRNG(universalAddress) & MASK32;

  let rol16 = ((systemSeed & 0xFFFFn) << 16n) | ((systemSeed & 0xFFFF0000n) >> 16n);
  rol16 = (rol16 ^ systemSeed) & MASK32;

  let seed = 0n;
  if (systemSeed === 0n) {
    seed = ((systemSeed + 1n) * MULTIPLIER) + rol16;
  } else {
    seed = (systemSeed * MULTIPLIER) + rol16;
  }

  const rngState: PRNGState = { seed };
  let starType = 0;
  let safeStart = 0;
  let primePlanetCount = 2;
  let planetCount = 1;

  if (system_id < va.guide_star_count) {
    planetCount = Number(((seed & MASK32) * 4n) >> 32n) + 3;
    safeStart = prngRandom(rngState, planetCount) + 1;
  } else {
    starType = 0;
    if (Number(((seed & MASK32) * 0x64n) >> 32n) < 0x1E) {
      starType = prngRandom(rngState, 3) + 1;
    }
    planetCount = prngRandom(rngState, 6) + 1;

    if (va.guide_star_renegade_count >= 10 || starType !== 0) {
      safeStart = 0;
    } else {
      safeStart = prngRandom(rngState, planetCount + 2);
    }
  }

  // 4 updateSeed calls
  prngUpdateSeed(rngState);
  prngUpdateSeed(rngState);
  prngUpdateSeed(rngState);
  prngUpdateSeed(rngState);

  if (system_id < va.guide_star_renegade_count) {
    starType = prngRandom(rngState, 3) + 1;
  }

  if (system_id > 0x3E9 && system_id < 0x429) {
    starType = 4;
  }

  prngUpdateSeed(rngState);
  prngUpdateSeed(rngState);

  const diff = 6 - planetCount;
  if (diff < 1) {
    primePlanetCount = 0;
  } else if (prngRandom(rngState, 100) >= 33 || diff < 2) {
    primePlanetCount = 1;
  }

  let unknown_attribute2 = 0;
  if (starType === 4) {
    planetCount = 0;
    if (prngRandom(rngState, 100) > 0xF) {
      if (prngRandom(rngState, 100) < 0x42) {
        unknown_attribute2 = 1;
      }
    }
  }

  if (unknown_attribute2) {
    planetCount = 0;
    starType = 4;
    primePlanetCount = 6;
  }

  return {
    planet_count: planetCount,
    prime_planet_count: primePlanetCount,
    safe_start_planet: safeStart,
  };
}

// ─── planetSeeds (matching nms_namegen system.py) ────────────────────

interface PlanetSeedsResult {
  planet_seeds: bigint[];
  planet_count: number;
  moon_count: number;
}

export function planetSeeds(portal_code: bigint, galaxy: number): PlanetSeedsResult {
  const sa = systemAttributes(portal_code, galaxy);

  const planetSeedsList: bigint[] = [];
  let moonCount = 0;

  const galacticCoords = portal_code & 0xFFFFFFFFn;
  const systemIndex = ((portal_code & 0x0FFF00000000n) >> 24n) | BigInt(galaxy);

  // Murmur-like hash
  let register = (systemIndex << 0x20n) | galacticCoords;
  register = ((register >> 33n) ^ register) * CONST_A;
  register &= MASK64;
  register = ((register >> 33n) ^ register) * CONST_B;
  register &= MASK64;
  register = (register >> 33n) ^ register;

  // Derive seed
  let seedH =
    ((((register & 0xFFFF0000n) >> 16n) | ((register & 0x0000FFFFn) << 16n)) ^
      (register & 0xFFFFFFFFn) ^
      (register >> 32n)) &
    MASK64;

  let seedL = register & 0xFFFFFFFFn;
  if (seedH === 0n) seedH = 1n;

  const seed = (seedH << 32n) | seedL;
  const rngState: PRNGState = { seed };

  let i = 0;
  let planetCount = 0;

  // Count moons
  while (i < sa.planet_count) {
    i++;
    const size = prngRandom(rngState, 3);
    planetCount++;

    if (size === 0) {
      let m = sa.planet_count - i;
      if (m < 0) m = 0;
      if (m > 2) m = 2;

      const nMoons = prngRandom(rngState, m + 1);
      moonCount = nMoons;
      if (nMoons > 0) {
        let moonsLeft = nMoons;
        while (i !== sa.safe_start_planet - 1) {
          i++;
          planetCount++;
          moonsLeft--;
          if (moonsLeft <= 0) break;
        }
      }
    }
  }

  // Generate planet seeds
  i = 0;
  while (i < sa.planet_count) {
    const low = BigInt(prngRandi(rngState)) & MASK32;
    const high = BigInt(prngRandi(rngState)) & MASK32;

    let reg = (high << 0x20n) | low;
    reg = ((reg >> 33n) ^ reg) * CONST_A;
    reg &= MASK64;
    reg = ((reg >> 33n) ^ reg) * CONST_B;
    reg &= MASK64;
    const pSeed = (reg >> 33n) ^ reg;
    planetSeedsList.push(pSeed);
    i++;
  }

  // Extra planet(s)
  prngUpdateSeed(rngState);

  while (i < sa.planet_count + sa.prime_planet_count) {
    const low = BigInt(prngRandi(rngState)) & MASK32;
    const high = BigInt(prngRandi(rngState)) & MASK32;

    let reg = (high << 0x20n) | low;
    reg = ((reg >> 33n) ^ reg) * CONST_A;
    reg &= MASK64;
    reg = ((reg >> 33n) ^ reg) * CONST_B;
    reg &= MASK64;
    const pSeed = (reg >> 33n) ^ reg;
    planetSeedsList.push(pSeed);

    const size = prngRandom(rngState, 3);
    if (size !== 0) {
      prngUpdateSeed(rngState);
    }
    i++;
  }

  const finalPlanetCount = sa.planet_count + sa.prime_planet_count - moonCount;

  return {
    planet_seeds: planetSeedsList,
    planet_count: finalPlanetCount,
    moon_count: moonCount,
  };
}

// ─── planetSeed (matching nms_namegen planet.py) ─────────────────────

export function planetSeed(portal_code: bigint, galaxy: number): bigint {
  const planetId = Number((portal_code & 0xF00000000000n) >> 44n);
  return planetSeeds(portal_code, galaxy).planet_seeds[planetId - 1]!;
}

// ─── Planet Name Helpers ─────────────────────────────────────────────

function formatLongcode(longcode: number, digit: number, alpha: number): string {
  return `${longcode}/${String.fromCharCode(alpha)}${digit}`;
}

function formatShortcode(alpha: number, num: number): string {
  return `${String.fromCharCode(alpha)}${num}`;
}

// ─── planetName (matching nms_namegen planet.py) ─────────────────────

/**
 * Generate a planet name from a planet seed or portal code.
 *
 * @param planetSeedOrCode - Either a planet seed (bigint) or portal code (bigint)
 * @param galaxy - Galaxy number (required if planetSeedOrCode is a portal code)
 * @returns Generated planet name
 */
export function planetName(planetSeedOrCode: bigint, galaxy?: number): string {
  let planetSeedVal: bigint;

  if (galaxy !== undefined) {
    planetSeedVal = planetSeed(planetSeedOrCode, galaxy);
  } else {
    planetSeedVal = planetSeedOrCode;
  }

  // Derive PRNG seed from planet seed (matching planet.py lines 56-67)
  const lowword = planetSeedVal & MASK32;
  const highword = planetSeedVal >> 32n;

  let rol16 = ((lowword & 0xFFFFn) << 16n) | ((lowword & 0xFFFF0000n) >> 16n);
  rol16 = (rol16 ^ lowword ^ highword) & MASK32;

  let seed = 0n;
  if (lowword === 0n) {
    seed = ((lowword + 1n) * MULTIPLIER) + rol16;
  } else {
    seed = (lowword * MULTIPLIER) + rol16;
  }

  const rngState: PRNGState = { seed };

  // Generate planet name components (matching planet.py lines 69-85)
  const adornmentIdx = Number(((rngState.seed & MASK32) * 10n) >> 32n);
  const code = prngRandom(rngState, 50) + 1;
  const shortcode = prngRandom(rngState, 0x1A) + 0x41;
  const numeral = prngRandom(rngState, 0x12) + 2;
  const digit = prngRandom(rngState, 0x09) + 1;
  const alpha = prngRandom(rngState, 0x1A) + 0x41;
  const longcode = prngRandom(rngState, 0x59) + 0xB;

  // Generate procedural names (matching generator.py generateName)
  // procnorm: alphaset 7, min_length 4, max_length 8
  const procnormCache0: [number[], number[]] = [
    bigintToLEBytes(rngState.seed & MASK32),
    bigintToLEBytes(rngState.seed >> 32n),
  ];
  const procnormCache1: [number[], number[], number[]] = [
    [0x07], [0x04], [0x08],
  ];
  let procnorm = generateName(procnormCache0, procnormCache1);
  procnorm = procnorm.charAt(0).toUpperCase() + procnorm.substring(1);
  // Sync rng state with cache0 after generateName
  rngState.seed = (bytesToLEBigint(procnormCache0[1]) << 32n) |
    bytesToLEBigint(procnormCache0[0]);

  // procshort: alphaset 5, min_length 4, max_length 5
  const procshortCache0: [number[], number[]] = [
    bigintToLEBytes(rngState.seed & MASK32),
    bigintToLEBytes(rngState.seed >> 32n),
  ];
  const procshortCache1: [number[], number[], number[]] = [
    [0x05], [0x04], [0x05],
  ];
  let procshort = generateName(procshortCache0, procshortCache1);
  procshort = procshort.charAt(0).toUpperCase() + procshort.substring(1);
  rngState.seed = (bytesToLEBigint(procshortCache0[1]) << 32n) |
    bytesToLEBigint(procshortCache0[0]);

  // proclong: alphaset 7, min_length 6, max_length 10
  const proclongCache0: [number[], number[]] = [
    bigintToLEBytes(rngState.seed & MASK32),
    bigintToLEBytes(rngState.seed >> 32n),
  ];
  const proclongCache1: [number[], number[], number[]] = [
    [0x07], [0x06], [0x0A],
  ];
  let proclong = generateName(proclongCache0, proclongCache1);
  proclong = proclong.charAt(0).toUpperCase() + proclong.substring(1);
  rngState.seed = (bytesToLEBigint(proclongCache0[1]) << 32n) |
    bytesToLEBigint(proclongCache0[0]);

  // Select style (matching planet.py lines 88-94)
  let namegenStyle = prngRandom(rngState, 9);

  const target = Number(prngRandi(rngState)) * TINY_DOUBLE;
  if (!(0.0350000001 <= target)) {
    namegenStyle = 10;
  }

  // Apply style template (matching planet.py lines 96-104)
  let name = PLANET_STYLES[namegenStyle]!;
  name = name.replace("%PROCNORM%", procnorm);
  name = name.replace("%PROCSHORT%", procshort);
  name = name.replace("%PROCLONG%", proclong);
  name = name.replace("%ADORNMENT%", PLANET_ADORNMENTS[adornmentIdx]!);
  name = name.replace("%SHORTCODE%", formatShortcode(shortcode, code % 0x50));
  name = name.replace("%NUMERAL%", ROMAN_NUMERALS[numeral - 1]!);
  name = name.replace("%LONGCODE%", formatLongcode(longcode, digit, alpha));

  return name;
}

// ─── Utility ─────────────────────────────────────────────────────────

function bigintToLEBytes(value: bigint): number[] {
  if (value === 0n) return [0];
  const bytes: number[] = [];
  let v = value;
  while (v > 0n) {
    bytes.push(Number(v & 0xFFn));
    v >>= 8n;
  }
  return bytes;
}

function bytesToLEBigint(bytes: number[]): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]!);
  }
  return result;
}
