#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const API_BASE = "https://api.modrinth.com/v2";
const USER_AGENT = "modrinth-downloader/1.0 (local script)";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { headers: { "User-Agent": USER_AGENT } },
      (res) => {
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
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.request(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });
    req.on("error", (err) => {
      fs.unlink(destPath, () => reject(err));
    });
    req.end();
  });
}

async function tryGetProject(slug) {
  try {
    return await fetchJson(`${API_BASE}/project/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (String(err.message).startsWith("HTTP 404")) {
      return null;
    }
    throw err;
  }
}

async function searchProject(query) {
  const params = new URLSearchParams({
    query,
    limit: "5",
    facets: JSON.stringify([["project_type:mod"]]),
  });
  const url = `${API_BASE}/search?${params.toString()}`;
  const data = await fetchJson(url);
  const hits = data.hits || [];
  return hits[0] || null;
}

async function resolveProject(query) {
  const project = await tryGetProject(query);
  if (project) {
    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      resolvedBy: "slug",
    };
  }
  const hit = await searchProject(query);
  if (!hit) return null;
  return {
    id: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    resolvedBy: "search",
  };
}

function parseIso(dateStr) {
  return new Date(dateStr).getTime();
}

async function getLatestVersion(projectId, gameVersion, loader) {
  const params = new URLSearchParams({
    game_versions: JSON.stringify([gameVersion]),
    loaders: JSON.stringify([loader]),
  });
  const url = `${API_BASE}/project/${projectId}/version?${params.toString()}`;
  const versions = await fetchJson(url);
  if (!versions || versions.length === 0) return null;
  versions.sort((a, b) => parseIso(b.date_published) - parseIso(a.date_published));
  return versions[0];
}

function loadModList(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function loadModJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  const mods = data.map((item) => String(item).trim()).filter(Boolean);
  if (mods.length === 0) {
    throw new Error(`No mods found in ${filePath}`);
  }
  return mods;
}

function parseArgs(argv) {
  const args = {
    loader: "neoforge",
    gameVersion: "1.21.1",
    output: "mods",
    mods: null,
    modsFile: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--loader") args.loader = argv[++i];
    else if (arg === "--game-version") args.gameVersion = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--mods-file") args.modsFile = argv[++i];
    else if (arg === "--mods") {
      args.mods = [];
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        args.mods.push(argv[++i]);
      }
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node modrinth_download.js [--loader neoforge] [--game-version 1.21.1] [--output mods]
  node modrinth_download.js --mods better-combat another-furniture
  node modrinth_download.js --mods-file mods.txt
  node modrinth_download.js --mods-file mods/mods.json
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const defaultModsJson = path.join(process.cwd(), "mods", "mods.json");

  let mods = null;
  if (args.modsFile) {
    if (args.modsFile.endsWith(".json")) mods = loadModJson(args.modsFile);
    else mods = loadModList(args.modsFile);
  } else if (args.mods && args.mods.length > 0) {
    mods = args.mods;
  } else if (fs.existsSync(defaultModsJson)) {
    mods = loadModJson(defaultModsJson);
  } else {
    console.error(`Missing default mod list: ${defaultModsJson}`);
    console.error("Provide --mods, --mods-file, or create mods/mods.json.");
    return 2;
  }

  fs.mkdirSync(args.output, { recursive: true });

  const results = [];
  for (const query of mods) {
    const entry = { query };
    const project = await resolveProject(query);
    if (!project) {
      entry.status = "not_found";
      results.push(entry);
      console.log(`[MISS] ${query}: not found on Modrinth`);
      continue;
    }

    Object.assign(entry, project);
    const version = await getLatestVersion(project.id, args.gameVersion, args.loader);
    if (!version) {
      entry.status = "no_version";
      results.push(entry);
      console.log(
        `[MISS] ${query}: no ${args.loader} build for ${args.gameVersion} on Modrinth`
      );
      continue;
    }

    const files = version.files || [];
    if (files.length === 0) {
      entry.status = "no_files";
      results.push(entry);
      console.log(`[MISS] ${query}: no downloadable files in latest version`);
      continue;
    }

    const primary = files.find((f) => f.primary) || files[0];
    const filename = primary.filename;
    const url = primary.url;
    const dest = path.join(args.output, filename);
    try {
      await downloadFile(url, dest);
    } catch (err) {
      entry.status = "download_failed";
      entry.error = String(err.message || err);
      results.push(entry);
      console.log(`[FAIL] ${query}: download failed (${entry.error})`);
      continue;
    }

    entry.status = "downloaded";
    entry.version = version.version_number;
    entry.file = filename;
    results.push(entry);
    if (project.resolvedBy === "search") {
      console.log(`[OK] ${query} -> ${project.title} (${filename})`);
    } else {
      console.log(`[OK] ${query} (${filename})`);
    }
  }

  const reportPath = path.join(args.output, "modrinth_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report written to ${reportPath}`);

  const misses = results.filter((r) => r.status !== "downloaded");
  if (misses.length > 0) {
    console.log("Some mods were not downloaded. Check the report for details.");
    return 2;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
