"""Package locally built binaries; never fetch executable release assets."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
build = root / "build"

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

checksums = {
    arch: digest(build / f"torrentd-darwin-{arch}")
    for arch in ("arm64", "x86_64")
}
manifest = build / "daemon-checksums.json"
if sys.argv[1:] == ["manifest"]:
    manifest.write_text(json.dumps(checksums, indent=2) + "\n")
    sys.exit(0)
if json.loads(manifest.read_text()) != checksums:
    raise SystemExit("Binaries changed since plugin compilation; rebuild the kit")

kit = build / "offline-kit"
kit.mkdir(exist_ok=True)
plugin = kit / "iina-torrent-stream.iinaplgz"
with zipfile.ZipFile(plugin, "w", zipfile.ZIP_DEFLATED) as archive:
    paths = [root / name for name in ("Info.json", "README.md", "SECURITY-AUDIT.md", "LICENSE", "NOTICE")]
    paths += list(root.glob("*.html"))
    paths += list((root / "dist").glob("*.js"))
    for path in paths:
        archive.write(path, path.relative_to(root))
for arch in checksums:
    shutil.copy2(build / f"torrentd-darwin-{arch}", kit)
shutil.copy2(root / "scripts/install-companion.sh", kit)
shutil.copy2(root / "README.md", kit)
shutil.copy2(root / "SECURITY-AUDIT.md", kit)
files = [plugin] + [kit / f"torrentd-darwin-{arch}" for arch in checksums]
files += [kit / "install-companion.sh", kit / "README.md", kit / "SECURITY-AUDIT.md"]
(kit / "SHA256SUMS").write_text("".join(f"{digest(p)}  {p.name}\n" for p in files))
with zipfile.ZipFile(build / "iina-torrent-stream-offline.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in files + [kit / "SHA256SUMS"]:
        archive.write(path, Path("iina-torrent-stream-offline") / path.name)
print(build / "iina-torrent-stream-offline.zip")
