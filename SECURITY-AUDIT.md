# Security review — 2026-11-18

## Conclusion

No intentional malware, credential harvesting, hidden miner, persistence mechanism, or unrelated data-exfiltration destination was found in the reviewed first-party source. This is a bounded source review and dependency scan, not a certification of safety or proof that every dependency is benign.

Use the explicitly reviewed `hardened-offline` branch and a locally built offline kit. The fork's default `master` branch remains the original snapshot until the owner chooses to merge the changes. Do not install the original release merely because this fork exists.

## Scope and evidence

- Upstream: `n0madic/iina-torrent-stream`, commit `f4c4605bbe72c5793a55585ba5fa7a9654bb0ad9` (source version 0.1.3).
- Latest published upstream release observed: `v0.1.2`, 2026-05-29. It predates the API-token security work. Release assets were enumerated, **not executed or certified as matching source**.
- Reviewed TypeScript entry points, all companion management and shell invocations, Go daemon/API/storage/network code, HTML scripts, manifest, Makefile, release workflow, locks and available history.
- Examined selected dependency source for storage path containment and the bencode recursion fix. A full manual review of all transitive dependencies was not performed.
- Native binaries in this kit were compiled from this fork with Go 1.27.4, then ad-hoc signed locally. Ad-hoc signing is not an independent developer identity or notarization.
- An independent reviewer checked the changes. Two packaging/update findings were fixed and passed a targeted second review.

## Findings and changes

| Finding | Evidence / consequence | Fork treatment |
|---|---|---|
| Upstream release API lacks authentication | `v0.1.2:torrentd/server.go` registers loopback routes without the later token gate | Base on newer source with random 256-bit API token and 0600 state file |
| Forking alone retains upstream executable dependency | Upstream `src/daemon.ts` downloads from hardcoded `n0madic` release URLs; `Info.json` points updater there | Remove executable downloads and `ghRepo`; new `com.github.k1ng` identifier |
| Existing binary executes before verification | Upstream invokes `torrentd --version`, trusts matching version, and accepts `dev` without hashing | Require pinned SHA-256 before any companion execution; no development bypass |
| Known Go vulnerabilities | Original dependency graph plus local Go 1.27.3 yielded 10 symbol-level scanner findings | Update affected modules and build with Go 1.27.4 |
| Build dependencies have advisories | Original npm lock: four affected package entries, three high and one moderate | Apply available lockfile fixes, exact direct pins, disable npm install scripts; residual below |
| An update can reuse the previous running daemon | IINA may quit before its companion; replacing its executable does not replace the process | Installer refuses while the fork's state or lock file remains |
| Stale build files could leak into ZIP | Reusing an output folder and archiving every entry | Archive an explicit allowlist |

The upstream last commit already added substantial defensive work: authenticated loopback API, private state files, sanitized playlist titles, bounded remote metainfo fetches and public-address checks for those fetches. The findings above are not evidence of malicious intent.

## Dependency scan details

Scanner: `golang.org/x/vuln/cmd/govulncheck@v1.10.0`, darwin/arm64, `CGO_ENABLED=0`, database queried 2026-11-18.

The initial symbol-level report included:

