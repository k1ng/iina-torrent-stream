#!/bin/sh
# Run explicitly from an extracted, trusted offline kit. No network or sudo.
set -eu
cd -- "$(dirname -- "$0")"
if /usr/bin/pgrep -x IINA >/dev/null; then
  echo 'Quit IINA before installing the companion.' >&2
  exit 1
fi
arch=$(/usr/bin/uname -m)
case "$arch" in arm64|x86_64) ;; *) echo 'Unsupported architecture' >&2; exit 1 ;; esac
/usr/bin/shasum -a 256 -c SHA256SUMS
data_dir="$HOME/Library/Application Support/com.colliderli.iina/plugins/.data/com.github.k1ng.iina-torrent-stream"
/bin/mkdir -p "$data_dir"
/bin/chmod 700 "$data_dir"
if [ -e "$data_dir/torrentd.lock" ] || [ -e "$data_dir/torrentd.json" ]; then
  echo 'The previous companion has not finished shutting down. Wait at least 35 seconds after quitting IINA, then retry. If these files persist, inspect the daemon before removing stale state.' >&2
  exit 1
fi
/usr/bin/install -m 700 "torrentd-darwin-$arch" "$data_dir/torrentd"
echo 'Companion installed. Open iina-torrent-stream.iinaplgz with IINA and enable Torrent Stream (k1ng).'
