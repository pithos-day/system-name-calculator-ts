/**
 * Multi-precision byte array arithmetic operations.
 *
 * Ported from C# SystemNameCalculator.Utils.ByteExtensions
 * @see SystemNameCalculator/SystemNameCalculator/Utils/ByteExtensions.cs
 *
 * All byte arrays are treated as arbitrary-precision unsigned integers.
 * Operations like Shr/Shl remove bytes (not bits), effectively dividing/multiplying by 256^n.
 * Rol performs byte-level rotation.
 */

// ─── Constants ────────────────────────────────────────────────────────

const MASK_32 = 0xFFFFFFFFn;
const BYTE_MASK = 0xFF;

// ─── Conversion: byte[] ↔ bigint ─────────────────────────────────────

/**
 * Convert a hex string to a bigint.
 * The hex string is interpreted as a big-endian unsigned integer.
 *
 * Ported from C# `ByteExtensions.Parse()` and `ByteExtensions.Format()`.
 */
export function parseHex(val: string): bigint {
  if (val.length % 2 !== 0) val = "0" + val;
  return BigInt("0x" + val);
}

/**
 * Convert a bigint to a hex string (big-endian, no prefix).
 */
export function formatHex(value: bigint): string {
  if (value === 0n) return "00";
  const hex = value.toString(16);
  return hex.length % 2 !== 0 ? "0" + hex : hex;
}

/**
 * Convert a hex string to a little-endian byte array.
 * This matches C# `ByteExtensions.Parse(val, littleEndian: true)`.
 */
