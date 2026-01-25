# Agent Notes

This file documents the commands used to download mods and build the Modrinth pack.

## Download mods (NeoForge 1.21.11)
Uses `modrinth_download.js` to fetch the latest Modrinth builds from
`mods/mods.json` and update `mods/modrinth_report.json`.

```
node modrinth_download.js --loader neoforge --game-version 1.21.11 --output mods
```

## Add mod + rebuild pack (recommended)
Uses `add_mod.js` to append mod slugs to `mods/mods.json`, then downloads
mods and rebuilds the pack.

```
node add_mod.js distant-horizons
node add_mod.js https://modrinth.com/mod/xaeros-minimap
```

Tip: use this for all future mod additions to keep `mods/mods.json` and the
pack in sync.

## Remove mod + rebuild pack
Uses `remove_mod.js` to remove mod slugs from `mods/mods.json`, then downloads
mods and rebuilds the pack.

```
node remove_mod.js xaeros-minimap
node remove_mod.js https://modrinth.com/mod/xaeros-minimap
```

## Build the Modrinth pack
Uses `modrinth_pack.js` to generate the `.mrpack` file from the report.

```
node modrinth_pack.js --game-version 1.21.11 --loader neoforge --mods-dir mods --report mods/modrinth_report.json --output neoforge-1.21.11-gravestone.mrpack --loader-version 21.11.13-beta
```

## Notes
- `mods/modrinth_report.json` is the source of truth for which mods are included.
- `mods/mods.json` is the canonical mod list; keep it up to date.
- Re-run the download command before building the pack if the mods folder was cleared.