- [GO-2026-6894](https://pkg.go.dev/vuln/GO-2026-6894): unbounded bencode recursion in anacrolix/torrent. Updated from 1.61.0 to `v1.61.1-0.20260911233437-76452a2c8a2f`, whose decoder enforces a nesting limit.
- [GO-2026-6859](https://pkg.go.dev/vuln/GO-2026-6859): Go HTTP server issue; build toolchain changed from local 1.27.3 to 1.27.4.
- GO-2026-6617, 6612, 6611, 6610, 6603: x/net HTTP/2 issues; updated to 0.60.0.
- GO-2026-6278: Gorilla WebSocket masking; updated to 1.5.3.
- GO-2026-6165: Pion DTLS parsing; updated to 3.1.4.
- GO-2026-6163: Pion STUN parsing; updated to 3.1.5.

After changes: **0 symbol-level findings**, with **one imported-package finding and three module-only findings** that the scanner does not find called by this program:

- GO-2026-5506: OpenTelemetry baggage allocations.
- GO-2026-6866 and GO-2026-6860: x/net HTML processing.
- GO-2026-5932: unmaintained x/crypto/openpgp.

Reachability analysis can have limitations. These are recorded rather than described as an entirely clean dependency tree. Intel binaries were cross-compiled, not separately scanned or run.

Final `npm audit`: **3 high package entries**, all tracing to one [picomatch ReDoS advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), through micromatch and @parcel/watcher. No fixed picomatch version was available in the queried registry (latest 4.0.7 was affected). This is a **build-tool** dependency: node_modules/Parcel are not shipped in the plugin, and the reviewed plugin imports no npm runtime libraries. It remains a risk when building against attacker-controlled patterns/configuration, not evidence of malware. Do not treat `npm audit fix` as proof of resolution.

## Remaining runtime boundaries

- `file-system` permission enables native command execution with the current user's privileges. The companion is not confined by IINA's JavaScript domain allowlist. No sandbox was added to the installed daemon.
- The companion opens BitTorrent peer sockets, uses DHT and trackers, and may use UPnP/NAT-PMP. These disclose IP/infohash and can expose a peer port. Seeding is enabled by default; disabling ongoing seeding does not promise zero upload while downloading. No VPN binding or kill switch exists.
- Public trackers are appended to non-private torrents. This is documented peer discovery, not covert telemetry. Private-torrent behavior before metadata is known has not been exhaustively tested.
- **The SSRF guard is not global.** `loadRemoteMetainfo` blocks local/private addresses only when fetching the top-level remote `.torrent`. Library HTTP webseeds and trackers use separate transports; untrusted torrent/magnet metadata can cause requests to localhost/LAN. Do not use this plugin as a security boundary from untrusted torrent sources to sensitive local services.
- The magnet dialog reads the clipboard via `pbpaste` for prefill. No clipboard polling outside that flow was found. Source URLs, torrent names and hashes are written to local diagnostics; tracker passkeys in URLs may therefore remain on disk. The local API token is also in playback URLs and may appear in player history.
- The cache has no disk quota. Global heartbeats keep the daemon alive while IINA runs, so cache cleanup is tied to daemon exit, not necessarily closing the last video. Cleanup is recursive; only plugin-supplied cache paths were reviewed. Do not manually run the daemon with `--cache-dir` pointing at valuable files.
- Torrent storage checks lexical path containment, but a comprehensive symlink-race filesystem audit was not performed. Media and subtitle decoding still depends on IINA/mpv and its libraries.
- Hashes prevent executing a mismatched companion relative to this package. An attacker who controls the whole package or the user's account can replace both code and hashes. Retain the reviewed source commit and independently stored artifact digest.

## Verification

- `make package test`: passes; both macOS architectures compile, npm lifecycle scripts remain disabled, Go module checksums verify, 11 plugin tests and the existing Go suite pass.
- `tsc --noEmit`: passes.
- New tests reject missing/malformed pins, modified bytes, checksum-command failure, missing executables and unsupported architectures, and assert that no companion/version probe is invoked during verification.
- Independent second review: installer state/lock refusal and explicit archive allowlist accepted.
- Native Apple Silicon smoke test passed with outbound networking denied: startup, 0600 token file, 0700 data directory, unauthenticated/wrong-token requests rejected (401), authenticated health (200), diagnostics disabled (404), graceful shutdown and cache/state/lock cleanup. No public torrent was opened.
- Archive allowlist regression passed with a synthetic unrelated file planted in the output directory.
- Installer exercised in an isolated temporary HOME: correct binary/hash installed; state and lock markers independently refused replacement. ZIP integrity, embedded pins, separate identifier, lack of update/download URLs, and both ad-hoc code signatures verified.
- No installation into the user's IINA profile or end-to-end playback verification is claimed.

For future updates, review explicit commits, regenerate the kit, repeat tests/scans, and reinstall both components together. A frozen fork prevents unsolicited upstream changes; it does not automatically acquire security fixes.
