#!/usr/bin/env tsx
/**
 * Portal Code Lookup — nms_namegen compatibility sample
 *
 * Usage:
 *   npx tsx examples/portal-lookup.ts <portal_code> <galaxy> [--json]
 *
 * Examples:
 *   npx tsx examples/portal-lookup.ts 102DFC63C321 9
 *   npx tsx examples/portal-lookup.ts 102DFC63C321 9 --json
 *   npx tsx examples/portal-lookup.ts 115EFF285671 9
 */

import {
  systemName,
  regionName,
  planetSeeds,
  planetName,
} from "../src/index.js";

// ─── Coordinate Conversion ────────────────────────────────────────────

const COORD_OFFSET_XZ = 2047;
const COORD_OFFSET_Y = 127;

/**
 * Convert portal code to galactic coordinates string.
 *
 * Portal format: 0xPSSSYYZZZXXX
 *   P  = planet id (4 bits)
 *   SSS = system id (12 bits)
 *   YY  = Y coordinate (8 bits, signed: 0x80-0xFF = -128 to -1)
 *   ZZZ = Z coordinate (12 bits)
 *   XXX = X coordinate (12 bits)
 *
 * Galactic coordinates: XXXX:YYYY:ZZZZ:SSSS
 *   X = raw X + 2047
 *   Y = signed(raw Y) + 127
 *   Z = raw Z + 2047
 *   S = system id
 */
function portalToGalacticCoords(portal: bigint): string {
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);
  const systemId = Number((portal >> 32n) & 0xFFFn);

  const x = rawX + COORD_OFFSET_XZ;
  const ySigned = rawY >= 0x80 ? rawY - 256 : rawY;
  const y = ySigned + COORD_OFFSET_Y;
  const z = rawZ + COORD_OFFSET_XZ;

  const hexX = x.toString(16).toUpperCase().padStart(4, "0");
  const hexY = y.toString(16).toUpperCase().padStart(4, "0");
  const hexZ = z.toString(16).toUpperCase().padStart(4, "0");
  const hexS = systemId.toString(16).toUpperCase().padStart(4, "0");

  return `${hexX}:${hexY}:${hexZ}:${hexS}`;
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx examples/portal-lookup.ts <portal_code> <galaxy> [--json]");
    console.error("");
    console.error("Examples:");
    console.error("  npx tsx examples/portal-lookup.ts 102DFC63C321 9");
    console.error("  npx tsx examples/portal-lookup.ts 102DFC63C321 9 --json");
    process.exit(1);
  }

  const portalHex = args[0]!;
  const galaxy = parseInt(args[1]!, 10);
  const jsonMode = args.includes("--json");

  if (isNaN(galaxy)) {
    console.error("Error: Galaxy must be a number");
    process.exit(1);
  }

  if (!/^[0-9A-Fa-f]+$/.test(portalHex)) {
    console.error("Error: Portal code must be a hexadecimal string");
    process.exit(1);
  }

  if (portalHex.length < 8 || portalHex.length > 15) {
    console.error("Error: Portal code must be 8-15 hex characters (got " + portalHex.length + ")");
    process.exit(1);
  }

  const portal = BigInt("0x" + portalHex);

  // Generate all results
  const galacticCoords = portalToGalacticCoords(portal);
  const region = regionName(portal, galaxy);
  const system = systemName(portal, galaxy);
  const ps = planetSeeds(portal, galaxy);

  const planetNames = ps.planet_seeds.map((seed, i) => ({
    index: i + 1,
    seed: "0x" + seed.toString(16).toUpperCase().padStart(16, "0"),
    name: planetName(seed),
  }));

  if (jsonMode) {
    // JSON output for programmatic use
    const result = {
      input: {
        portalCode: portalHex.toUpperCase(),
        galaxy,
      },
      galacticCoords,
      regionName: region,
      systemName: system,
      planets: planetNames,
      attributes: {
        planetCount: ps.planet_count,
        moonCount: ps.moon_count,
      },
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable output
    console.log("");
    console.log("Input:");
    console.log("  Portal Code: " + portalHex.toUpperCase());
    console.log("  Galaxy:      " + galaxy);
    console.log("");
    console.log("Output:");
    console.log("  Galactic Coordinates: " + galacticCoords);
    console.log("  Region Name:          " + region);
    console.log("  System Name:          " + system);
    console.log("");
    console.log("Planets (" + ps.planet_count + " total, " + ps.moon_count + " moons):");
    for (const p of planetNames) {
      console.log("  " + p.index + ". " + p.name + "  (seed: " + p.seed + ")");
    }
    console.log("");
  }
}

main();
