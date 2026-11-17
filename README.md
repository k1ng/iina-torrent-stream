# IINA Torrent Stream — k1ng fork

Personal, manually updated fork of [n0madic/iina-torrent-stream](https://github.com/n0madic/iina-torrent-stream), based on commit `f4c4605bbe72c5793a55585ba5fa7a9654bb0ad9`.
Streams magnet links and torrent files in IINA on macOS. Original MIT license and attribution are retained.

## Independence from upstream

- No runtime executable downloads, release URL, or development checksum bypass.
- The companion is built locally from Go source. Both signed architecture binaries are included in the **offline installation kit**.
- The plugin verifies the installed companion's pinned SHA-256 **before executing it**, including before any version probe.
- A separate plugin identifier isolates this fork's data from the original plugin.
- `ghRepo` is omitted, so IINA's plugin updater has no GitHub update source. Update by explicitly rebuilding and reinstalling a reviewed revision.
- The upstream release workflow is removed. There is no scheduled sync or automatic release workflow in this branch.
- Dependencies are locked with `package-lock.json` and `go.mod` / `go.sum`. npm lifecycle scripts are disabled during installation.

This does not make dependency registries unnecessary when **building**, nor remove the need to review future security fixes.

## Build

Requires macOS, Node.js 22+, npm, Python 3, Go with toolchain download support, and Apple's `codesign` tool. The build selects Go **1.27.4** without changing the system Go installation.

```sh
git clone --branch hardened-offline https://github.com/k1ng/iina-torrent-stream.git
cd iina-torrent-stream
make package
make test
```

Output: `build/iina-torrent-stream-offline.zip` and the unpacked `build/offline-kit/`.
The kit contains a `.iinaplgz`, both companion binaries, an explicit installer, and `SHA256SUMS`.
The `.iinaplgz` alone is **not** a complete installation: the matching companion must be installed too.

## Install

1. Quit IINA. Disable/uninstall the original Torrent Stream plugin if present.
2. Extract the offline kit, open a terminal in its directory, and run:
   ```sh
   sh install-companion.sh
   ```
   This checks the included checksums and copies only the companion for your Mac into the fork's private plugin data directory. No sudo, downloads, autostart service, or quarantine removal is used.
3. Open `iina-torrent-stream.iinaplgz` with IINA and enable **Torrent Stream (k1ng)** under Settings → Plugins. Grant the requested filesystem, network, and alert permissions.
4. Use Plugins → Torrent Stream (k1ng) → Open Magnet Link / Open Torrent File.

If macOS blocks a downloaded kit, inspect the files and use the normal macOS security approval flow. The installer does not bypass Gatekeeper. Plugin support must be available/enabled in your IINA build.

## Security and privacy boundaries

The Go companion runs with your user account's filesystem/network privileges. IINA's JavaScript domain allowlist is **not a sandbox for native processes**.

The API listens on `127.0.0.1` with a random 256-bit token stored in a mode-0600 state file. This protects against unauthenticated callers; it does not isolate other software running as your user. Tokens can appear in playback URLs/history.

Torrent traffic contacts peers, trackers and DHT nodes, disclosing your public IP and torrent infohash. The original settings enable seeding and the torrent library may configure UPnP/NAT-PMP. Turning off “Keep seeding” does not promise zero uploads during downloading. The plugin adds public trackers to non-private torrents. No VPN binding or kill switch is provided.

Opening the magnet dialog reads the clipboard to prefill a torrent-looking link. Local diagnostic logs can retain source URLs (including private tracker parameters), filenames and infohashes. The cache has no disk quota and normally persists while IINA runs, then is removed when the daemon exits. Media/subtitle parsing is also part of IINA/mpv's attack surface.

A source audit and vulnerability scan cannot certify the absence of malware in all transitive dependencies, build tools or future versions. This fork is a controlled snapshot, not a promise of permanent security.

See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for the review scope, findings and verification results.