export function hexToBytes(val: string): number[] {
  if (val.length % 2 !== 0) val = "0" + val;
  const bytes: number[] = [];
  for (let i = val.length - 2; i >= 0; i -= 2) {
    bytes.push(parseInt(val.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Convert a little-endian byte array to a hex string.
 * This matches C# `ByteExtensions.Format(arr, littleEndian: true)`.
 */
export function bytesToHex(arr: number[]): string {
  if (arr.length === 0) return "00";
  let result = "";
  for (let i = arr.length - 1; i >= 0; i--) {
    result += arr[i]!.toString(16).padStart(2, "0").toUpperCase();
  }
  return result;
}

/**
 * Convert a little-endian byte array to a bigint.
 */
export function bytesToBigint(arr: number[]): bigint {
  let result = 0n;
  for (let i = arr.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(arr[i]!);
  }
  return result;
}

/**
 * Convert a bigint to a little-endian byte array.
 * The array length is the minimum needed to represent the value,
 * but at least 1 byte.
 */
export function bigintToBytes(value: bigint): number[] {
  if (value === 0n) return [0];
  const bytes: number[] = [];
  let v = value;
  while (v > 0n) {
    bytes.push(Number(v & BigInt(BYTE_MASK)));
    v >>= 8n;
  }
  return bytes;
}

// ─── Format Helpers ───────────────────────────────────────────────────

/**
 * Format byte[] as hex string (big-endian display).
 * Matches C# `ByteExtensions.Format()`.
 */
export function formatBytes(arr: number[]): string {
  if (arr.length === 0) return "Bad array";
  let result = "";
  for (let i = arr.length - 1; i >= 0; i--) {
    result += arr[i]!.toString(16).padStart(2, "0").toUpperCase();
  }
  return result;
}

/**
 * Pad byte array to at least 2 bytes.
 * Matches C# `ByteExtensions.FormatShort()`.
 */
export function formatShort(arr: number[]): number[] {
  const result = [...arr];
  while (result.length < 2) {
    result.push(0);
  }
  return result;
}

// ─── Arithmetic Operations ────────────────────────────────────────────

/**
 * Multiply two little-endian byte arrays.
 * Matches C# `ByteExtensions.Multiply()` — long multiplication with carry.
 */
export function multiply(a: number[], b: number[]): number[] {
  const result: number[] = [];

  for (let i = 0; i < a.length; i++) {
    let rem = 0;
    for (let j = 0; j < b.length; j++) {
      const prd = a[i]! * b[j]! + rem;
      rem = (prd >> 8) & BYTE_MASK;
      const res = prd & BYTE_MASK;
      const idx = i + j;

      if (idx < result.length) {
        const sum = result[idx]! + res;
        result[idx] = sum & BYTE_MASK;
        const carry = (sum >> 8) & BYTE_MASK;
        if (carry !== 0) addCarryAt(result, idx + 1, carry);
      } else {
        result.push(res);
      }
    }
    if (rem > 0) {
      const idx = i + b.length;
      if (idx < result.length) {
        addCarryAt(result, idx, rem);
      } else {
        result.push(rem);
      }
    }
  }

  return result;
}

/**
 * Add two little-endian byte arrays.
 * Matches C# `ByteExtensions.Add()`.
 */
export function add(a: number[], b: number[]): number[] {
  const result = [...b];
  for (let i = 0; i < a.length; i++) {
    addByteAt(result, a[i]!, i);
  }
  return result;
}

/**
 * Subtract: compute op1 - op2.
 * Matches C# `ByteExtensions.Sub(op1, op2)` which computes op1 - op2.
 * Starts with result = op2, then subtracts each byte of op1 from result.
 */
export function sub(a: number[], b: number[]): number[] {
  const result = [...b];
  for (let i = 0; i < a.length; i++) {
    subByteAt(result, a[i]!, i);
  }
  return result;
}

// ─── Bitwise Operations ───────────────────────────────────────────────

/**
 * Logical right shift by n bytes (remove first n bytes).
 * Matches C# `ByteExtensions.Shr()`.
 *
 * Example: Shr([0x01, 0x02, 0x03, 0x04], 2) → [0x03, 0x04]
 */
export function shr(arr: number[], shift: number): number[] {
  if (arr.length > shift) return arr.slice(shift);
  return [0];
}

/**
 * Logical left shift by n bytes (remove last n bytes, keep upper bytes).
 * Matches C# `ByteExtensions.Shl()`.
 *
 * Example: Shl([0x01, 0x02, 0x03, 0x04], 2) → [0x01, 0x02]
 */
export function shl(arr: number[], shift: number): number[] {
  if (arr.length > shift) return arr.slice(0, shift);
  return [0];
}

/**
 * Byte-level rotate left by n positions.
 * Matches C# `ByteExtensions.Rol()`.
 *
 * Example: Rol([0x01, 0x02, 0x03, 0x04], 1) → [0x02, 0x03, 0x04, 0x01]
 */
export function rol(arr: number[], roll: number): number[] {
  const len = arr.length;
  if (len === 0) return [0];
  const r = roll % len;
  if (r === 0) return [...arr];
  return [...arr.slice(r), ...arr.slice(0, r)];
}

/**
 * XOR two byte arrays (shorter one is zero-padded).
 * Matches C# `ByteExtensions.Xor()`.
 */
export function xor(a: number[], b: number[]): number[] {
  return genericLogical(a, b, "xor");
}

/**
 * AND two byte arrays (shorter one is zero-padded).
 * Matches C# `ByteExtensions.And()`.
 */
export function and(a: number[], b: number[]): number[] {
  return genericLogical(a, b, "and");
}

/**
 * OR two byte arrays (shorter one is zero-padded).
 * Matches C# `ByteExtensions.Or()`.
 */
export function or(a: number[], b: number[]): number[] {
  return genericLogical(a, b, "or");
}

// ─── Extension Operations ─────────────────────────────────────────────

/**
 * Sign-extend a byte array to `extend` bytes.
 * Matches C# `ByteExtensions.Sxd()`.
 */
export function sxd(arr: number[], extend: number): number[] {
  if (arr.length >= extend) return [...arr];
  const result = [...arr];
  const signByte = (arr[arr.length - 1]! >> 7) === 1 ? BYTE_MASK : 0;
  while (result.length < extend) {
    result.push(signByte);
  }
  return result;
}

/**
 * Zero-extend a byte array to `extend` bytes.
 * Matches C# `ByteExtensions.Zxd()`.
 */
export function zxd(arr: number[], extend: number): number[] {
  if (arr.length >= extend) return [...arr];
  const result = [...arr];
  while (result.length < extend) {
    result.push(0);
  }
  return result;
}

// ─── Internal Helpers ─────────────────────────────────────────────────

function addCarryAt(arr: number[], index: number, carry: number): void {
  if (index < arr.length) {
    const sum = arr[index]! + carry;
    arr[index] = sum & BYTE_MASK;
    const nextCarry = (sum >> 8) & BYTE_MASK;
    if (nextCarry !== 0) addCarryAt(arr, index + 1, nextCarry);
  } else {
    arr.push(carry);
  }
}

function addByteAt(arr: number[], byteVal: number, index: number): void {
  if (index < arr.length) {
    const sum = arr[index]! + byteVal;
    arr[index] = sum & BYTE_MASK;
    const carry = (sum >> 8) & BYTE_MASK;
    if (carry !== 0) addCarryAt(arr, index + 1, carry);
  } else {
    arr.push(byteVal);
  }
}

/**
 * Subtract a byte from the result array at position index.
 * Matches C# private Sub(op1, op2, index) which computes op1 - op2[index].
 * Here byteVal is the op1 byte, arr is the result/op2 array.
 */
function subByteAt(arr: number[], byteVal: number, index: number): void {
  if (index < arr.length) {
    const diff = byteVal - arr[index]!;
    arr[index] = diff & BYTE_MASK;
    const rem = (diff >> 8) & BYTE_MASK; // borrow indicator (0xFF when negative)
    if (rem !== 0) {
      subByteAt(arr, rem, index + 1);
    }
  } else {
    arr.push(byteVal);
  }
}

type LogicalOp = "xor" | "and" | "or";

function genericLogical(a: number[], b: number[], op: LogicalOp): number[] {
  let longer: number[];
  let shorter: number[];

  if (a.length > b.length) {
    longer = [...a];
    shorter = [...b];
    while (shorter.length < longer.length) shorter.push(0);
  } else {
    longer = [...b];
    shorter = [...a];
    while (shorter.length < longer.length) shorter.push(0);
  }

  for (let i = 0; i < longer.length; i++) {
    switch (op) {
      case "xor":
        longer[i]! ^= shorter[i]!;
        break;
      case "and":
        longer[i]! &= shorter[i]!;
        break;
      case "or":
        longer[i]! |= shorter[i]!;
        break;
    }
  }

  return longer;
}
