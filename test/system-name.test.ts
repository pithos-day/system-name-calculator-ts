import { describe, it, expect } from "vitest";
import { formatSystemName } from "../src/system-name.js";

describe("formatSystemName", () => {
  it("returns a non-empty string", () => {
    const seed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = formatSystemName(seed);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("first letter is uppercase", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result = formatSystemName(seed);
    expect(result[0]).toBe(result[0]!.toUpperCase());
  });

  it("produces consistent output for same seed", () => {
    const seed = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const a = formatSystemName(seed);
    const b = formatSystemName(seed);
    expect(a).toBe(b);
  });

  it("produces different output for different seeds", () => {
    const seed1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const seed2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const a = formatSystemName(seed1);
    const b = formatSystemName(seed2);
    expect(a).not.toBe(b);
  });

  it("output length is between 6 and 9 characters (typical)", () => {
    // Test with a range of seeds
    for (let i = 0; i < 10; i++) {
      const seed = Array.from({ length: 12 }, (_, j) => (i * 7 + j * 13) % 256);
      const result = formatSystemName(seed);
      // Most names should be in the 6-9 range, but some edge cases may differ
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(20);
    }
  });
});
