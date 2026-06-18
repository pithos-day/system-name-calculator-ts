import { describe, it, expect } from "vitest";
import {
  vowelInsertedAtStart,
  vowelInsertedAtEnd,
  getConsecutiveConsonants,
  generateName,
  Alphasets,
} from "../src/generator.js";
import { updateSeedCache } from "../src/seed.js";

describe("vowelInsertedAtStart", () => {
  it("returns true for two consonants that need a vowel", () => {
    // "bp" -> b is not vowel, p is not vowel, and not in the exception list
    expect(vowelInsertedAtStart("b", "p")).toBe(true);
  });

  it("returns false when first char is a vowel", () => {
    expect(vowelInsertedAtStart("a", "b")).toBe(false);
    expect(vowelInsertedAtStart("e", "r")).toBe(false);
  });

  it("returns false for valid consonant clusters (s + h/k/l/m/n/p/r/t/w/y)", () => {
    expect(vowelInsertedAtStart("s", "h")).toBe(false);
    expect(vowelInsertedAtStart("s", "k")).toBe(false);
  });

  it("returns false for ch, th, wh combinations", () => {
    expect(vowelInsertedAtStart("c", "h")).toBe(false);
    expect(vowelInsertedAtStart("t", "h")).toBe(false);
    expect(vowelInsertedAtStart("w", "h")).toBe(false);
  });

  it("returns false for bl, cl, fl, etc.", () => {
    expect(vowelInsertedAtStart("b", "l")).toBe(false);
    expect(vowelInsertedAtStart("c", "l")).toBe(false);
    expect(vowelInsertedAtStart("f", "l")).toBe(false);
  });
});

describe("vowelInsertedAtEnd", () => {
  it("returns true for b preceded by n (but not g due to outer guard)", () => {
    expect(vowelInsertedAtEnd("b", "n")).toBe(true);
    // penult='g' is blocked by the outer guard: penult !== 'g' || VOWELS.includes(ult)
    expect(vowelInsertedAtEnd("b", "g")).toBe(false);
  });

  it("returns true for d preceded by various consonants", () => {
    expect(vowelInsertedAtEnd("d", "b")).toBe(true);
    expect(vowelInsertedAtEnd("d", "k")).toBe(true);
  });

  it("returns false when last char is a vowel", () => {
    expect(vowelInsertedAtEnd("a", "b")).toBe(false);
  });

  it("returns false for g preceded by vowel", () => {
    expect(vowelInsertedAtEnd("g", "a")).toBe(false);
  });
});

describe("getConsecutiveConsonants", () => {
  it("returns -1 for vowel-heavy names", () => {
    expect(getConsecutiveConsonants("aeiou")).toBe(-1);
  });

  it("returns -1 for short consonant sequences", () => {
    expect(getConsecutiveConsonants("abc")).toBe(-1);
  });

  it("detects 4+ consecutive consonants", () => {
    // "bcdf" has 4 consecutive consonants
    expect(getConsecutiveConsonants("bcdf")).toBe(0);
  });

  it("resets count on vowels", () => {
    // "abcdf" -> a(vowel reset), bcd(3 consonants), f(4th -> index 1)
    expect(getConsecutiveConsonants("abcdf")).toBe(1);
  });
});

describe("Alphasets", () => {
  it("has 8 alphaset strings", () => {
    expect(Alphasets.length).toBe(8);
  });

  it("each alphaset length is divisible by 3", () => {
    for (const alphaset of Alphasets) {
      expect(alphaset.length % 3).toBe(0);
    }
  });

  it("each alphaset contains only lowercase letters", () => {
    for (const alphaset of Alphasets) {
      expect(alphaset).toMatch(/^[a-z]+$/);
    }
  });
});

describe("generateName", () => {
  it("generates a name from a properly initialized cache", () => {
    const cache0: [number[], number[]] = [
      [0x10, 0x20, 0x30, 0x40],
      [0x01, 0x02, 0x03, 0x04],
    ];
    const cache1: [number[], number[], number[]] = [
      [0x00],
      [0x06],
      [0x10, 0x20],
    ];

    const name = generateName(cache0, cache1);
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("produces consistent output for same cache state", () => {
    const cache0: [number[], number[]] = [
      [0x50, 0x60, 0x70, 0x80],
      [0x0a, 0x0b, 0x0c, 0x0d],
    ];
    const cache1: [number[], number[], number[]] = [
      [0x02],
      [0x06],
      [0x20, 0x30],
    ];

    const a = generateName(cache0, cache1);
    // Reset cache for second call
    cache0[0] = [0x50, 0x60, 0x70, 0x80];
    cache0[1] = [0x0a, 0x0b, 0x0c, 0x0d];
    cache1[0] = [0x02];
    cache1[1] = [0x06];
    cache1[2] = [0x20, 0x30];

    const b = generateName(cache0, cache1);
    expect(a).toBe(b);
  });
});
