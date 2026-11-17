// Verify bytes before executing anything from the plugin data directory.
const { utils, file } = iina;

export async function ensureLocalBinary(
  checksums: Record<string, string>,
): Promise<string> {
  const archResult = await utils.exec("/usr/bin/uname", ["-m"]);
  const arch = archResult.stdout.trim();
  if (archResult.status !== 0 || !["arm64", "x86_64"].includes(arch)) {
    throw new Error("Unsupported CPU architecture");
  }
  const expected = checksums[arch];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error("Missing pinned torrentd checksum; rebuild the offline kit");
  }
  const path = "@data/torrentd";
  if (!file.exists(path)) {
    throw new Error("Install the companion using install-companion.sh from the matching offline kit");
  }
  const resolved = utils.resolvePath(path);
  const result = await utils.exec("/usr/bin/shasum", ["-a", "256", resolved]);
  const actual = result.stdout.trim().split(/\s+/)[0];
  if (result.status !== 0 || actual !== expected) {
    throw new Error("torrentd checksum mismatch; reinstall the matching offline kit");
  }
  return resolved;
}
