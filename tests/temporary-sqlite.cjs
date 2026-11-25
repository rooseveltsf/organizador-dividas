const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function temporarySqlite(cleanup) {
  const directory = await mkdtemp(join(tmpdir(), 'organizador-test-'));
  cleanup(() => rm(directory, { recursive: true, force: true, maxRetries: 5 }));
  const path = join(directory, 'test.db');
  const url = 'file:' + path.replaceAll('\\', '/');
  const setup = spawnSync(process.execPath, [
    require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--script',
    '--to-schema-datamodel', join(__dirname, '../apps/api/prisma/schema.prisma'),
  ], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.error?.message ?? setup.stderr);
  const database = new DatabaseSync(path);
  try {
    database.exec(setup.stdout);
  } finally {
    database.close();
  }
  return url;
}

module.exports = { temporarySqlite };
