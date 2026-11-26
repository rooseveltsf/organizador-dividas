const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const { clearImportedSessions, prepareDatabase, protectedProfiles, readMigrations, snapshot } = require('../apps/desktop/dist/database.js');
const { temporarySqlite } = require('./temporary-sqlite.cjs');

const root = resolve(__dirname, '..');
const migrations = readMigrations(join(root, 'apps/desktop/resources/legacy-transactions.sql'), join(root, 'apps/api/prisma/migrations'));

function files(t) {
  const dir = mkdtempSync(join(tmpdir(), 'Organizador Validação '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, database: join(dir, 'lançamentos.sqlite'), backups: join(dir, 'backups') };
}

function use(path, callback) {
  const db = new DatabaseSync(path);
  try { return callback(db); } finally { db.close(); }
}

function history(db) {
  return db.prepare('SELECT migration_name FROM _prisma_migrations ORDER BY migration_name').all().map(row => row.migration_name);
}

test('a instalação vazia roda todo o histórico e a reabertura não repete migrações', async t => {
  const { database, backups } = files(t);
  await prepareDatabase(database, migrations, backups);
  const before = readFileSync(database);
  await prepareDatabase(database, migrations, backups);
  assert.deepEqual(readFileSync(database), before);
  use(database, db => {
    assert.deepEqual(history(db), migrations.map(m => m.name));
    assert.equal(db.prepare('SELECT count(*) n FROM profiles').get().n, 0);
  });
});

test('a atualização guarda o WAL e aplica somente migrações pendentes sobre a base anterior', async t => {
  const { database, backups } = files(t);
  const installed = migrations.slice(0, 3);
  await prepareDatabase(database, installed, backups);
  const writer = new DatabaseSync(database);
  try {
    writer.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
      INSERT INTO profiles(id,name,avatarInitials,primaryColor,secondaryColor,updatedAt)
      VALUES('p','Perfil','PE','#112233','#445566',CURRENT_TIMESTAMP)`);
    await prepareDatabase(database, migrations, backups);
    assert.deepEqual(history(writer), migrations.map(m => m.name));
    const [backup] = readdirSync(backups);
    use(join(backups, backup), copy => {
      assert.deepEqual(history(copy), installed.map(m => m.name));
      assert.equal(copy.prepare('SELECT id FROM profiles').get().id, 'p');
    });
  } finally { writer.close(); }
});

test('a importação entende a base anterior sem histórico e preserva IDs, parcelas, vínculos e WAL', async t => {
  const { dir, database, backups } = files(t);
  const web = join(dir, 'versão web.sqlite');
  const writer = new DatabaseSync(web);
  try {
    writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0');
    for (const { sql } of migrations) writer.exec(sql);
    writer.exec(`UPDATE profiles SET pinHash='fictício', pinAttempts=2 WHERE id='default-profile-id';
      INSERT INTO transactions(id,profileId,type,category,amount,description,date,currentInstallment,totalInstallments,groupId,updatedAt)
      VALUES('t','default-profile-id','expense','installment',24,'Parcela',CURRENT_TIMESTAMP,1,3,'g',CURRENT_TIMESTAMP);
      INSERT INTO shopping_items(id,profileId,name,transactionId,groupId) VALUES('i','default-profile-id','Compra','t','g');
      INSERT INTO profile_sessions VALUES('token-fictício','default-profile-id',CURRENT_TIMESTAMP);`);
    await snapshot(web, database);
    await prepareDatabase(database, migrations, backups);
    assert.equal(protectedProfiles(database)[0].id, 'default-profile-id');
    clearImportedSessions(database);
    use(database, copy => {
      assert.equal(copy.prepare('SELECT currentInstallment FROM transactions WHERE id = ?').get('t').currentInstallment, 1);
      assert.deepEqual({ ...copy.prepare('SELECT id, transactionId, groupId FROM shopping_items').get() }, { id: 'i', transactionId: 't', groupId: 'g' });
      assert.equal(copy.prepare('SELECT count(*) n FROM profile_sessions').get().n, 0);
    });
    assert.equal(writer.prepare('SELECT count(*) n FROM profile_sessions').get().n, 1);
    assert.equal(writer.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='_prisma_migrations'").get().n, 0);
  } finally { writer.close(); }
});

test('a tabela legada anterior a perfis conserva transações e o erro de migração conserva a cópia', async t => {
  const { database, backups } = files(t);
  use(database, db => {
    db.exec(migrations[0].sql);
    db.exec(`INSERT INTO transactions(id,type,category,amount,description,date,groupId,updatedAt)
      VALUES('original','expense','installment',12,'Parcela',CURRENT_TIMESTAMP,'g',CURRENT_TIMESTAMP)`);
  });
  const invalid = [...migrations, { name: '20261126000000_exemplo', sql: 'SQL inválido', hashes: ['invalid'] }];
  await assert.rejects(prepareDatabase(database, invalid, backups), /Cópia de segurança preservada/);
  use(database, db => assert.equal(db.prepare('SELECT id FROM transactions').get().id, 'original'));
  assert.equal(readdirSync(backups).length, 1);
  await prepareDatabase(database, migrations, backups);
  use(database, db => {
    const row = db.prepare('SELECT profileId, groupId FROM transactions WHERE id = ?').get('original');
    assert.deepEqual({ ...row }, { profileId: 'default-profile-id', groupId: 'g' });
  });
});

test('um arquivo com schema desconhecido não é ativado', async t => {
  const { database, backups } = files(t);
  use(database, db => db.exec('CREATE TABLE desconhecida (id TEXT)'));
  await assert.rejects(prepareDatabase(database, migrations, backups), /schema do banco não corresponde/);
});

test('uma base criada diretamente pelo schema Prisma recebe o histórico sem recriar tabelas', async t => {
  const { database, backups } = files(t);
  const schemaUrl = await temporarySqlite(callback => t.after(callback));
  const source = schemaUrl.slice('file:'.length);
  await snapshot(source, database);
  await prepareDatabase(database, migrations, backups, true);
  use(database, db => assert.deepEqual(history(db), migrations.map(m => m.name)));
});
