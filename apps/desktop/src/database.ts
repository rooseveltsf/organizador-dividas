import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

const baseline = '20261026000000_legacy_transactions';
const historyTable = '_prisma_migrations';
const historySql = `CREATE TABLE IF NOT EXISTS ${historyTable} (
  id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, finished_at DATETIME,
  migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0
)`;

function checksum(sql: string) {
  return createHash('sha256').update(sql).digest('hex');
}

export function readMigrations(legacySql: string, directory: string) {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  return [{ name: baseline, sql: readFileSync(legacySql, 'utf8') }, ...names.map(name => ({
    name, sql: readFileSync(join(directory, name, 'migration.sql'), 'utf8'),
  }))].map(migration => {
    const sql = migration.sql.replace(/\r\n/g, '\n');
    return { ...migration, sql, hashes: [checksum(sql), checksum(sql.replace(/\n/g, '\r\n'))] };
  });
}

type Migrations = ReturnType<typeof readMigrations>;

function open(path: string, readOnly = false) {
  const db = new DatabaseSync(path, { readOnly, timeout: 5000 });
  db.exec('PRAGMA trusted_schema = OFF');
  return db;
}

function signature(db: DatabaseSync) {
  const objects = db.prepare(`SELECT name, type, sql FROM sqlite_schema
    WHERE name NOT GLOB 'sqlite_*' AND NOT (name = ? AND type = 'table') ORDER BY name`).all(historyTable);
  if (objects.some(({ type, sql }) => !['table', 'index'].includes(String(type)) ||
      /\b(COLLATE|CHECK|GENERATED|VIRTUAL|STRICT|WITHOUT|WHERE)\b/i.test(String(sql)))) {
    throw new Error('A base contém objetos ou restrições fora do schema conhecido.');
  }

  const columns = db.prepare(`SELECT name, upper(type) AS type, "notnull", dflt_value, pk, hidden
    FROM pragma_table_xinfo(?) ORDER BY name`);
  const indexes = db.prepare('SELECT name, "unique", origin, partial FROM pragma_index_list(?) ORDER BY name');
  const indexColumns = db.prepare('SELECT * FROM pragma_index_xinfo(?) ORDER BY seqno');
  const foreignKeys = db.prepare(`SELECT seq, "table", "from", "to", on_update, on_delete, match
    FROM pragma_foreign_key_list(?) ORDER BY "table", "from", seq`);
  return JSON.stringify(objects.filter(object => object.type === 'table').map(({ name }) => ({
    name,
    columns: columns.all(name),
    indexes: indexes.all(name).map(index => ({ ...index, columns: indexColumns.all(index.name) })),
    foreignKeys: foreignKeys.all(name),
  })));
}

function migrationLevel(db: DatabaseSync, migrations: Migrations) {
  const actual = signature(db);
  const reference = open(':memory:');
  try {
    if (signature(reference) === actual) return 0;
    for (const [index, migration] of migrations.entries()) {
      reference.exec(migration.sql);
      if (signature(reference) === actual) return index + 1;
    }
    throw new Error('O schema do banco não corresponde a uma versão conhecida do Caderno de Dívidas.');
  } finally {
    reference.close();
  }
}

function validateHistory(db: DatabaseSync, migrations: Migrations, level: number) {
  const table = db.prepare('SELECT sql FROM sqlite_schema WHERE type = ? AND name = ?').get('table', historyTable);
  if (!table) return new Set<string>();
  const history = db.prepare(`SELECT migration_name, checksum, finished_at FROM ${historyTable}
    WHERE rolled_back_at IS NULL`).all();
  const applied = new Set<string>();
  for (const record of history) {
    const { migration_name: name, finished_at: finished } = record;
    const migration = migrations.slice(0, level).find(entry => entry.name === name);
    if (!finished || !migration?.hashes.includes(String(record.checksum)) || applied.has(migration.name)) {
      throw new Error(`O histórico da migração ${String(name)} não corresponde ao schema ou registra uma falha.`);
    }
    applied.add(migration.name);
  }
  return applied;
}

function validateIntegrity(db: DatabaseSync) {
  const result = db.prepare('PRAGMA integrity_check').all();
  if (result.length !== 1 || result[0].integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').get()) {
    throw new Error('A verificação de integridade do SQLite encontrou problemas.');
  }
}

export async function snapshot(source: string, destination: string) {
  const db = open(source, true);
  try {
    await backup(db, destination);
  } finally {
    db.close();
  }
}

export async function prepareDatabase(path: string, migrations: Migrations, backups: string, importing = false) {
  const existed = existsSync(path);
  mkdirSync(dirname(path), { recursive: true });
  const db = open(path);
  let recovery: string | undefined;
  try {
    validateIntegrity(db);
    const level = migrationLevel(db, migrations);
    if (importing && level === 0) throw new Error('O arquivo não contém o schema de uma base web.');
    const applied = validateHistory(db, migrations, level);
    if (applied.size === migrations.length) return;

    if (existed) {
      mkdirSync(backups, { recursive: true });
      const destination = join(backups, `antes-da-migracao-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sqlite`);
      await snapshot(path, destination);
      recovery = destination;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(historySql);
      const record = db.prepare(`INSERT INTO ${historyTable}
        (id, migration_name, checksum, finished_at, applied_steps_count) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)`);
      for (const [index, migration] of migrations.entries()) {
        if (index >= level) db.exec(migration.sql);
        if (!applied.has(migration.name)) record.run(randomUUID(), migration.name, migration.hashes[0]);
      }
      if (level === 0) db.exec("DELETE FROM profiles WHERE id = 'default-profile-id'");
      if (migrationLevel(db, migrations) !== migrations.length) {
        throw new Error('As migrações não produziram o schema esperado.');
      }
      validateIntegrity(db);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(recovery ? `${message}\n\nCópia de segurança preservada em:\n${recovery}` : message);
  } finally {
    db.close();
  }
}

export function protectedProfiles(path: string) {
  const db = open(path, true);
  try {
    return db.prepare('SELECT id, name, pinHash FROM profiles WHERE pinHash IS NOT NULL ORDER BY name, id').all()
      .map(row => ({ id: String(row.id), name: String(row.name), hash: String(row.pinHash) }));
  } finally {
    db.close();
  }
}

export function clearImportedSessions(path: string) {
  const db = open(path);
  try {
    db.exec('BEGIN; DELETE FROM profile_sessions; UPDATE profiles SET pinAttempts = 0, pinAttemptUntil = NULL; COMMIT;');
  } finally {
    db.close();
  }
}
