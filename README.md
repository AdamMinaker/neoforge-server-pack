# NeoForge Client Setup (Minecraft 1.21.11)

This server runs NeoForge 1.21.11. You must install NeoForge and the same mods to join.

## Add mods (maintainers)
Use the helper to add mod slugs and rebuild the pack in one step:

```
node add_mod.js xaeros-minimap
node add_mod.js https://modrinth.com/mod/xaeros-minimap
```

This updates `mods/mods.json`, downloads the full mod list, and rebuilds
`neoforge-1.21.11-gravestone.mrpack`.

For non-Modrinth mods (e.g. CurseForge-only), download the jar into `mods/`,
then register it with a direct download URL:

```
node add_mod.js --external-url https://edge.forgecdn.net/files/.../Configured-2.7.3.jar --external-file Configured-2.7.3.jar
```

Add a side hint for non-Modrinth mods so server/client lists are accurate:

```
node add_mod.js --external-url https://edge.forgecdn.net/files/.../Configured-2.7.3.jar --external-file Configured-2.7.3.jar --external-side client
```

To remove mods and rebuild:

```
node remove_mod.js xaeros-minimap
node remove_mod.js https://modrinth.com/mod/xaeros-minimap
```

To remove a non-Modrinth mod entry:

```
node remove_mod.js --external Configured-2.7.3.jar
```

## Server mod list
To copy only server-safe jars into `server_mods/`:

```
node server_mods.js --clean
```

## One-shot update
To refresh mods, rebuild the pack, and copy server jars:

```
node update_pack.js
```

## 1) Install Prism Launcher + import
1. Download Prism Launcher from https://prismlauncher.org and install it.
2. Open Prism Launcher and finish the first-run setup.
3. Click "Add Instance" -> "Import" -> "From URL".
4. Paste the `.mrpack` URL and import:
   - `https://raw.githubusercontent.com/AdamMinaker/neoforge-server-pack/main/neoforge-1.21.11-gravestone.mrpack`
5. Launch the imported instance.

## 2) Launch and join
Start Minecraft with your NeoForge 1.21.11 profile and join the server.

If you get a "missing mods" error, your mod list does not match the server.
