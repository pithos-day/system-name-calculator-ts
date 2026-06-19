#!/usr/bin/env tsx
/**
 * Reverse Search — find coordinates from a system or region name.
 *
 * WARNING: Reverse Search is experimental and not recommended for production use.
 * Results are not guaranteed to be valid or reachable Portal Codes.
 * Use only for exploration, debugging, or research purposes.
 *
 * Usage:
 *   npx tsx examples/reverse-search.ts <name> <galaxy> [options]
 *
 * Options:
 *   --type system|region   Search type (default: system)
 *   --max N                Max results (default: 10)
 *   --start HEX            galCoords search start (hex, default: 0)
 *   --end HEX              galCoords search end (hex, default: FFFFFFFF)
 *   --json                 JSON output
 *
 * Examples:
 *   npx tsx examples/reverse-search.ts "Desnoz-Gasu" 9 --start FC63C321 --end FC63C321
 *   npx tsx examples/reverse-search.ts "Ejblifirtc" 9 --type region --start 0 --end FFFF
 *   npx tsx examples/reverse-search.ts "Desnoz-Gasu" 9 --json --start FC63C321 --end FC63C321
 */

import {
  findSystemSeeds,
  findRegionSeeds,
  formatSystemName,
  formatRegionName,
  reconstructPortal,
  validateName,
} from "../src/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function formatPortal(portal: bigint): string {
  return "0x" + portal.toString(16).toUpperCase().padStart(12, "0");
}

function formatGalacticCoords(portal: bigint): string {
  const rawX = Number(portal & 0xFFFn);
  const rawY = Number((portal >> 24n) & 0xFFn);
  const rawZ = Number((portal >> 12n) & 0xFFFn);
  const systemId = Number((portal >> 32n) & 0xFFFn);

  const x = rawX + 2047;
  const ySigned = rawY >= 0x80 ? rawY - 256 : rawY;
  const y = ySigned + 127;
  const z = rawZ + 2047;

  const hexX = x.toString(16).toUpperCase().padStart(4, "0");
  const hexY = y.toString(16).toUpperCase().padStart(4, "0");
  const hexZ = z.toString(16).toUpperCase().padStart(4, "0");
  const hexS = systemId.toString(16).toUpperCase().padStart(4, "0");

  return `${hexX}:${hexY}:${hexZ}:${hexS}`;
}

function parseFlag(args: string[], name: string): string | undefined {
  const flag = args.find(a => a.startsWith(`--${name}=`));
  if (flag) return flag.split("=")[1];
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  // Warning: Reverse Search is experimental and may return invalid or unreachable Portal Codes.
  // Validate results before use. This feature is for exploration and debugging only.
  console.error("WARNING: Reverse Search is experimental. Results may include invalid Portal Codes.");
  console.error("");
  const args = process.argv.slice(2);
  const positional = args.filter(a => !a.startsWith("--"));

  if (positional.length < 2) {
    console.error("Usage: npx tsx examples/reverse-search.ts <name> <galaxy> [options]");
    console.error("");
    console.error("Options:");
    console.error("  --type system|region   Search type (default: system)");
    console.error("  --max N                Max results (default: 10)");
    console.error("  --start HEX            galCoords search start (hex)");
    console.error("  --end HEX              galCoords search end (hex)");
    console.error("  --json                 JSON output");
    console.error("");
    console.error("Examples:");
    console.error("  npx tsx examples/reverse-search.ts \"Desnoz-Gasu\" 9 --start FC63C321 --end FC63C321");
    console.error("  npx tsx examples/reverse-search.ts \"Ejblifirtc\" 9 --type region --start 0 --end FFFF");
    process.exit(1);
  }

  const name = positional[0]!;
  const galaxy = parseInt(positional[1]!, 10);
  const jsonMode = args.includes("--json");

  if (isNaN(galaxy)) {
    console.error("Error: Galaxy must be a number");
    process.exit(1);
  }

  const searchType = parseFlag(args, "type") ?? "system";
  const maxResults = parseInt(parseFlag(args, "max") ?? "10", 10);
  const startHex = parseFlag(args, "start");
  const endHex = parseFlag(args, "end");

  if (searchType !== "system" && searchType !== "region") {
    console.error("Error: --type must be 'system' or 'region'");
    process.exit(1);
  }

  const galCoordsStart = startHex ? parseInt(startHex, 16) : undefined;
  const galCoordsEnd = endHex ? parseInt(endHex, 16) : undefined;

  const validation = validateName(name, searchType as "system" | "region");
  if (!validation.valid) {
    console.error(`Name validation failed: ${validation.reason}`);
    console.error("Note: reverse search will still run, but results may be empty.");
    console.error("");
  }

  if (!startHex && !endHex) {
    console.error("WARNING: No search range specified. Defaulting to full range (2^32).");
    console.error("This will be extremely slow. Use --start and --end to limit the search.");
    console.error("");
  }

  const rangeSize = galCoordsStart !== undefined && galCoordsEnd !== undefined
    ? galCoordsEnd - galCoordsStart + 1
    : 0xFFFFFFFF;
  const estimatedCandidates = rangeSize * 4096;
  const estSeconds = (estimatedCandidates * 0.00002).toFixed(1);

  console.error(`Searching for "${name}" in galaxy ${galaxy} (${searchType} name, max ${maxResults} results)...`);
  console.error(`Search range: ${estimatedCandidates.toLocaleString()} candidates (est. ${estSeconds}s)`);
  console.error("");

  const startTime = Date.now();

  const results = searchType === "system"
    ? findSystemSeeds(name, {
        galaxy,
        maxResults,
        ...(galCoordsStart !== undefined ? { galCoordsStart } : {}),
        ...(galCoordsEnd !== undefined ? { galCoordsEnd } : {}),
      })
    : findRegionSeeds(name, {
        galaxy,
        maxResults,
        ...(galCoordsStart !== undefined ? { galCoordsStart } : {}),
        ...(galCoordsEnd !== undefined ? { galCoordsEnd } : {}),
      });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (jsonMode) {
    const output = {
      input: { name, galaxy, searchType, maxResults },
      elapsed: `${elapsed}s`,
      resultCount: results.length,
      results: results.map(r => {
        const portal = reconstructPortal(
          (r.seed[0]! | (r.seed[1]! << 8) | (r.seed[2]! << 16) | (r.seed[3]! << 24)) >>> 0,
          r.seed[5]! | (r.seed[6]! << 8),
          galaxy,
        );
        return {
          seed: r.seed.map(b => b.toString(16).padStart(2, "0")).join(" "),
          portal: formatPortal(portal),
          galacticCoords: formatGalacticCoords(portal),
          signalBoosterCoords: r.signalBoosterCoords,
          rawCoords: r.rawCoords,
          portalCoords: r.portalCoords,
        };
      }),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Found ${results.length} result(s) in ${elapsed}s:`);
    console.log("");

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const portal = reconstructPortal(
        (r.seed[0]! | (r.seed[1]! << 8) | (r.seed[2]! << 16) | (r.seed[3]! << 24)) >>> 0,
        r.seed[5]! | (r.seed[6]! << 8),
        galaxy,
      );

      const generatedName = searchType === "system"
        ? formatSystemName(r.seed)
        : formatRegionName(r.seed);

      console.log(`  ${i + 1}. ${generatedName}`);
      console.log(`     Portal:         ${formatPortal(portal)}`);
      console.log(`     Coordinates:    ${formatGalacticCoords(portal)}`);
      if (r.signalBoosterCoords) {
        console.log(`     Signal Booster: ${r.signalBoosterCoords}`);
      }
      console.log("");
    }
  }
}

main();
