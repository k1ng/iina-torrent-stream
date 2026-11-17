const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const expected = 'a'.repeat(64);
const source = ts.transpileModule(fs.readFileSync('src/binary.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function load({ arch = 'arm64', exists = true, hash = expected, hashStatus = 0 } = {}) {
  const calls = [];
  const context = {
    exports: {},
    iina: {
      file: { exists: () => exists },
      utils: {
        resolvePath: () => '/synthetic/plugin-data/torrentd',
        exec: async (path, args) => {
          calls.push([path, args]);
          if (path === '/usr/bin/uname') return { status: 0, stdout: arch + '\n' };
          if (path === '/usr/bin/shasum') return { status: hashStatus, stdout: hash + '  torrentd\n' };
          throw new Error('An unverified executable was invoked: ' + path);
        },
      },
    },
  };
  vm.runInNewContext(source, context);
  return { check: context.exports.ensureLocalBinary, calls };
}

test('accepts matching pinned bytes without running a version probe', async () => {
  const { check, calls } = load();
  assert.equal(await check({ arm64: expected }), '/synthetic/plugin-data/torrentd');
  assert.deepEqual(calls.map(x => x[0]), ['/usr/bin/uname', '/usr/bin/shasum']);
});

for (const [name, options, pins, error] of [
  ['tampered binary', { hash: 'b'.repeat(64) }, { arm64: expected }, /mismatch/],
  ['checksum command failure', { hashStatus: 1 }, { arm64: expected }, /mismatch/],
  ['missing binary', { exists: false }, { arm64: expected }, /Install the companion/],
  ['missing checksum', {}, {}, /Missing pinned/],
  ['malformed checksum', {}, { arm64: 'dev' }, /Missing pinned/],
  ['unsupported architecture', { arch: 'other' }, { other: expected }, /architecture/],
]) {
  test('fails closed for ' + name, async () => {
    const { check, calls } = load(options);
    await assert.rejects(check(pins), error);
    assert.ok(calls.every(([path]) => ['/usr/bin/uname', '/usr/bin/shasum'].includes(path)));
  });
}
