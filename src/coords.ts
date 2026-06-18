/**
 * Coordinate parsing and formatting utilities.
 *
 * Ported from C# SystemNameCalculator.Utils.StringExtensions
 * @see SystemNameCalculator/SystemNameCalculator/Utils/StringExtensions.cs
 *
 * And from SystemName/RegionName coordinate parsers:
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/SystemName.cs
 * @see SystemNameCalculator/SystemNameCalculator/NameGen/RegionName.cs
 *
 * And from Misc.cs truncation helpers:
 * @see SystemNameCalculator/SystemNameCalculator/Utils/Misc.cs
 */

import { hexToBytes, bytesToHex } from "./byte-utils.js";
import { sxdUlong } from "./seed.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Signal booster coordinate offsets */
const COORD_OFFSET_XZ = 2047;
const COORD_OFFSET_Y = 127;

// ─── Truncation Helpers ──────────────────────────────────────────────

/**
 * Get the hex digit count for a system coordinate component.
 *
 * C# Misc.GetSystemTruncation(i):
 *   i == 1 || i == 4 → 2 digits, else → 3 digits
 */
export function getSystemTruncation(i: number): number {
  return i === 1 || i === 4 ? 2 : 3;
}

/**
 * Get the hex digit count for a region coordinate component.
 *
 * C# Misc.GetRegionTruncation(i):
 *   i == 1 || i == 3 → 2 digits, else → 3 digits
 */
export function getRegionTruncation(i: number): number {
  return i === 1 || i === 3 ? 2 : 3;
}

// ─── ShortToFormattedHex ─────────────────────────────────────────────

/**
 * Convert a short to a formatted hex string with truncation.
 *
 * C# code:
 * ```
 * string s = Convert.ToString(self, 2);
 * if (s.Length > 12) s = s[(s.Length - 12)..];
 * return Convert.ToInt16(s, 2).ToString($"X{trunc}")[^trunc..];
 * ```
 *
 * This truncates the value to 12 bits (0-4095), then formats as hex.
 */
export function shortToFormattedHex(value: number, trunc: number): string {
  // Convert to signed 16-bit
  const s16 = value << 16 >> 16; // sign-extend to 16 bits
  // Take lower 12 bits
  const masked = s16 & 0xFFF;
  // Format as hex with leading zeros, take last `trunc` characters
  const hex = masked.toString(16).toUpperCase().padStart(trunc, "0");
  return hex.slice(-trunc);
}

// ─── System Coordinate Parsers ───────────────────────────────────────

/**
 * Parse signal booster system coordinates to a byte array seed.
 *
 * C# SystemName.SystemCoordsToByteArray(string self):
 *   Format: "XXXX:YYYY:ZZZZ:SYST:GLXY"
 *   Applies offsets to X, Y, Z, then constructs GRF string.
 *
 * GRF = SYST(4) + GLXY(4) + Y(4) + Z(6) + X(6) = 24 hex chars
 */
export function systemCoordsToByteArray(coords: string): number[] | null {
  const parts = coords.split(":");

  if (parts.length !== 5) {
    return null;
  }

  const shorts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const parsed = parseInt(parts[i]!, 16);
    if (isNaN(parsed)) return null;

    // Apply offsets for signal booster format
    let sh = parsed << 16 >> 16; // Convert to signed short
    if (i === 0 || i === 2) sh -= COORD_OFFSET_XZ; // X, Z
    else if (i === 1) sh -= COORD_OFFSET_Y; // Y
    shorts.push(sh);
  }

  // Construct GRF string: SYST + GLXY + Y + Z + X
  const grf =
    shortToFormattedHex(shorts[3]!, getSystemTruncation(3)) +
    shortToFormattedHex(shorts[4]!, getSystemTruncation(4)) +
    shortToFormattedHex(shorts[1]!, getSystemTruncation(1)) +
    shortToFormattedHex(shorts[2]!, getSystemTruncation(2)) +
    shortToFormattedHex(shorts[0]!, getSystemTruncation(0));

  return hexToBytes(grf);
}

/**
 * Parse raw system coordinates (save file format) to a byte array seed.
 *
 * C# SystemName.SystemXCoordsToByteArray(string[] coords):
 *   Input: ["/system", "xcoords", x, y, z, sys, gal]
 *   Format: x y z systemIndex galaxyIndex (decimal)
 */
