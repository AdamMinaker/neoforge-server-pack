#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    modsDir: "mods",
    report: "mods/modrinth_report.json",
    external: "mods/external_mods.json",
    outputDir: "server_mods",
    clean: false,
    includeUnknown: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mods-dir") args.modsDir = argv[++i];
    else if (arg === "--report") args.report = argv[++i];
    else if (arg === "--external") args.external = argv[++i];
    else if (arg === "--output-dir") args.outputDir = argv[++i];
    else if (arg === "--clean") args.clean = true;
    else if (arg === "--include-unknown") args.includeUnknown = true;
    else if (arg === "--help" || arg === "-h") return { help: true };
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node server_mods.js [--clean] [--include-unknown]

Options:
  --mods-dir mods
  --report mods/modrinth_report.json
  --external mods/external_mods.json
  --output-dir server_mods
  --clean (delete output dir before copy)
  --include-unknown (include mods with no side data)
  `);
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeExternalSide(entry) {
  const side = String(entry.side || "").toLowerCase().trim();
  if (side === "client") return { clientSide: "required", serverSide: "unsupported" };
  if (side === "server") return { clientSide: "unsupported", serverSide: "required" };
  if (side === "both") return { clientSide: "required", serverSide: "required" };
  const clientSide = entry.clientSide || entry.client_side;
  const serverSide = entry.serverSide || entry.server_side;
  return { clientSide, serverSide };
}

function isServerSupported(serverSide) {
  if (!serverSide) return null;
  return serverSide !== "unsupported";
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const report = loadJson(args.report, []);
  const external = loadJson(args.external, []);
  const modsDir = path.resolve(args.modsDir);
  const outputDir = path.resolve(args.outputDir);

  if (args.clean && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const serverMods = [];
  const unknownMods = [];

  for (const entry of report) {
    if (entry.status !== "downloaded") continue;
    const supported = isServerSupported(entry.serverSide || entry.server_side);
    if (supported === null) {
      unknownMods.push({ name: entry.title || entry.slug || entry.query, file: entry.file });
      if (!args.includeUnknown) continue;
    } else if (!supported) {
      continue;
    }
    serverMods.push({ name: entry.title || entry.slug || entry.query, file: entry.file });
  }

  for (const entry of external) {
    const fileValue = String(entry.file || "").trim();
    if (!fileValue) continue;
    const side = normalizeExternalSide(entry);
    const supported = isServerSupported(side.serverSide);
    if (supported === null) {
      unknownMods.push({ name: entry.name || fileValue, file: fileValue });
      if (!args.includeUnknown) continue;
    } else if (!supported) {
      continue;
    }
    serverMods.push({ name: entry.name || fileValue, file: fileValue });
  }

  for (const mod of serverMods) {
    const source = path.join(modsDir, mod.file);
    const dest = path.join(outputDir, path.basename(mod.file));
    fs.copyFileSync(source, dest);
  }

  console.log(`Server mods copied to ${outputDir}`);
  if (unknownMods.length > 0) {
    console.log("Mods with unknown side metadata:");
    for (const mod of unknownMods) {
      console.log(`- ${mod.name} (${mod.file || "no file"})`);
    }
  }

  return 0;
}

process.exit(main());
