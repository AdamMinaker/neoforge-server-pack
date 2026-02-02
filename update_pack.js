#!/usr/bin/env node
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
  const args = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--loader") args.loader = argv[++i];
    else if (arg === "--game-version") args.gameVersion = argv[++i];
    else if (arg === "--loader-version") args.loaderVersion = argv[++i];
    else if (arg === "--mods-dir") args.modsDir = argv[++i];
    else if (arg === "--report") args.report = argv[++i];
    else if (arg === "--output") args.outputPack = argv[++i];
    else if (arg === "--help" || arg === "-h") return { help: true };
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node update_pack.js
  node update_pack.js --game-version 1.21.11 --loader neoforge
  `);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  run("node", [
    "modrinth_download.js",
    "--loader",
    args.loader,
    "--game-version",
    args.gameVersion,
    "--output",
    args.modsDir,
    "--pins",
    "mods/modrinth_pins.json",
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

  run("node", ["server_mods.js", "--clean"]);

  return 0;
}

process.exit(main());
