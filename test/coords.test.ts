import { describe, it, expect } from "vitest";
import {
  getSystemTruncation,
  getRegionTruncation,
  shortToFormattedHex,
  systemCoordsToByteArray,
  systemXCoordsToByteArray,
  regionCoordsToByteArray,
  regionXCoordsToByteArray,
  formatRegionGrfCoords,
  formatRegionBoosterCoords,
  formatRegionRawCoords,
} from "../src/coords.js";
import { bytesToHex } from "../src/byte-utils.js";

describe("coords", () => {
  describe("truncation helpers", () => {
    it("getSystemTruncation returns correct values", () => {
      expect(getSystemTruncation(0)).toBe(3); // X
      expect(getSystemTruncation(1)).toBe(2); // Y
      expect(getSystemTruncation(2)).toBe(3); // Z
      expect(getSystemTruncation(3)).toBe(3); // SYST
      expect(getSystemTruncation(4)).toBe(2); // GLXY
    });

    it("getRegionTruncation returns correct values", () => {
      expect(getRegionTruncation(0)).toBe(3); // X
      expect(getRegionTruncation(1)).toBe(2); // Y
      expect(getRegionTruncation(2)).toBe(3); // Z
      expect(getRegionTruncation(3)).toBe(2); // GLXY
    });
  });

  describe("shortToFormattedHex", () => {
    it("formats positive value with truncation", () => {
      // 0x364 = 868, truncation 3 → "364"
      expect(shortToFormattedHex(0x364, 3)).toBe("364");
    });

    it("formats negative value", () => {
      // -1 → 0xFFF, truncation 3 → "FFF"
      expect(shortToFormattedHex(-1, 3)).toBe("FFF");
    });

    it("truncates to 12 bits", () => {
      // 0x1234 → lower 12 bits = 0x234, truncation 3 → "234"
      expect(shortToFormattedHex(0x1234, 3)).toBe("234");
    });
  });

  describe("systemCoordsToByteArray", () => {
    it("parses valid signal booster coords", () => {
      const result = systemCoordsToByteArray("0364:0078:0CE5:010A:0000");
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);

      // GRF string is truncated to 12 bits per component, resulting in a compact byte array
      const hex = bytesToHex(result!);
      expect(hex.length).toBeGreaterThan(0);
    });

    it("returns null for wrong number of parts", () => {
      expect(systemCoordsToByteArray("0364:0078:0CE5")).toBeNull();
      expect(systemCoordsToByteArray("0364:0078:0CE5:010A:0000:extra")).toBeNull();
    });

    it("returns null for invalid hex", () => {
      expect(systemCoordsToByteArray("ZZZZ:0078:0CE5:010A:0000")).toBeNull();
    });
  });

  describe("systemXCoordsToByteArray", () => {
    it("parses valid raw coords", () => {
      const result = systemXCoordsToByteArray(["/system", "xcoords", "100", "50", "-200", "10", "0"]);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
    });

    it("returns null for wrong number of args", () => {
      expect(systemXCoordsToByteArray(["/system", "xcoords", "100"])).toBeNull();
    });
  });

  describe("regionCoordsToByteArray", () => {
    it("parses valid signal booster region coords", () => {
      const result = regionCoordsToByteArray("0364:0078:0CE5:0000");
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);

      const hex = bytesToHex(result!);
      expect(hex.length).toBeGreaterThan(0);
    });

    it("returns null for wrong number of parts", () => {
      expect(regionCoordsToByteArray("0364:0078")).toBeNull();
    });
  });

  describe("regionXCoordsToByteArray", () => {
    it("parses valid raw region coords", () => {
      const result = regionXCoordsToByteArray(["/region", "xcoords", "100", "50", "-200", "0"]);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
    });

    it("returns null for wrong number of args", () => {
      expect(regionXCoordsToByteArray(["/region", "xcoords"])).toBeNull();
    });
  });

  describe("formatRegionGrfCoords", () => {
    it("formats seed as portal coords", () => {
      // 0x0000000012345678 → "0001" + "12345678"
      const result = formatRegionGrfCoords(0x12345678n);
      expect(result).toBe("000112345678");
    });
  });

  describe("formatRegionBoosterCoords", () => {
    it("formats seed with offsets", () => {
      const result = formatRegionBoosterCoords(0n);
      expect(result).toContain(":");
      const parts = result.split(":");
      expect(parts.length).toBe(4);
    });
  });

  describe("formatRegionRawCoords", () => {
    it("formats seed as raw coords", () => {
      const result = formatRegionRawCoords(0n);
      expect(result).toContain("X:");
      expect(result).toContain("Y:");
      expect(result).toContain("Z:");
    });
  });
});
