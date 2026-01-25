#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const API_BASE = "https://api.modrinth.com/v2";
const USER_AGENT = "modrinth-pack/1.0 (local script)";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getFileInfo(projectId, filename, gameVersion, loader) {
  const params = new URLSearchParams({
    game_versions: JSON.stringify([gameVersion]),
    loaders: JSON.stringify([loader]),
  });
  const url = `${API_BASE}/project/${projectId}/version?${params.toString()}`;
  const versions = await fetchJson(url);
  for (const version of versions || []) {
    const files = version.files || [];
    const match = files.find((file) => file.filename === filename);
    if (match) return match;
  }
  return null;
}

function loadExternalMods(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return data;
}

function hashFile(filePath, algorithm) {
  const hash = crypto.createHash(algorithm);
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function normalizeExternalEntry(entry, modsDir) {
  const fileValue = String(entry.file || "").trim();
  if (!fileValue) throw new Error("External entry missing 'file'.");
  const urlValue = String(entry.url || "").trim();
  if (!urlValue) throw new Error("External entry missing 'url'.");
  const localPath = path.isAbsolute(fileValue)
    ? fileValue
    : path.join(modsDir, fileValue);
  const filename = path.basename(fileValue);
  return { filename, localPath, url: urlValue };
}

function parseArgs(argv) {
  const args = {
    loader: "neoforge",
    gameVersion: "1.21.11",
    modsDir: "mods",
    report: "mods/modrinth_report.json",
    external: "mods/external_mods.json",
    output: "neoforge-1.21.11.mrpack",
    name: "NeoForge 1.21.11 Mods",
    summary: "Auto-generated Modrinth pack for the server/client mod list.",
    loaderVersion: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--loader") args.loader = argv[++i];
    else if (arg === "--game-version") args.gameVersion = argv[++i];
    else if (arg === "--mods-dir") args.modsDir = argv[++i];
    else if (arg === "--report") args.report = argv[++i];
    else if (arg === "--external") args.external = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--name") args.name = argv[++i];
    else if (arg === "--summary") args.summary = argv[++i];
    else if (arg === "--loader-version") args.loaderVersion = argv[++i];
    else if (arg === "--help" || arg === "-h") return { help: true };
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node modrinth_pack.js [--game-version 1.21.11] [--loader neoforge]
                        [--mods-dir mods] [--report mods/modrinth_report.json]
                        [--external mods/external_mods.json]
                        [--output neoforge-1.21.11.mrpack]
                        [--loader-version 21.1.123]
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const reportPath = path.resolve(args.report);
  const modsDir = path.resolve(args.modsDir);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const downloaded = report.filter((entry) => entry.status === "downloaded");

  if (downloaded.length === 0) {
    console.error("No downloaded mods found in report.");
    return 2;
  }

  const files = [];
  for (const entry of downloaded) {
    if (!entry.id || !entry.file) continue;
    const info = await getFileInfo(
      entry.id,
      entry.file,
      args.gameVersion,
      args.loader
    );
    if (!info) {
      throw new Error(`No Modrinth file match for ${entry.file}`);
    }
    const localPath = path.join(modsDir, entry.file);
    const stat = fs.statSync(localPath);
    files.push({
      path: `mods/${entry.file}`,
      hashes: info.hashes,
      downloads: [info.url],
      fileSize: stat.size,
    });
  }

  const externalPath = path.resolve(args.external);
  const externalMods = loadExternalMods(externalPath);
  for (const entry of externalMods) {
    const normalized = normalizeExternalEntry(entry, modsDir);
    const stat = fs.statSync(normalized.localPath);
    const filePath = `mods/${normalized.filename}`;
    if (files.some((file) => file.path === filePath)) {
      throw new Error(`Duplicate mod file in pack: ${filePath}`);
    }
    files.push({
      path: filePath,
      hashes: {
        sha1: hashFile(normalized.localPath, "sha1"),
        sha512: hashFile(normalized.localPath, "sha512"),
      },
      downloads: [normalized.url],
      fileSize: stat.size,
    });
  }

  const dependencies = { minecraft: args.gameVersion };
  if (args.loaderVersion) dependencies[args.loader] = args.loaderVersion;

  const index = {
    formatVersion: 1,
    game: "minecraft",
    versionId: "1.0.0",
    name: args.name,
    summary: args.summary,
    files,
    dependencies,
  };

  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "mrpack-"));
  fs.writeFileSync(
    path.join(buildDir, "modrinth.index.json"),
    JSON.stringify(index, null, 2)
  );

  const outputPath = path.resolve(args.output);
  const zipResult = spawnSync("zip", ["-r", outputPath, "modrinth.index.json"], {
    cwd: buildDir,
    stdio: "inherit",
  });
  if (zipResult.status !== 0) {
    throw new Error("zip command failed; ensure 'zip' is installed.");
  }

  console.log(`Pack written to ${outputPath}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