export function systemXCoordsToByteArray(args: string[]): number[] | null {
  const coords = args.slice(2); // Skip "/system" and "xcoords"

  if (coords.length !== 5) return null;

  const shorts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const parsed = parseInt(coords[i]!, 10);
    if (isNaN(parsed)) return null;
    shorts.push(parsed << 16 >> 16); // Convert to signed short
  }

  // Construct GRF string: SYST + GLXY + Y + Z + X
  const grf =
    shortToFormattedHex(shorts[3]!, getSystemTruncation(3)) +
    shortToFormattedHex(shorts[4]!, getSystemTruncation(4)) +
    shortToFormattedHex(shorts[1]!, getSystemTruncation(1)) +
    shortToFormattedHex(shorts[2]!, getSystemTruncation(2)) +
    shortToFormattedHex(shorts[0]!, getSystemTruncation(0));

  return hexToBytes(grf);
}

// ─── Region Coordinate Parsers ───────────────────────────────────────

/**
 * Parse signal booster region coordinates to a byte array seed.
 *
 * C# RegionName.RegionCoordsToByteArray(string self):
 *   Format: "XXXX:YYYY:ZZZZ:GLXY"
 *   Applies offsets to X, Y, Z, then constructs GRF string.
 *
 * GRF = GLXY(4) + Y(4) + Z(6) + X(6) = 20 hex chars
 */
export function regionCoordsToByteArray(coords: string): number[] | null {
  const parts = coords.split(":");

  if (parts.length !== 4) return null;

  const shorts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const parsed = parseInt(parts[i]!, 16);
    if (isNaN(parsed)) return null;

    let sh = parsed << 16 >> 16;
    if (i === 1) sh -= COORD_OFFSET_Y;
    else if (i % 2 === 0) sh -= COORD_OFFSET_XZ; // i=0, i=2
    shorts.push(sh);
  }

  // Construct GRF string: GLXY + Y + Z + X
  const grf =
    shortToFormattedHex(shorts[3]!, getRegionTruncation(3)) +
    shortToFormattedHex(shorts[1]!, getRegionTruncation(1)) +
    shortToFormattedHex(shorts[2]!, getRegionTruncation(2)) +
    shortToFormattedHex(shorts[0]!, getRegionTruncation(0));

  return hexToBytes(grf);
}

/**
 * Parse raw region coordinates (save file format) to a byte array seed.
 *
 * C# RegionName.RegionXCoordsToByteArray(string[] coords):
 *   Input: ["/region", "xcoords", x, y, z, gal]
 *   Format: x y z galaxyIndex (decimal)
 */
export function regionXCoordsToByteArray(args: string[]): number[] | null {
  const coords = args.slice(2);

  if (coords.length !== 4) return null;

  const shorts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const parsed = parseInt(coords[i]!, 10);
    if (isNaN(parsed)) return null;
    shorts.push(parsed << 16 >> 16);
  }

  // Construct GRF string: GLXY + Y + Z + X
  const grf =
    shortToFormattedHex(shorts[3]!, getRegionTruncation(3)) +
    shortToFormattedHex(shorts[1]!, getRegionTruncation(1)) +
    shortToFormattedHex(shorts[2]!, getRegionTruncation(2)) +
    shortToFormattedHex(shorts[0]!, getRegionTruncation(0));

  return hexToBytes(grf);
}

// ─── Format Helpers ───────────────────────────────────────────────────

/**
 * Format a ulong as region portal coordinates.
 *
 * C# StringExtensions.FormatRegionGrfCoords():
 *   "0001" + lower 32 bits as 8-char hex
 */
export function formatRegionGrfCoords(seed: bigint): string {
  return "0001" + (seed & 0xFFFFFFFFn).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Format a ulong as region signal booster coordinates.
 *
 * C# StringExtensions.FormatRegionBoosterCoords():
 *   X:Z:Y:GLXY with offsets applied
 */
export function formatRegionBoosterCoords(seed: bigint): string {
  const x = ((Number(seed & 0xFFFn)) + COORD_OFFSET_XZ).toString(16).toUpperCase().padStart(4, "0");
  const y = ((Number((seed >> 24n) & 0xFFn)) + COORD_OFFSET_Y).toString(16).toUpperCase().padStart(4, "0");
  const z = ((Number((seed >> 12n) & 0xFFFn)) + COORD_OFFSET_XZ).toString(16).toUpperCase().padStart(4, "0");
  const glxy = ((Number((seed >> 32n) & 0xFFn))).toString(16).toUpperCase().padStart(4, "0");
  return `${x}:${y}:${z}:${glxy}`;
}

/**
 * Format a ulong as region raw (save file) coordinates.
 *
 * C# StringExtensions.FormatRegionXCoords():
 *   "X: {x}, Y: {y}, Z: {z}"
 */
export function formatRegionRawCoords(seed: bigint): string {
  const x = sxdUlong(seed & 0xFFFn, 12);
  const y = sxdUlong((seed >> 24n) & 0xFFn, 8);
  const z = sxdUlong((seed >> 12n) & 0xFFFn, 12);
  return `X: ${x}, Y: ${y}, Z: ${z}`;
}
