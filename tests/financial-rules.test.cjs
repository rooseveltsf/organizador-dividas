const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { existsSync, readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { after, before, test } = require('node:test');
const express = require('express');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const { batchCreateTransactionSchema, createTransactionSchema } = require('@organizador/shared');

const originalTimezone = process.env.TZ;
let directory, server, baseUrl, prisma, web, addMonths, parseLocalDate;

// Carrega os componentes reais para SSR, com as classes CSS substituídas.
const webModules = new Map();
function loadWeb(filename) {
  if (webModules.has(filename)) return webModules.get(filename).exports;
  const compiled = { exports: {} };
  webModules.set(filename, compiled);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  const localRequire = createRequire(filename);
  function load(name) {
    if (name.endsWith('.css')) return {};
    if (name === '../api') return {};
    if (name === '@/styled-system/css') {
      return { css: () => '', cva: () => () => '', cx: (...values) => values.filter(Boolean).join(' ') };
    }
    if (!name.startsWith('.')) return localRequire(name);
    const path = resolve(dirname(filename), name);
    const source = [path + '.ts', path + '.tsx', join(path, 'index.ts')].find(existsSync);
    assert.ok(source, name + ' importado de ' + filename);
    return loadWeb(source);
  }
  new Function('require', 'module', 'exports', outputText)(load, compiled, compiled.exports);
  return compiled.exports;
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'organizador-test-'));
  const databasePath = join(directory, 'test.db');
  const databaseUrl = 'file:' + databasePath.replaceAll('\\', '/');
  const setup = spawnSync(process.execPath, [
    require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--script',
    '--to-schema-datamodel', join(__dirname, '../apps/api/prisma/schema.prisma'),
  ], { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.error?.message ?? setup.stderr);
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(setup.stdout);
  } finally {
    database.close();
  }

  process.env.DATABASE_URL = databaseUrl;
  ({ prisma } = require('../apps/api/dist/prisma'));
  ({ addMonths, parseLocalDate } = require('../apps/api/dist/controllers/transactionController'));
  const app = express();
  app.use(express.json());
  app.use('/transactions', require('../apps/api/dist/routes/transactions').default);
  app.use('/profiles', require('../apps/api/dist/routes/profiles').default);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port;

  const fromWeb = path => loadWeb(join(__dirname, '../apps/web/src', path));
  web = {
    ...fromWeb('pages/Dashboard.tsx'),
    ...fromWeb('calendar.ts'),
    ...fromWeb('futureCommitments.ts'),
    ...fromWeb('components/MonthlySummary.tsx'),
    ...fromWeb('contexts/TransactionContext.tsx'),
    ...fromWeb('contexts/ProfileContext.tsx'),
  };
});

after(async () => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 5 });
});

