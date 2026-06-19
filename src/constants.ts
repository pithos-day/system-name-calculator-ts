/**
 * Shared constants used across multiple modules.
 *
 * Deduplicates constants that were independently defined in
 * generator.ts, planet.ts, region-name.ts, system-name.ts,
 * name-validation.ts, and reverse-search.ts.
 */

// ─── Bitmasks ─────────────────────────────────────────────────────────

/** 64-bit mask for overflow emulation */
export const MASK64 = 0xFFFFFFFFFFFFFFFFn;

/** 32-bit mask */
export const MASK32 = 0xFFFFFFFFn;

// ─── Numeric Constants ────────────────────────────────────────────────

/** LCG multiplier (32-bit): 0x5A76F899 */
export const MULTIPLIER = 0x5A76F899n;

/** Murmur-hash constant A */
export const CONST_A = 0x64DD81482CBD31D7n;

/** Murmur-hash constant B */
export const CONST_B = 0xE36AA5C613612997n;

/** Scaling factor: 2^-32 for converting uint32 to [0,1) double */
export const TINY_DOUBLE = 2.3283064370807974e-10;

// ─── Name Generation Constants ────────────────────────────────────────

/** Vowel characters used in name generation and validation */
export const VOWELS = "aeiou";

/** Roman numeral suffixes (I through XX) */
export const ROMAN_NUMERALS = [
  "I", "II", "III", "IV", "V", "VI", "VII",
  "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
  "XVII", "XVIII", "XIX", "XX",
];

/** Planet name adornments (style suffixes) */
export const PLANET_ADORNMENTS = [
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

/** Planet name style templates */
export const PLANET_STYLES = [
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
