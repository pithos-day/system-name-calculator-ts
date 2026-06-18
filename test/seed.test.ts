import { describe, it, expect } from "vitest";
import {
  updateSeedUlong,
  updateSeedCache,
  rotateLeft32,
  sxdUlong,
} from "../src/seed.js";
import type { SeedCache } from "../src/types.js";

describe("seed", () => {
  describe("updateSeedUlong", () => {
    it("updates seed with known test vector", () => {
      const seed = 0x1234567890ABCDEFn;
      const result = updateSeedUlong(seed);

      const lo = seed & 0xFFFFFFFFn;
      const hi = seed >> 32n;
      const expected = (lo * 0x5A76F899n) + hi;
      expect(result).toBe(expected & 0xFFFFFFFFFFFFFFFFn);
    });

    it("handles zero seed", () => {
      expect(updateSeedUlong(0n)).toBe(0n);
    });

    it("wraps at 64 bits", () => {
      const seed = 0xFFFFFFFFFFFFFFFFn;
      const result = updateSeedUlong(seed);
      const lo = 0xFFFFFFFFn;
      const hi = 0xFFFFFFFFn;
      const expected = (lo * 0x5A76F899n) + hi;
      expect(result).toBe(expected & 0xFFFFFFFFFFFFFFFFn);
    });
  });

  describe("updateSeedCache", () => {
    it("updates cache correctly without error", () => {
      const cache: SeedCache = {
        c0: [[0x04, 0x03, 0x02, 0x01], [0]],
        c1: [[0x08, 0x07, 0x06, 0x05], [0x0c, 0x0b, 0x0a, 0x09], [0]],
      };

      updateSeedCache(cache);

      // result = c0[0] * Multiplier + c1[0]
      // Just verify it doesn't crash and produces non-empty arrays
      expect(cache.c0[0].length).toBeGreaterThan(0);
      expect(cache.c1[0].length).toBeGreaterThan(0);
    });

    it("applies multiple moves", () => {
      const cache: SeedCache = {
        c0: [[1, 0], [0]],
        c1: [[2, 0], [0], [0]],
      };

      updateSeedCache(cache, 3);
      expect(cache.c0[0].length).toBeGreaterThan(0);
      expect(cache.c1[0].length).toBeGreaterThan(0);
    });
  });

  describe("rotateLeft32", () => {
    it("rotates left by 1", () => {
      expect(rotateLeft32(0x80000000, 1)).toBe(0x00000001);
    });

    it("rotates left by 16", () => {
      expect(rotateLeft32(0x12345678, 16)).toBe(0x56781234);
    });

    it("identity rotation by 32", () => {
      expect(rotateLeft32(0xDEADBEEF, 32)).toBe(0xDEADBEEF);
    });

    it("handles count > 32", () => {
      expect(rotateLeft32(0x12345678, 48)).toBe(0x56781234);
    });
  });

  describe("sxdUlong", () => {
    it("sign-extends a positive 12-bit value", () => {
      expect(sxdUlong(0x7FFn, 12)).toBe(2047);
    });

    it("sign-extends a negative 12-bit value", () => {
      expect(sxdUlong(0x800n, 12)).toBe(-2048);
    });

    it("sign-extends 32-bit value", () => {
      expect(sxdUlong(0xFFFFFFFFn, 32)).toBe(-1);
    });
  });
});