async function request(method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

async function expectResponse(method, path, body, status) {
  const result = await request(method, path, body);
  assert.equal(result.status, status, JSON.stringify(result.body));
  return result.body.data;
}

const profile = () => expectResponse('POST', '/profiles', {
  name: 'Perfil de teste', primaryColor: '#123456', secondaryColor: '#654321',
}, 201);
const entry = (fields = {}) => ({
  description: 'Lançamento de teste', type: 'expense', category: 'daily',
  date: '2028-01-31', amount: 12.34, ...fields,
});
const create = (profileId, fields) =>
  expectResponse('POST', '/transactions', { profileId, ...entry(fields) }, 201);
const batch = (profileId, transactions, repeatMonths) =>
  expectResponse('POST', '/transactions/batch', { profileId, transactions, repeatMonths }, 201);
const list = (profileId, params = '') =>
  expectResponse('GET', '/transactions?profileId=' + profileId + params, undefined, 200);
const day = item => item.date.slice(0, 10);

test('addMonths mantém a data-base nos dias 29, 30 e 31, incluindo fevereiro e ano bissexto', () => {
  process.env.TZ = 'America/Fortaleza';
  for (const [base, offset, expected] of [
    ['2027-01-29', 1, '2027-02-28'], ['2027-01-30', 1, '2027-02-28'],
    ['2027-01-31', 1, '2027-02-28'], ['2028-01-31', 1, '2028-02-29'],
    ['2028-01-30', 1, '2028-02-29'], ['2028-01-29', 1, '2028-02-29'],
    ['2028-01-31', 2, '2028-03-31'], ['2028-02-29', 12, '2029-02-28'],
    ['2028-12-31', 4, '2029-04-30'], ['2028-03-31', -1, '2028-02-29'],
  ]) {
    const start = parseLocalDate(base);
    assert.equal(addMonths(start, offset).toISOString().slice(0, 10), expected);
    assert.equal(start.toISOString().slice(0, 10), base);
  }
});

test('a compra de R$ 100,00 em 3 parcelas conserva os centavos e as datas', async () => {
  const { id } = await profile();
  const result = await create(id, { category: 'installment', amount: 100, amountMode: 'total', totalInstallments: 3 });
  assert.deepEqual(result.items.map(item => item.amount), [33.34, 33.33, 33.33]);
  assert.deepEqual(result.items.map(day), ['2028-01-31', '2028-02-29', '2028-03-31']);
  assert.deepEqual((await list(id)).map(item => item.amount), [33.34, 33.33, 33.33]);
});

test('lote preserva o valor unitário e distribui o saldo do total pela numeração original', async () => {
  const { id } = await profile();
  const result = await batch(id, [
    entry({ description: 'Total da compra', category: 'installment', amount: 100.01, amountMode: 'total',
      currentInstallment: 2, totalInstallments: 3 }),
    entry({ description: 'Valor da parcela', category: 'installment', amount: 33.33,
      currentInstallment: 2, totalInstallments: 3 }),
  ]);
  assert.deepEqual(result.items.map(item => [item.description, item.currentInstallment, item.amount, day(item)]), [
    ['Total da compra', 2, 33.34, '2028-01-31'], ['Total da compra', 3, 33.33, '2028-02-29'],
    ['Valor da parcela', 2, 33.33, '2028-01-31'], ['Valor da parcela', 3, 33.33, '2028-02-29'],
  ]);
});

test('a API rejeita total que deixaria uma parcela sem centavos, inclusive no lote', async () => {
  const { id } = await profile();
  const invalid = entry({ category: 'installment', amount: 0.02, amountMode: 'total', totalInstallments: 3 });
  await expectResponse('POST', '/transactions', { profileId: id, ...invalid }, 400);
  await expectResponse('POST', '/transactions/batch', { profileId: id, transactions: [entry(), invalid] }, 400);
  assert.deepEqual(await list(id), []);
});

test('criação, edição e consulta normalizam decimais no SQLite', async () => {
  const { id } = await profile();
  const result = await create(id, { amount: 1.005 });
  assert.equal(result.amount, 1.01);
  const edited = await expectResponse('PUT', '/transactions/' + result.id, { amount: '2.675' }, 200);
  assert.equal(edited.amount, 2.68);
  await expectResponse('PUT', '/transactions/' + result.id, { amount: 0.004 }, 400);
  for (const amount of [0.004, true, 1e308]) {
    await expectResponse('POST', '/transactions', { profileId: id, ...entry({ amount }) }, 400);
  }
  assert.deepEqual((await list(id)).map(item => item.amount), [2.68]);
});

test('resumo mensal mostra equilíbrio quando R$ 0,10 + R$ 0,20 cobrem R$ 0,30', () => {
  const h = React.createElement;
  const markup = renderToStaticMarkup(h(web.MonthlySummary, { transactions: [
    entry({ type: 'income', amount: 0.1, status: 'paid' }),
    entry({ type: 'income', amount: 0.2, status: 'paid' }),
    entry({ type: 'expense', amount: 0.3, status: 'paid' }),
  ] }));
  assert.equal((markup.match(/Equilíbrio/g) ?? []).length, 2);
});

test('o resumo de perfis devolve o total do SQLite em centavos', async () => {
  const { id } = await profile();
  const now = new Date();
  const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-15';
  await batch(id, [entry({ amount: 0.01, date }), entry({ amount: 0.05, date })]);
  const profiles = await expectResponse('GET', '/profiles', undefined, 200);
  const row = profiles.find(item => item.id === id);
  assert.equal(row.pendingCountCurrentMonth, 2);
  assert.equal(row.pendingAmountCurrentMonth, 0.06);
});

test('o resumo do perfil e o extrato mensal usam o mesmo mês civil para as datas armazenadas', async t => {
  const { id } = await profile();
  process.env.TZ = 'Pacific/Kiritimati';
  t.after(() => { process.env.TZ = 'America/Fortaleza'; });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2028-03-15T12:00:00Z') });
  await create(id, { date: '2028-02-29', amount: 20 });
  await create(id, { date: '2028-03-31', amount: 30 });
  assert.deepEqual((await list(id, '&month=3&year=2028')).map(day), ['2028-03-31']);
  const profiles = await expectResponse('GET', '/profiles', undefined, 200);
  const row = profiles.find(item => item.id === id);
  assert.equal(row.pendingCountCurrentMonth, 1);
  assert.equal(row.pendingAmountCurrentMonth, 30);
});

test('contrato e API rejeitam datas impossíveis, sufixos inválidos e filtros de períodos inválidos', async () => {
  const { id } = await profile();
  for (const date of ['2027-02-29', '2028-02-30', '2028-04-31', '2028-13-01', '2028-00-01',
    '2028-01-00', '2028-1-02', '2028-01-01Tabc', '2028-01-01T25:00:00Z']) {
    const payload = { profileId: id, ...entry({ date }) };
    assert.equal(createTransactionSchema.safeParse(payload).success, false, date);
    await expectResponse('POST', '/transactions', payload, 400);
  }
  for (const query of ['month=2', 'year=2028', 'month=2x&year=2028', 'month=2&year=2028x',
    'startDate=2027-02-29', 'endDate=2028-04-31', 'startDate=2028-02-29&endDate=2028-02-28']) {
    await expectResponse('GET', '/transactions?profileId=' + id + '&' + query, undefined, 400);
  }
  const valid = await create(id, { date: '2028-02-29T23:30:00-03:00' });
  assert.equal(day(valid), '2028-02-29');
  assert.deepEqual((await list(id, '&startDate=2028-02-29&endDate=2028-02-29')).map(day), ['2028-02-29']);
});

test('criação em lote é atômica e vencimento e pagamento inválidos recebem 400 nas rotas de escrita', async () => {
  const { id } = await profile();
  const invalid = entry({ status: 'paid', paymentDate: '2028-02-30' });
  await expectResponse('POST', '/transactions/batch', { profileId: id, transactions: [entry(), invalid] }, 400);
  assert.deepEqual(await list(id), []);
  const row = await create(id, { status: 'paid', paymentDate: '2028-02-29' });
  await expectResponse('PATCH', '/transactions/' + row.id, { date: '2028-04-31' }, 400);
  await expectResponse('PUT', '/transactions/' + row.id, { paymentDate: 'inválida' }, 400);
  await expectResponse('PATCH', '/transactions/' + row.id + '/status', {
    status: 'paid', paymentDate: '2028-04-31',
  }, 400);
  const [stored] = await list(id);
  assert.equal(day(stored), '2028-01-31');
  assert.equal(stored.paymentDate.slice(0, 10), '2028-02-29');
});

test('a parcela atual deve caber no total na criação, importação e edição parcial', async () => {
  const { id } = await profile();
  const data = entry({ category: 'installment', currentInstallment: 4, totalInstallments: 3 });
  assert.equal(createTransactionSchema.safeParse({ profileId: id, ...data }).success, false);
  assert.equal(batchCreateTransactionSchema.safeParse({ profileId: id, transactions: [data] }).success, false);
  await expectResponse('POST', '/transactions', { profileId: id, ...data }, 400);
  await expectResponse('POST', '/transactions/batch', { profileId: id, transactions: [data] }, 400);
  const result = await create(id, { ...data, currentInstallment: 3 });
  await expectResponse('PATCH', '/transactions/' + result.items[0].id, { totalInstallments: 2 }, 400);
  assert.deepEqual((await list(id)).map(item => [item.currentInstallment, item.totalInstallments]), [[3, 3]]);
});

test('os limites de 1 a 120 valem para parcelas e recorrências no contrato e na API', async () => {
  const { id } = await profile();
  for (const count of [0, 1.5, 121, true]) {
    for (const fields of [
      { category: 'installment', totalInstallments: count },
      { category: 'recurring', repeatMonths: count },
    ]) {
      const item = entry(fields);
      assert.equal(createTransactionSchema.safeParse({ profileId: id, ...item }).success, false);
      await expectResponse('POST', '/transactions', { profileId: id, ...item }, 400);
      await expectResponse('POST', '/transactions/batch', { profileId: id, transactions: [item] }, 400);
    }
    await expectResponse('POST', '/transactions/batch', { profileId: id, repeatMonths: count, transactions: [entry()] }, 400);
  }
  assert.equal(batchCreateTransactionSchema.safeParse({ profileId: id, transactions: [] }).success, false);
  assert.equal((await create(id, { category: 'fixed', repeatMonths: 120 })).count, 120);
  assert.equal((await create(id, { category: 'installment', currentInstallment: 120, totalInstallments: 120 })).count, 1);
});

test('criações individual e em lote respeitam a parcela atual, datas, grupo e estado inicial', async () => {
  const { id } = await profile();
  const paid = { status: 'paid', paymentDate: '2028-01-30' };
  const installment = entry({ ...paid, category: 'installment', currentInstallment: 4, totalInstallments: 6 });
  const recurring = entry({ ...paid, category: 'recurring', repeatMonths: 3 });
  function assertSeries(items, installments) {
    assert.equal(new Set(items.map(item => item.groupId)).size, 1);
    assert.ok(items[0].groupId);
    assert.deepEqual(items.map(item => [
      day(item), item.currentInstallment, item.status, item.paymentDate?.slice(0, 10) ?? null,
    ]), [
      ['2028-01-31', installments ? 4 : null, 'paid', '2028-01-30'],
      ['2028-02-29', installments ? 5 : null, 'pending', null],
      ['2028-03-31', installments ? 6 : null, 'pending', null],
    ]);
  }
  assertSeries((await create(id, installment)).items, true);
  assertSeries((await create(id, recurring)).items, false);
  const grouped = await batch(id, [installment, { ...recurring, repeatMonths: 2 }, entry()], 3);
  assert.equal(grouped.totalCreated, 7);
  assertSeries(grouped.items.slice(0, 3), true);
  assertSeries(grouped.items.slice(3, 6), false);
  assert.notEqual(grouped.items[0].groupId, grouped.items[3].groupId);
  assert.equal((await create(id, { category: 'fixed' })).count, 12);
  assert.equal((await batch(id, [entry({ category: 'fixed' })])).totalCreated, 1);
});

test('lote com uma única parcela mantém a numeração padrão 1/1', async () => {
  const { id } = await profile();
  const item = entry({ category: 'installment' });
  const individual = (await create(id, item)).items[0];
  const imported = (await batch(id, [item])).items[0];
  assert.deepEqual([imported.currentInstallment, imported.totalInstallments],
    [individual.currentInstallment, individual.totalInstallments]);
});

test('projeções que ultrapassam o ano civil de quatro dígitos são rejeitadas', async () => {
  const { id } = await profile();
  const item = entry({ date: '9999-12-31', category: 'recurring' });
  await expectResponse('POST', '/transactions', { ...item, profileId: id, repeatMonths: 2 }, 400);
  await expectResponse('POST', '/transactions/batch', { profileId: id, repeatMonths: 2, transactions: [item] }, 400);
  assert.deepEqual(await list(id), []);
});

test('o vencimento e os filtros mantêm o dia civil entre UTC, UTC-12 e Fortaleza', async t => {
  const { id } = await profile();
  process.env.TZ = 'Etc/GMT+12';
  const created = await create(id, { date: '2028-02-29', description: 'Vence em fevereiro' });
  process.env.TZ = 'UTC';
  const february = await list(id, '&month=2&year=2028');
  process.env.TZ = 'America/Fortaleza';
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2028-03-01T00:30:00Z') });
  const h = React.createElement;
  // O relógio está em março no UTC, mas ainda é 29/02 no navegador.
  const consoleError = console.error;
  t.mock.method(console, 'error', (...args) => {
    if (!String(args[0]).startsWith('Warning: useLayoutEffect does nothing on the server')) consoleError(...args);
  });
  const markup = renderToStaticMarkup(h(web.ProfileContext.Provider, { value: { activeProfile: null } },
    h(web.TransactionContext.Provider, { value: {
      transactions: [created, entry({ id: 'ontem', description: 'Venceu ontem', date: '2028-02-28' }),
        entry({ id: 'pago', description: 'Já pago', date: '2028-02-28', status: 'paid' })],
      selectedMonth: 2, selectedYear: 2028, hasMonthData: true, pendingRows: new Map(),
    } }, h(web.Dashboard, { entryNotice: '' }))));
  assert.equal(day(created), '2028-02-29');
  assert.match(markup, /29\/02\/2028/);
  assert.match(markup, /aria-label="Pendente — Marcar como pago — Vence em fevereiro"/);
  assert.match(markup, /aria-label="Vencido — Marcar como pago — Venceu ontem"/);
  assert.match(markup, /aria-label="Pago — Marcar como pendente — Já pago"/);
  assert.deepEqual(february.map(day), ['2028-02-29']);
});

test('marcar como pago novamente preserva uma data de pagamento existente', async () => {
  const { id } = await profile();
  const row = await create(id, { status: 'paid', paymentDate: '2028-02-29' });
  const replay = await expectResponse('PATCH', '/transactions/' + row.id + '/status', { status: 'paid' }, 200);
  assert.equal(replay.paymentDate, row.paymentDate);
});

test('exclusão individual preserva anteriores, futuros e outro perfil na mesma série', async () => {
  const { id } = await profile();
  const other = await profile();
  const series = { groupId: 'mesmo-grupo-individual', category: 'installment', totalInstallments: 3 };
  const { items } = await create(id, series);
  await create(other.id, series);
  await expectResponse('DELETE', '/transactions/' + items[1].id, undefined, 200);
  assert.deepEqual((await list(id)).map(item => item.currentInstallment), [1, 3]);
  assert.deepEqual((await list(other.id)).map(item => item.currentInstallment), [1, 2, 3]);
});

for (const category of ['installment', 'recurring']) {
  test('exclusão a partir da seleção preserva anteriores e outro perfil na série ' + category, async () => {
    const { id } = await profile();
    const other = await profile();
    const series = { groupId: 'mesmo-grupo-' + category, category, totalInstallments: 3, repeatMonths: 3 };
    const { items } = await create(id, series);
    await create(other.id, series);
    const result = await expectResponse('DELETE', '/transactions/' + items[1].id + '?deleteAll=true', undefined, 200);
    assert.deepEqual((await list(id)).map(day), ['2028-01-31']);
    assert.deepEqual((await list(other.id)).map(day), ['2028-01-31', '2028-02-29', '2028-03-31']);
    assert.equal(result.deletedCount, 2);
  });
}

test('exclusão de recorrência inclui o mesmo dia civil e mantém registros legados anteriores', async () => {
  const { id } = await profile();
  const data = { profileId: id, ...entry({ category: 'recurring', groupId: 'serie-legada' }) };
  await prisma.transaction.createMany({ data: [
    { ...data, date: new Date('2028-02-28T15:00:00Z') },
    { ...data, date: new Date('2028-02-29T12:00:00Z') },
    { ...data, date: new Date('2028-02-29T15:00:00Z') },
    { ...data, date: new Date('2028-03-31T15:00:00Z') },
  ] });
  const rows = await list(id, '&month=2&year=2028');
  assert.deepEqual(rows.map(day), ['2028-02-28', '2028-02-29', '2028-02-29']);
  const result = await expectResponse('DELETE', '/transactions/' + rows[2].id + '?deleteAll=true', undefined, 200);
  assert.equal(result.deletedCount, 3);
  assert.deepEqual((await list(id)).map(day), ['2028-02-28']);
});

test('compromissos de uma série incompleta seguem as parcelas cadastradas e os vencimentos editados', async () => {
  const { id } = await profile();
  const { items, groupId } = await create(id, {
    category: 'installment', date: '2027-12-31', currentInstallment: 4, totalInstallments: 8,
  });
  await expectResponse('DELETE', '/transactions/' + items[1].id, undefined, 200);
  await expectResponse('PUT', '/transactions/' + items[2].id, {
    date: '2027-12-20', amount: 35.27, description: 'Parcela antecipada',
  }, 200);
  await expectResponse('PUT', '/transactions/' + items[3].id, { date: '2028-02-15', amount: 25.19 }, 200);
  await expectResponse('PUT', '/transactions/' + items[4].id, { category: 'recurring', amount: 14 }, 200);

  const rows = await list(id, '&type=expense&startDate=2027-12-01');
  const december = web.summarizeCommitments(rows, id, '2027-12');
  assert.deepEqual(december.commitments.map(tx => [tx.id, tx.currentInstallment, tx.totalInstallments]), [
    [items[2].id, 6, 8], [items[0].id, 4, 8],
  ]);
  assert.equal(december.commitments[0].description, 'Parcela antecipada');
  assert.equal(december.plannedCents, 4761n);
  assert.deepEqual(december.laterBySeries.get(groupId), { count: 1, cents: 2519n });
  const january = web.summarizeCommitments(rows, id, '2028-01');
  assert.deepEqual(january.commitments, []);
  assert.equal(january.nextMonth, '2028-02');
  const april = web.summarizeCommitments(rows, id, '2028-04');
  assert.deepEqual(april.openByCategory, { fixed: 0n, recurring: 1400n, installment: 0n });
});

test('parcelas pagas aparecem no mês previsto e ficam fora dos valores em aberto e restantes', async () => {
  const { id } = await profile();
  const { items, groupId } = await create(id, {
    category: 'installment', date: '2027-12-31', totalInstallments: 3, status: 'paid', amount: 10.11,
  });
  await expectResponse('PATCH', '/transactions/' + items[1].id + '/status', { status: 'paid' }, 200);
  await expectResponse('PATCH', '/transactions/' + items[2].id + '/status', { status: 'overdue' }, 200);
  await create(id, { category: 'fixed', date: '2027-12-05', amount: 20.12, repeatMonths: 1 });
  await create(id, { category: 'recurring', date: '2027-12-06', amount: 30.13, repeatMonths: 1 });

  const rows = await list(id, '&type=expense&startDate=2027-12-01');
  const december = web.summarizeCommitments(rows, id, '2027-12');
  assert.equal(december.plannedCents, 6036n);
  assert.equal(december.paidCents, 1011n);
  assert.deepEqual(december.openByCategory, { fixed: 2012n, recurring: 3013n, installment: 0n });
  assert.equal(december.commitments.find(tx => tx.id === items[0].id).status, 'paid');
  assert.deepEqual(december.laterBySeries.get(groupId), { count: 1, cents: 1011n });

  const january = web.summarizeCommitments(rows, id, '2028-01');
  assert.equal(january.plannedCents - january.paidCents, 0n);
  assert.equal(january.commitments[0].id, items[1].id);
});

test('compromissos avançam de dezembro para janeiro e isolam perfil, período e categoria', async () => {
  const { id } = await profile();
  const other = await profile();
  const series = { category: 'installment', date: '2027-12-31', groupId: 'grupo-compartilhado', totalInstallments: 2 };
  const { items } = await create(id, series);
  await create(other.id, { ...series, amount: 120 });
  await create(id, { category: 'fixed', type: 'income', date: '2028-01-05', repeatMonths: 1 });
  await create(id, { category: 'daily', date: '2028-01-03' });

  const december = web.firstFutureMonth(new Date(2027, 10, 30));
  const january = web.shiftMonth(december, 1);
  assert.equal(december, '2027-12');
  assert.equal(january, web.firstFutureMonth(new Date(2027, 11, 31)));
  assert.equal(web.monthLabel(january), 'Janeiro de 2028');
  assert.equal(web.shiftMonth(january, -1), december);

  const rows = await list(id, '&type=expense&startDate=' + january + '-01');
  assert.ok(rows.every(tx => day(tx).startsWith('2028-01') && tx.type === 'expense' && tx.profileId === id));
  const summary = web.summarizeCommitments([...rows, ...await list(other.id)], id, january);
  assert.deepEqual(summary.commitments.map(tx => tx.id), [items[1].id]);
  assert.equal(summary.plannedCents, 1234n);
  assert.equal(summary.laterBySeries.size, 0);
});

test('totais de compromissos preservam o centavo quando a soma supera a precisão de Number', () => {
  const row = { profileId: 'perfil', type: 'expense', category: 'fixed', date: '2028-01-15', description: 'Fixa' };
  const rows = [
    { ...row, id: '1', status: 'paid', amount: 50000000000000 },
    { ...row, id: '2', status: 'paid', amount: 50000000000000 },
    { ...row, id: '3', status: 'pending', amount: 0.01 },
  ];
  const { plannedCents, paidCents } = web.summarizeCommitments(rows, 'perfil', '2028-01');
  assert.equal(plannedCents - paidCents, 1n);
  assert.equal(web.formatCurrencyCents(plannedCents).replace(/\s/g, ' '), 'R$ 100.000.000.000.000,01');
});
