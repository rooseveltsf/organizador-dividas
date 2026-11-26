const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { createServer, request: forwardRequest } = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const { temporarySqlite } = require('./temporary-sqlite.cjs');
const { simulateMonthlyPurchase } = require('@organizador/shared');

test('Lista de compras com SQLite temporário', async t => {
  let cleanDatabase, prisma;
  const databaseUrl = await temporarySqlite(cleanup => { cleanDatabase = cleanup; });
  t.after(async () => {
    await prisma?.$disconnect();
    await cleanDatabase();
  });
  process.env.DATABASE_URL = databaseUrl;
  process.env.PROFILE_PIN_SECRET = '7a'.repeat(32);
  ({ prisma } = require('../apps/api/dist/prisma'));
  const appPath = require.resolve('../apps/api/dist/app');
  const server = createServer(require(appPath).default);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const origin = 'http://127.0.0.1:' + server.address().port;

  async function request(path, { method = 'GET', body, token, baseUrl = origin } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(baseUrl + '/api' + path, {
      method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, ...await response.json() };
  }

  async function newProfile(name, pin) {
    const result = await request('/profiles', { method: 'POST', body: {
      name, primaryColor: '#225544', secondaryColor: '#448877', pin, pinConfirmation: pin,
    } });
    assert.equal(result.status, 201, JSON.stringify(result));
    return result.data;
  }

  async function unlock(profile, pin) {
    const result = await request('/profiles/' + profile.id + '/session', { method: 'POST', body: { pin } });
    assert.equal(result.status, 200, JSON.stringify(result));
    return result.data.session.token;
  }

  const alfa = await newProfile('Perfil fictício Alfa');
  const list = '/profiles/' + alfa.id + '/shopping-list';
  const statement = '/transactions?profileId=' + alfa.id;
  const itemPath = item => list + '/' + item.id;

  async function create(body) {
    const result = await request(list, { method: 'POST', body });
    assert.equal(result.status, 201, JSON.stringify(result));
    assert.equal(result.data.purchasedAt, null);
    return result.data;
  }

  const complete = (item, body = {}, baseUrl) => request(itemPath(item) + '/complete', { method: 'POST', body, baseUrl });
  const archive = item => request(itemPath(item) + '/archive', { method: 'POST' });

  await t.test('edita o planejamento e conclui à vista com os dados preenchidos', async () => {
    const planned = await create({ name: '  Mochila de teste  ' });
    assert.equal(planned.name, 'Mochila de teste');
    assert.equal(planned.estimatedAmount, null);
    assert.equal(planned.paymentMethod, null);
    const incomplete = await complete(planned);
    assert.equal(incomplete.status, 400);
    assert.equal((await request(itemPath(planned))).data.purchasedAt, null);

    const updated = await request(itemPath(planned), { method: 'PUT', body: {
      name: 'Mochila de teste', estimatedAmount: 87.12, paymentMethod: 'cash', scheduledDate: '2026-11-20',
    } });
    assert.equal(updated.status, 200);
    assert.deepEqual((await request(statement)).data, []);
    assert.equal((await complete(planned, { date: '2026-11-31' })).status, 400);

    const response = await complete(planned);
    assert.equal(response.status, 200, JSON.stringify(response));
    const bought = response.data;
    assert.ok(bought.purchasedAt);
    assert.equal(bought.actualAmount, 87.12);
    assert.equal(bought.actualPaymentMethod, 'cash');
    assert.equal(bought.groupId, null);
    const [row, ...others] = (await request(statement)).data;
    assert.equal(others.length, 0);
    assert.equal(row.id, bought.transactionId);
    assert.equal(row.type, 'expense');
    assert.equal(row.category, 'daily');
    assert.equal(row.status, 'paid');
    assert.equal(row.date.slice(0, 10), '2026-11-20');
    assert.equal(row.paymentDate, row.date);
    assert.deepEqual((await request(itemPath(planned) + '/transaction')).data, { id: row.id, date: row.date });

    assert.equal((await request(itemPath(planned), { method: 'PUT', body: { name: 'Outro nome' } })).status, 409);
    assert.ok((await archive(planned)).data.archivedAt);
    assert.equal((await complete(planned, { amount: 42 })).data.transactionId, row.id);
    assert.equal((await request(statement)).data.length, 1);
  });

  await t.test('completa só as condições faltantes e registra o preço real parcelado', async () => {
    const planned = await create({ name: 'Mesa de teste', estimatedAmount: 129.99, paymentMethod: 'installments' });
    const result = await complete(planned, { amount: 100, date: '2028-01-31', installmentCount: 3 });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.actualAmount, 100);
    assert.equal(result.data.estimatedAmount, 129.99);
    assert.equal(result.data.actualInstallmentCount, 3);
    assert.equal(result.data.transactionId, null);
    assert.ok(result.data.groupId);
    const rows = (await request(statement + '&groupId=' + result.data.groupId)).data;
    const simulation = simulateMonthlyPurchase({
      profileId: alfa.id, today: '2028-01-01', firstDue: '2028-01-31', total: 100, installments: 3,
    }, []);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(row => [row.date.slice(0, 10), row.amount]),
      simulation.rows.map(row => [row.purchaseDate, Number(row.purchase) / 100]));
    assert.deepEqual(rows.map(row => row.currentInstallment), [1, 2, 3]);
    assert.ok(rows.every(row => row.status === 'pending' && row.paymentDate === null && row.totalInstallments === 3));
    assert.equal((await request(itemPath(planned) + '/transaction')).data.id, rows[0].id);

    await archive(planned);
    assert.equal((await request(statement + '&groupId=' + result.data.groupId)).data.length, 3);
    const cancelled = await create({ name: 'Item arquivado antes da compra' });
    await archive(cancelled);
    assert.equal((await complete(cancelled, { amount: 10, paymentMethod: 'cash', date: '2026-11-20' })).status, 409);
  });

  await t.test('falha na segunda parcela desfaz os lançamentos e mantém A comprar', async () => {
    const planned = await create({
      name: 'Falha fictícia', estimatedAmount: 60, paymentMethod: 'installments', installmentCount: 3, scheduledDate: '2028-04-30',
    });
    const db = new DatabaseSync(databaseUrl.slice('file:'.length));
    try {
      db.exec(`CREATE TRIGGER fail_shopping_test BEFORE INSERT ON transactions
        WHEN NEW.description = 'Falha fictícia' AND NEW.currentInstallment = 2
        BEGIN SELECT RAISE(ABORT, 'Falha de gravação simulada'); END;`);
      assert.equal((await complete(planned)).status, 500);
      const unchanged = (await request(itemPath(planned))).data;
      assert.equal(unchanged.purchasedAt, null);
      assert.equal(unchanged.actualAmount, null);
      assert.equal(unchanged.groupId, null);
      assert.deepEqual((await request(statement + '&search=' + encodeURIComponent(planned.name))).data, []);
    } finally {
      db.exec('DROP TRIGGER IF EXISTS fail_shopping_test');
      db.close();
    }
    assert.equal((await complete(planned)).status, 200);
    assert.equal((await request(statement + '&search=' + encodeURIComponent(planned.name))).data.length, 3);
  });

  await t.test('clique duplo e processos concorrentes geram uma única série', async () => {
    const planned = await create({ name: 'Bicicleta de teste', estimatedAmount: 450,
      paymentMethod: 'installments', installmentCount: 5, scheduledDate: '2028-07-31' });
    const other = spawn(process.execPath, ['-e', `
      const app = require(${JSON.stringify(appPath)}).default;
      const server = app.listen(0, '127.0.0.1', () => process.send(server.address().port));
      process.on('disconnect', () => server.close());
    `], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'], windowsHide: true });
    const exited = once(other, 'exit');
    try {
      const port = await Promise.race([once(other, 'message').then(([port]) => port),
        exited.then(([code]) => assert.fail('Segundo processo saiu com código ' + code))]);
      const otherOrigin = 'http://127.0.0.1:' + port;
      const responses = await Promise.all([
        complete(planned, { amount: 440 }), complete(planned, { amount: 440 }),
        complete(planned, { amount: 430 }, otherOrigin),
      ]);
      const [first] = responses;
      assert.equal(first.status, 200, JSON.stringify(first));
      assert.ok(first.data.groupId);
      responses.forEach(response => assert.deepEqual(response, first));
      const rows = (await request(statement + '&search=' + encodeURIComponent(planned.name))).data;
      assert.equal(rows.length, 5);
      assert.ok(rows.every(row => row.groupId === first.data.groupId));
      assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), first.data.actualAmount);
    } finally {
      if (other.connected) other.disconnect();
      await exited;
    }
  });

  await t.test('nova tentativa após perder a resposta HTTP recupera a compra gravada', async () => {
    const planned = await create({ name: 'Luminária de teste', paymentMethod: 'cash', scheduledDate: '2026-11-20' });
    let upstreamStatus;
    const proxy = createServer((incoming, outgoing) => {
      const upstream = forwardRequest(origin + incoming.url, { method: incoming.method, headers: incoming.headers }, response => {
        response.resume();
        response.once('end', () => {
          upstreamStatus = response.statusCode;
          outgoing.destroy();
        });
      });
      upstream.once('error', () => outgoing.destroy());
      incoming.pipe(upstream);
    });
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    try {
      await assert.rejects(complete(planned, { amount: 31 }, 'http://127.0.0.1:' + proxy.address().port), TypeError);
      assert.equal(upstreamStatus, 200);
      const { data: committed } = await request(itemPath(planned));
      assert.ok(committed.purchasedAt);
      assert.ok(committed.transactionId);
      assert.equal(committed.actualAmount, 31);
      assert.deepEqual(await complete(planned, { amount: 42 }), { status: 200, success: true, data: committed });
      const rows = (await request(statement + '&search=' + encodeURIComponent(planned.name))).data;
      assert.deepEqual(rows.map(row => [row.id, row.amount]), [[committed.transactionId, 31]]);
    } finally {
      await new Promise(resolve => proxy.close(resolve));
    }
  });

  await t.test('isola lista, edição, conclusão, arquivamento e lançamentos de perfis com PIN', async () => {
    const beta = await newProfile('Perfil fictício Beta', '0123');
    const gama = await newProfile('Perfil fictício Gama', '0543');
    const betaList = '/profiles/' + beta.id + '/shopping-list';
    const gamaList = '/profiles/' + gama.id + '/shopping-list';
    const betaToken = await unlock(beta, '0123');
    const gamaToken = await unlock(gama, '0543');
    for (const token of [undefined, gamaToken]) {
      assert.equal((await request(betaList, { token })).status, 401);
      assert.equal((await request(betaList, { token, method: 'POST', body: { name: 'Item bloqueado' } })).status, 401);
    }

    const created = await request(betaList, { method: 'POST', token: betaToken, body: { name: 'Compra protegida' } });
    assert.equal(created.status, 201, JSON.stringify(created));
    const { id } = created.data;
    assert.deepEqual((await request(gamaList, { token: gamaToken })).data, []);
    const operations = [
      ['', 'GET'], ['', 'PUT'], ['/complete', 'POST'], ['/archive', 'POST'], ['/transaction', 'GET'],
    ];
    for (const [suffix, method] of operations) {
      const body = method === 'GET' ? undefined : { name: 'Outro item' };
      assert.equal((await request(betaList + '/' + id + suffix, { method, body, token: gamaToken })).status, 401);
      assert.equal((await request(gamaList + '/' + id + suffix, { method, body, token: gamaToken })).status, 404);
    }
    const marked = await request(betaList + '/' + id + '/complete', { method: 'POST', token: betaToken,
      body: { amount: 24, paymentMethod: 'cash', date: '2026-11-20' } });
    assert.equal(marked.status, 200, JSON.stringify(marked));
    assert.equal((await request(betaList + '/' + id + '/transaction')).status, 401);
    assert.equal((await request('/transactions?profileId=' + beta.id, { token: gamaToken })).status, 401);
    assert.deepEqual((await request('/transactions?profileId=' + gama.id, { token: gamaToken })).data, []);
    const allowed = (await request('/transactions?profileId=' + beta.id, { token: betaToken })).data;
    assert.equal(allowed.length, 1);
    assert.equal(allowed[0].id, marked.data.transactionId);
  });
});
