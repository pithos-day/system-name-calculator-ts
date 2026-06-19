#!/usr/bin/env tsx
/**
 * Portal Code Lookup — nms_namegen compatibility sample
 *
 * Usage:
 *   npx tsx examples/portal-lookup.ts <portal_code> <galaxy> [--json]
 *
 * Examples:
 *   npx tsx examples/portal-lookup.ts 202101D40677 0
 *   npx tsx examples/portal-lookup.ts 202101D40677 0 --json
 */

import {
  systemName,
  regionName,
  planetSeeds,
  planetName,
  portalToGalacticCoords,
} from "../src/index.js";

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx examples/portal-lookup.ts <portal_code> <galaxy> [--json]");
    console.error("");
    console.error("Examples:");
    console.error("  npx tsx examples/portal-lookup.ts 202101D40677 0");
    console.error("  npx tsx examples/portal-lookup.ts 202101D40677 0 --json");
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
