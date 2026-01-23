# Agent Notes

This file documents the commands used to download mods and build the Modrinth pack.

## Download mods (NeoForge 1.21.11)
Uses `modrinth_download.js` to fetch the latest Modrinth builds and update
`mods/modrinth_report.json`.

```
node modrinth_download.js --loader neoforge --game-version 1.21.11 --mods gravestone-mod iris sodium --output mods
```

## Build the Modrinth pack
Uses `modrinth_pack.js` to generate the `.mrpack` file from the report.

```
node modrinth_pack.js --game-version 1.21.11 --loader neoforge --mods-dir mods --report mods/modrinth_report.json --output neoforge-1.21.11-gravestone.mrpack --loader-version 21.11.13-beta
```

## Notes
- `mods/modrinth_report.json` is the source of truth for which mods are included.
- Re-run the download command before building the pack if the mods folder was cleared.
