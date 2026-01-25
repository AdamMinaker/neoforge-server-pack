#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULTS = {
  loader: "neoforge",
  gameVersion: "1.21.11",
  loaderVersion: "21.11.13-beta",
  modsDir: "mods",
  report: "mods/modrinth_report.json",
  outputPack: "neoforge-1.21.11-gravestone.mrpack",
};

function parseArgs(argv) {
  const args = {
    mods: [],
    update: true,
    ...DEFAULTS,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-update") args.update = false;
    else if (arg === "--loader") args.loader = argv[++i];
    else if (arg === "--game-version") args.gameVersion = argv[++i];
    else if (arg === "--loader-version") args.loaderVersion = argv[++i];
    else if (arg === "--mods-dir") args.modsDir = argv[++i];
    else if (arg === "--report") args.report = argv[++i];
    else if (arg === "--output") args.outputPack = argv[++i];
    else if (arg === "--help" || arg === "-h") return { help: true };
    else args.mods.push(arg);
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node add_mod.js distant-horizons
  node add_mod.js https://modrinth.com/mod/xaeros-minimap
  node add_mod.js irons-spells-n-spellbooks --no-update
  node add_mod.js foo bar --game-version 1.21.11 --loader neoforge
  `);
}

function loadModsJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`Expected JSON array in ${filePath}`);
  return data.map((item) => String(item).trim()).filter(Boolean);
}

function saveModsJson(filePath, mods) {
  const content = JSON.stringify(mods, null, 2) + "\n";
  fs.writeFileSync(filePath, content);
}

function normalizeModInput(input) {
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("http")) return trimmed;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((part) => part === "mod" || part === "project");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || null;
  } catch (err) {
    return trimmed;
  }
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (!args.mods.length) {
    console.error("Provide at least one mod slug.");
    return 2;
  }

  const normalizedMods = args.mods
    .map(normalizeModInput)
    .filter(Boolean);

  const modsJsonPath = path.join(process.cwd(), "mods", "mods.json");
  const current = loadModsJson(modsJsonPath);
  const set = new Set(current);
  for (const mod of normalizedMods) set.add(mod);

  const updated = [...set];
  saveModsJson(modsJsonPath, updated);
  console.log(`Updated ${modsJsonPath} with ${normalizedMods.length} mod(s).`);

  if (!args.update) return 0;

  run("node", [
    "modrinth_download.js",
    "--loader",
    args.loader,
    "--game-version",
    args.gameVersion,
    "--output",
    args.modsDir,
  ]);

  run("node", [
    "modrinth_pack.js",
    "--game-version",
    args.gameVersion,
    "--loader",
    args.loader,
    "--mods-dir",
    args.modsDir,
    "--report",
    args.report,
    "--output",
    args.outputPack,
    "--loader-version",
    args.loaderVersion,
  ]);

  return 0;
}

process.exit(main());
