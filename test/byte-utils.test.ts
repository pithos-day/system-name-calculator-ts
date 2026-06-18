import { describe, it, expect } from "vitest";
import {
  hexToBytes,
  bytesToHex,
  bytesToBigint,
  bigintToBytes,
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
  formatBytes,
  formatShort,
} from "../src/byte-utils.js";

describe("byte-utils", () => {
  describe("hexToBytes / bytesToHex (little-endian)", () => {
    it("converts hex string to little-endian byte array", () => {
      // "0100" in little-endian = [0x00, 0x01]
      expect(hexToBytes("0100")).toEqual([0x00, 0x01]);
    });

    it("handles odd-length hex by padding", () => {
      // "A" → "0A" → little-endian [0x0a]
      expect(hexToBytes("A")).toEqual([0x0a]);
    });

    it("roundtrips bytesToHex ↔ hexToBytes", () => {
      const bytes = [0x64, 0xdd, 0x81, 0x48];
      const hex = bytesToHex(bytes);
      expect(hexToBytes(hex)).toEqual(bytes);
    });
  });

  describe("bytesToBigint / bigintToBytes", () => {
    it("converts little-endian bytes to bigint", () => {
      // [0x01, 0x00] → 0x0001 = 1n
      expect(bytesToBigint([0x01, 0x00])).toBe(1n);
      // [0xff, 0x00] → 0x00ff = 255n
      expect(bytesToBigint([0xff, 0x00])).toBe(255n);
    });

    it("converts bigint to little-endian bytes", () => {
      expect(bigintToBytes(0n)).toEqual([0]);
      expect(bigintToBytes(1n)).toEqual([1]);
      expect(bigintToBytes(255n)).toEqual([255]);
      expect(bigintToBytes(256n)).toEqual([0, 1]);
    });

    it("roundtrips bigint ↔ bytes", () => {
      const values = [0n, 1n, 255n, 256n, 0xFFFFFFFFn, 0x100000000n];
      for (const v of values) {
        expect(bytesToBigint(bigintToBytes(v))).toBe(v);
      }
    });
  });

  describe("multiply", () => {
    it("multiplies small values", () => {
      // 3 * 2 = 6
      const result = multiply([3], [2]);
      expect(result).toEqual([6]);
    });

    it("handles carry", () => {
      // 256 * 256 = 65536 = 0x10000 → little-endian [0x00, 0x00, 0x01]
      const result = multiply([0x00, 0x01], [0x00, 0x01]);
      expect(result).toEqual([0x00, 0x00, 0x01]);
    });

    it("matches known C# multiplier (0x5A76F899)", () => {
      // Test: 0x5A76F899 * 0x5A76F899
      const a = [0x99, 0xf8, 0x76, 0x5a]; // little-endian
      const b = [0x99, 0xf8, 0x76, 0x5a];
      const result = multiply(a, b);
      const resultBigint = bytesToBigint(result);
      expect(resultBigint).toBe(0x5A76F899n * 0x5A76F899n);
    });
  });

  describe("add", () => {
    it("adds small values", () => {
      expect(add([1], [2])).toEqual([3]);
    });

    it("handles carry", () => {
      // 255 + 1 = 256 → [0x00, 0x01]
      expect(add([0xff], [0x01])).toEqual([0x00, 0x01]);
    });

    it("adds arrays of different lengths", () => {
      // [0xff, 0xff] + [0x01] = [0x00, 0x00, 0x01]
      expect(add([0xff, 0xff], [0x01])).toEqual([0x00, 0x00, 0x01]);
    });
  });

  describe("sub", () => {
    it("subtracts op1 from op2 (op1 - op2)", () => {
      // C# Sub(op1, op2) computes op1 - op2
      // sub([5], [3]) = 5 - 3 = 2
      expect(sub([5], [3])).toEqual([2]);
      // sub([3], [5]) = 3 - 5 = -2 → unsigned [254, 255] (two's complement with borrow)
      expect(sub([3], [5])).toEqual([254, 255]);
    });

    it("handles borrow across bytes", () => {
      // sub([0], [1]) = 0 - 1 = -1 → unsigned [255, 255]
      const result = sub([0], [1]);
      expect(result[0]).toBe(0xff);
      expect(result[1]).toBe(0xff);
    });
  });

  describe("shr (remove first n bytes)", () => {
    it("removes first n bytes", () => {
      expect(shr([1, 2, 3, 4], 2)).toEqual([3, 4]);
    });

    it("returns [0] if shift >= length", () => {
      expect(shr([1, 2], 3)).toEqual([0]);
    });
  });

  describe("shl (keep first n bytes)", () => {
    it("keeps first n bytes", () => {
      expect(shl([1, 2, 3, 4], 2)).toEqual([1, 2]);
    });

    it("returns [0] if shift >= length", () => {
      expect(shl([1, 2], 3)).toEqual([0]);
    });
  });

  describe("rol (byte rotation)", () => {
    it("rotates by 1", () => {
      expect(rol([1, 2, 3, 4], 1)).toEqual([2, 3, 4, 1]);
    });

    it("rotates by length (no change)", () => {
      expect(rol([1, 2, 3, 4], 4)).toEqual([1, 2, 3, 4]);
    });

    it("rotates by more than length", () => {
      expect(rol([1, 2, 3, 4], 5)).toEqual([2, 3, 4, 1]);
    });
  });

  describe("xor / and / or", () => {
    it("xors equal-length arrays", () => {
      expect(xor([0xff, 0x00], [0x0f, 0xf0])).toEqual([0xf0, 0xf0]);
    });

    it("ands with padding", () => {
      expect(and([0xff, 0xff], [0x0f])).toEqual([0x0f, 0x00]);
    });

    it("ors equal-length arrays", () => {
      expect(or([0xf0], [0x0f])).toEqual([0xff]);
    });
  });

  describe("sxd / zxd", () => {
    it("sign-extends positive value", () => {
      // 0x7F → positive, pad with 0x00
      expect(sxd([0x7f], 4)).toEqual([0x7f, 0x00, 0x00, 0x00]);
    });

    it("sign-extends negative value", () => {
      // 0x80 → negative, pad with 0xFF
      expect(sxd([0x80], 4)).toEqual([0x80, 0xff, 0xff, 0xff]);
    });

    it("zero-extends", () => {
      expect(zxd([0xff], 4)).toEqual([0xff, 0x00, 0x00, 0x00]);
    });

    it("does not extend if already long enough", () => {
      expect(sxd([1, 2, 3], 2)).toEqual([1, 2, 3]);
    });
  });

  describe("formatBytes / formatShort", () => {
    it("formats bytes as hex string (big-endian display)", () => {
      // [0x0a, 0xbc] little-endian = value 0xBC0A
      expect(formatBytes([0x0a, 0xbc])).toBe("BC0A");
    });

    it("pads to at least 2 bytes", () => {
      expect(formatShort([0x01])).toEqual([0x01, 0x00]);
      expect(formatShort([0x01, 0x02])).toEqual([0x01, 0x02]);
    });
  });
});
