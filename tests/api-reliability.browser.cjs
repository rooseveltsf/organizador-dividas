const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { existsSync } = require('node:fs');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { temporarySqlite } = require('./temporary-sqlite.cjs');

const webRoot = resolve(__dirname, '../apps/web');
const browserPath = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(path => path && existsSync(path));

async function waitFor(check, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const value = await check();
    if (value) return value;
    await delay(40);
  }
  assert.fail('Tempo esgotado aguardando ' + label);
}

async function browserPage(t) {
  assert.ok(browserPath, 'Defina BROWSER_PATH com o caminho de um navegador Chromium.');
  const directory = await mkdtemp(join(tmpdir(), 'organizador-browser-'));
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
    '--user-data-dir=' + directory, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  t.after(async () => {
    if (browser.pid && browser.exitCode === null && browser.signalCode === null) {
      const exited = once(browser, 'exit');
      browser.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  const port = await waitFor(async () => {
    if (browser.exitCode !== null) assert.fail('O navegador encerrou com código ' + browser.exitCode);
    const file = await readFile(join(directory, 'DevToolsActivePort'), 'utf8').catch(() => '');
    return file.split('\n')[0];
  }, 'a porta de depuração do navegador');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  t.after(() => socket.close());
  await once(socket, 'open');

  let nextId = 0;
  const requests = new Map();
  socket.addEventListener('message', event => {
    const { id, result, error } = JSON.parse(event.data);
    if (!requests.has(id)) return;
    const { resolve, reject } = requests.get(id);
    requests.delete(id);
    if (error) reject(new Error(error.message));
    else resolve(result);
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      requests.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
  return { send, evaluate };
}

const profiles = ['Alfa', 'Beta'].map(name => ({
  id: name.toLowerCase(), name, avatarInitials: name.slice(0, 2),
  primaryColor: '#3b82f6', secondaryColor: '#8b5cf6',
  hasPin: false,
}));

function openMockProfile(path) {
  return profiles.find(profile => path === '/api/profiles/' + profile.id + '/session');
}

function transaction(query, id, description, status = 'pending') {
  const month = query.get('month').padStart(2, '0');
  return {
    id, description, status, profileId: query.get('profileId'),
    date: query.get('year') + '-' + month + '-07', type: 'expense', category: 'daily', amount: 10,
  };
}

async function previewWeb(t, api) {
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(() => {
    api.close();
    api.closeAllConnections();
  });
  const { preview } = await import('vite');
  const oldTarget = process.env.API_PROXY_TARGET;
  process.env.API_PROXY_TARGET = 'http://127.0.0.1:' + api.address().port;
  try {
    const web = await preview({ root: webRoot, preview: { host: '127.0.0.1', port: 0 } });
    t.after(() => {
      web.httpServer.close();
      web.httpServer.closeAllConnections();
    });
    return 'http://127.0.0.1:' + web.httpServer.address().port;
  } finally {
    if (oldTarget === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = oldTarget;
  }
}

test('recuperação de falhas, troca de período e gravações simultâneas no navegador', { timeout: 45000 }, async t => {
  const pending = [];
  let profilesAvailable = false;
  const api = createServer((request, response) => {
    request.resume();
    const url = new URL(request.url, 'http://localhost');
    const respond = (data, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(status < 400 ? { success: true, data } : { success: false }));
    };
    if (request.method === 'GET' && url.pathname === '/api/profiles') {
      respond(profiles, profilesAvailable ? 200 : 503);
    } else if (request.method === 'GET' && openMockProfile(url.pathname)) {
      respond({ profile: openMockProfile(url.pathname) });
    } else {
      pending.push({ method: request.method, url, respond });
    }
  });
  const webUrl = await previewWeb(t, api);

  const { send, evaluate } = await browserPage(t);
  await send('Page.enable');
  // Deixa o servidor concluir as consultas obsoletas para testar também a
  // proteção contra respostas antigas quando o cancelamento não é respeitado.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = window.fetch.bind(window);
    window.cancelledLoads = 0;
    window.staleResponses = 0;
    window.fetch = (url, options) => {
      if (options?.signal && String(url).startsWith('/api/transactions?')) {
        options.signal.addEventListener('abort', () => window.cancelledLoads++);
        const { signal, ...rest } = options;
        return originalFetch(url, rest).then(response => {
          const read = response.json.bind(response);
          response.json = async () => {
            const data = await read();
            if (signal.aborted) requestAnimationFrame(() => window.staleResponses++);
            return data;
          };
          return response;
        });
      }
      return originalFetch(url, options);
    };
  ` });
  await send('Page.navigate', { url: webUrl });
  const button = label => `[...document.querySelectorAll('button')].find(button =>
    button.getAttribute('aria-label') === ${JSON.stringify(label)} ||
    button.textContent.trim() === ${JSON.stringify(label)})`;
  const click = async label => {
    await waitFor(() => evaluate('Boolean(' + button(label) + ')'), label);
    await evaluate(button(label) + '.click()');
  };
  const visible = text => waitFor(() => evaluate('document.body.innerText.includes(' + JSON.stringify(text) + ')'), text);
  const absent = async text => assert.equal(await evaluate('document.body.innerText.includes(' + JSON.stringify(text) + ')'), false, text);
  const retry = async () => {
    const label = await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.startsWith("Tentar carregar ")).textContent');
    await click(label);
  };
  const take = (method, path, profile) => waitFor(() => {
    const index = pending.findIndex(request => request.method === method && request.url.pathname === '/api' + path
      && (!profile || request.url.searchParams.get('profileId') === profile));
    return index >= 0 && pending.splice(index, 1)[0];
  }, method + ' ' + path);

  await visible('Não foi possível carregar a lista de perfis.');
  assert.equal(await evaluate('window.staleResponses'), 0);
  await absent('Seu primeiro');
  profilesAvailable = true;
  await click('Tentar carregar os perfis novamente');
  await click('Entrar no perfil Alfa');
  const failed = await take('GET', '/transactions', 'alfa');
  failed.respond(undefined, 503);
  await visible('Não foi possível carregar os lançamentos deste mês.');
  await absent('Nenhum lançamento em');
  await retry();
  (await take('GET', '/transactions', 'alfa')).respond([]);
  await visible('Nenhum lançamento em');

  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*/api/transactions?*'] });
  await click('Mês anterior');
  await visible('Não foi possível carregar os lançamentos deste mês.');
  await absent('Nenhum lançamento em');
  await send('Network.setBlockedURLs', { urls: [] });
  await retry();
  (await take('GET', '/transactions', 'alfa')).respond([]);
  await visible('Nenhum lançamento em');

  await click('Próximo mês');
  const oldMonth = await take('GET', '/transactions', 'alfa');
  await click('Próximo mês');
  const newMonth = await take('GET', '/transactions', 'alfa');
  newMonth.respond([transaction(newMonth.url.searchParams, 'new-month', 'Consulta mais recente')]);
  await visible('Consulta mais recente');
  oldMonth.respond([transaction(oldMonth.url.searchParams, 'old-month', 'Consulta obsoleta')]);
  await waitFor(() => evaluate('window.cancelledLoads >= 1'), 'o cancelamento após a troca de mês');
  await waitFor(() => evaluate('window.staleResponses >= 1'), 'a resposta obsoleta do mês');
  await visible('Consulta mais recente');
  await absent('Consulta obsoleta');

  await click('Mês anterior');
  const oldProfile = await take('GET', '/transactions', 'alfa');
  await click('Trocar perfil');
  await click('Entrar no perfil Beta');
  const beta = await take('GET', '/transactions', 'beta');
  const first = transaction(beta.url.searchParams, 'first', 'Primeiro registro');
  const second = transaction(beta.url.searchParams, 'second', 'Segundo registro');
  beta.respond([first, second]);
  oldProfile.respond([transaction(oldProfile.url.searchParams, 'old-profile', 'Lançamento de Alfa')]);
  await visible('Primeiro registro');
  await waitFor(() => evaluate('window.staleResponses >= 2'), 'a resposta obsoleta do perfil');
  await absent('Lançamento de Alfa');

  const unsettled = ' — Marcar como pago — ';
  const firstButton = await evaluate('[...document.querySelectorAll(".settle-button")][0].ariaLabel');
  const secondButton = await evaluate('[...document.querySelectorAll(".settle-button")][1].ariaLabel');
  assert.ok(firstButton.includes(unsettled) && secondButton.includes(unsettled));
  await click(firstButton);
  const firstWrite = await take('PATCH', '/transactions/first/status');
  assert.equal(await evaluate(button(firstButton) + '.getAttribute("aria-disabled")'), 'true');
  assert.equal(await evaluate(button(secondButton) + '.hasAttribute("aria-disabled")'), false);
  await click(secondButton);
  const secondWrite = await take('PATCH', '/transactions/second/status');
  firstWrite.respond({ ...first, status: 'paid' });
  const firstRefresh = await take('GET', '/transactions', 'beta');
  await visible('Primeiro registro');
  await visible('Segundo registro');
  secondWrite.respond({ ...second, status: 'paid' });
  const secondRefresh = await take('GET', '/transactions', 'beta');
  secondRefresh.respond([{ ...first, status: 'paid' }, { ...second, status: 'paid' }]);
  firstRefresh.respond([{ ...first, status: 'paid' }, second]);
  await waitFor(() => evaluate('window.staleResponses >= 3'), 'a atualização obsoleta do extrato');
  await waitFor(() => evaluate('document.querySelectorAll(".settle-button.paid").length === 2'), 'os dois status salvos');

  const paidSecond = 'Pago — Marcar como pendente — Segundo registro';
  await click(paidSecond);
  (await take('PATCH', '/transactions/second/status')).respond(undefined, 503);
  await visible('Não foi possível alterar a situação de “Segundo registro”.');
  await click('Editar Primeiro registro');
  await click('Salvar alterações');
  (await take('PUT', '/transactions/first')).respond(undefined, 503);
  await visible('Não foi possível salvar as alterações.');
  await click('Cancelar');

  await click('Excluir Primeiro registro');
  await click('Excluir Transação');
  (await take('DELETE', '/transactions/first')).respond(undefined, 503);
  await visible('Falha ao excluir o lançamento.');
  await click('Excluir Transação');
  (await take('DELETE', '/transactions/first')).respond(first);
  (await take('GET', '/transactions', 'beta')).respond(undefined, 503);
  await visible('Mostrando os últimos dados carregados.');
  await visible('Lançamento excluído');
  await retry();
  (await take('GET', '/transactions', 'beta')).respond([{ ...second, status: 'paid' }]);
  await waitFor(() => evaluate('document.querySelectorAll(".ledger-row").length === 1'), 'o extrato sincronizado');
  await absent('Mostrando os últimos dados carregados.');

  await click(paidSecond);
  const delayedWrite = await take('PATCH', '/transactions/second/status');
  await click('Trocar perfil');
  await click('Entrar no perfil Alfa');
  (await take('GET', '/transactions', 'alfa')).respond([]);
  await visible('Nenhum lançamento em');
  await absent('Segundo registro');
  await click('Trocar perfil');
  await click('Entrar no perfil Beta');
  (await take('GET', '/transactions', 'beta')).respond([{ ...second, status: 'paid' }]);
  await visible('Segundo registro');
  assert.equal(await evaluate(button(paidSecond) + '.getAttribute("aria-disabled")'), 'true');
  delayedWrite.respond(second);
  (await take('GET', '/transactions', 'beta')).respond([second]);
  await waitFor(() => evaluate(`document.querySelector('.settle-button')?.ariaLabel.includes('Marcar como pago')
    && !document.querySelector('.settle-button').hasAttribute('aria-busy')`), 'o status após retornar ao perfil');
});

test('compromissos futuros no celular preservam o mês ao trocar de perfil e localizam a parcela no extrato', { timeout: 45000 }, async t => {
  const series = { description: 'Notebook', category: 'installment', groupId: 'compra', totalInstallments: 7 };
  const rows = [
    { ...series, id: 'dec-installment', date: '2027-12-31', currentInstallment: 3, amount: 80, status: 'paid' },
    { ...series, id: 'jan-installment', date: '2028-01-31', currentInstallment: 5, amount: 100.22 },
    { description: 'Notebook', category: 'recurring', id: 'jan-recurring', date: '2028-01-10', amount: 32.5 },
    { description: 'Parcela avulsa', category: 'installment', id: 'apr-standalone', date: '2028-04-02', amount: 89 },
  ].map(row => ({ type: 'expense', profileId: 'alfa', status: 'pending', ...row }));
  const futureQueries = [];
  const api = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const query = url.searchParams;
    const respond = (data, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false }));
    };
    if (url.pathname === '/api/profiles') return respond(profiles);
    if (openMockProfile(url.pathname)) return respond({ profile: openMockProfile(url.pathname) });
    const profileRows = rows.filter(row => row.profileId === query.get('profileId'));
    if (query.has('startDate')) {
      futureQueries.push(Object.fromEntries(query));
      if (futureQueries.length === 1) return respond(undefined, 503);
      return respond(profileRows.filter(row => row.date >= query.get('startDate')));
    }
    const month = query.get('year') + '-' + query.get('month').padStart(2, '0');
    return respond(profileRows.filter(row => row.date.startsWith(month)));
  });
  const webUrl = await previewWeb(t, api);

  const { send, evaluate } = await browserPage(t);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Fortaleza' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const actualDate = window.Date;
    window.Date = class extends actualDate {
      constructor(...args) { super(...(args.length ? args : ['2027-11-25T12:00:00Z'])); }
      static now() { return actualDate.parse('2027-11-25T12:00:00Z'); }
    };
  ` });
  await send('Page.navigate', { url: webUrl });

  const visible = text => waitFor(() => evaluate('document.body.innerText.includes(' + JSON.stringify(text) + ')'), text);
  const click = async label => {
    const button = `[...document.querySelectorAll('button')].find(button =>
      button.ariaLabel === ${JSON.stringify(label)} || button.textContent.trim() === ${JSON.stringify(label)})`;
    await waitFor(() => evaluate('Boolean(' + button + ')'), label);
    await evaluate(button + '.click()');
  };
  const pickProfile = id => evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Perfil"]');
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);

  await click('Entrar no perfil Alfa');
  await click('Compromissos futuros');
  await visible('Não foi possível carregar os compromissos deste perfil.');
  await click('Tentar novamente');
  await visible('Dezembro de 2027');
  await visible('Parcela 3 de 7');
  await visible('1 parcela cadastrada em aberto após este mês');
  assert.equal(await evaluate(`document.querySelector('.commitment-amount .paid').textContent`), 'Paga');
  assert.deepEqual(futureQueries[1], { profileId: 'alfa', type: 'expense', startDate: '2027-12-01' });

  await click('Próximo mês');
  await visible('Janeiro de 2028');
  await visible('Parcela 5 de 7');
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 320);
  await pickProfile('beta');
  await visible('Nenhum compromisso cadastrado neste mês');
  assert.equal(await evaluate(`document.querySelector('#commitments-period').textContent`), 'Janeiro de 2028');
  assert.equal(futureQueries.at(-1).profileId, 'beta');
  await pickProfile('alfa');
  await visible('Parcela 5 de 7');
  await evaluate(`document.querySelectorAll('.commitment-row button')[1].click()`);
  await waitFor(() => evaluate(`document.activeElement.matches('.ledger-row')
    && document.activeElement.textContent.includes('Parcela 5/7')`), 'o foco no lançamento correspondente');

  await click('Compromissos futuros');
  await visible('Parcela 5 de 7');
  await click('Próximo mês');
  await visible('Fevereiro de 2028');
  await click('Ver Abril de 2028');
  await visible('Sem vínculo com uma série');
});

test('simulação mensal destaca o déficit, recalcula as parcelas e abre evidências no Extrato', { timeout: 45000 }, async t => {
  const rows = [650, 850, 400].flatMap((amount, index) => {
    const date = '2028-0' + (index + 1) + '-05';
    const status = index === 0 ? 'paid' : 'pending';
    return [{ id: `income-${index}`, description: 'Receita', type: 'income', amount: 1000, date, status },
      { id: `expense-${index}`, description: 'Despesa', type: 'expense', amount, date, status }];
  }).map(row => ({ ...row, profileId: 'alfa', category: 'daily' }));
  rows.push(...[
    { id: 'rent-1', description: 'Aluguel', date: '2028-01-31', category: 'fixed', groupId: 'aluguel', amount: 100 },
    { id: 'rent-2', description: 'Aluguel', date: '2028-02-29', category: 'fixed', groupId: 'aluguel', amount: 100 },
    { id: 'loan-1', date: '2028-01-05', currentInstallment: 1, status: 'paid', paymentDate: '2028-01-05' },
    { id: 'loan-2', date: '2028-02-21', currentInstallment: 2 },
  ].map(row => ({ profileId: 'beta', type: 'expense', status: 'pending', description: 'Financiamento',
    groupId: 'dívida', category: 'installment', totalInstallments: 2, amount: 600, ...row })));
  const reads = [];
  const api = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const json = data => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, data }));
    };
    if (url.pathname === '/api/profiles') return json(profiles);
    if (openMockProfile(url.pathname)) return json({ profile: openMockProfile(url.pathname) });
    if (url.pathname === '/api/transactions') {
      const { searchParams: query } = url;
      reads.push({ method: request.method, query: Object.fromEntries(query) });
      const matches = rows.filter(row => row.profileId === query.get('profileId'));
      if (!query.has('month')) return json(matches);
      const month = query.get('year') + '-' + query.get('month').padStart(2, '0');
      return json(matches.filter(row => row.date.startsWith(month)));
    }
    response.writeHead(404).end();
  });
  const webUrl = await previewWeb(t, api);
  const { send, evaluate } = await browserPage(t);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Fortaleza' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const actualDate = window.Date;
    window.Date = class extends actualDate {
      constructor(...args) { super(...(args.length ? args : ['2028-01-15T12:00:00Z'])); }
      static now() { return actualDate.parse('2028-01-15T12:00:00Z'); }
    };
  }` });
  await send('Page.navigate', { url: webUrl });
  const click = async label => {
    const button = `[...document.querySelectorAll('button')].find(button =>
      (button.ariaLabel === ${JSON.stringify(label)} || button.textContent.trim() === ${JSON.stringify(label)}) && !button.disabled)`;
    await waitFor(() => evaluate('Boolean(' + button + ')'), label);
    await evaluate(button + '.click()');
  };
  const input = (name, value) => evaluate(`(() => {
    const element = document.querySelector('.purchase-form').elements.namedItem(${JSON.stringify(name)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const select = (selector, value) => evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    element.value = ${JSON.stringify(value)};
    element.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const monthValues = month => evaluate(`Array.from(document.querySelectorAll('[data-month="${month}"] td'), item => item.textContent)`);

  await click('Entrar no perfil Alfa');
  await click('Simular compra');
  assert.equal(await evaluate(`document.querySelector('[name="paymentDate"]').value`), '2028-01-15');
  await select('select[name="payment"]', 'installments');
  await input('count', '6');
  await input('firstDue', '2028-01-31');
  await input('total', '1200');
  await waitFor(() => evaluate(`Boolean(document.querySelector('.purchase-highlight'))`), 'projeção mensal');
  assert.match((await monthValues('2028-01')).at(-1), /150,00/);
  assert.match((await monthValues('2028-02')).at(-1), /-.*50,00/);
  assert.match((await monthValues('2028-03')).at(-1), /400,00/);
  assert.match((await monthValues('2028-06'))[2], /200,00.*30\/06\/2028/);
  const highlight = () => evaluate(`document.querySelector('.purchase-highlight').textContent`);
  assert.match(await highlight(), /Mês mais apertado · Fevereiro de 2028.*Faltariam R\$\s*50,00/);
  assert.match(await highlight(), /Análise incompleta/);
  assert.match(await evaluate(`document.querySelector('.purchase-settled').textContent`), /Recebido R\$\s*1\.000,00Pago R\$\s*650,00/);
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 320);

  await input('count', '4');
  assert.match((await monthValues('2028-01'))[2], /300,00/);
  await input('firstDue', '2028-02-29');
  assert.match((await monthValues('2028-02'))[2], /300,00.*29\/02\/2028/);
  assert.match((await monthValues('2028-03'))[2], /29\/03\/2028/);
  await input('margin', '350');
  assert.match((await monthValues('2028-03')).at(-1), /Abaixo da margem/);

  await select('select[aria-label="Perfil"]', 'beta');
  await waitFor(() => reads.some(({ query }) => query.profileId === 'beta' && !query.month), 'consulta de simulação para Beta');
  assert.equal(await evaluate(`document.querySelector('input[name="total"]').value`), '');
  assert.deepEqual(await monthValues('2028-01'), []);
  assert.deepEqual(reads.filter(({ query }) => !query.month), [
    { method: 'GET', query: { profileId: 'alfa' } }, { method: 'GET', query: { profileId: 'beta' } },
  ]);

  await input('total', '100');
  await waitFor(() => evaluate(`Boolean(document.querySelector('.purchase-series'))`), 'explicações de Beta');
  assert.match((await monthValues('2028-01'))[2], /100,00.*15\/01\/2028/);
  const seriesText = () => evaluate(`document.querySelector('.purchase-series').innerText`);
  assert.match(await seriesText(), /Última parcela identificada \(2\/2\)/);
  assert.match(await seriesText(), /Fim previsto em 21\/02\/2028/);
  assert.match(await seriesText(), /A partir de Março de 2028/);
  assert.match(await seriesText(), /A projeção cadastrada acabou/);

  await evaluate(`document.querySelectorAll('.purchase-form details').forEach(details => details.open = true)`);
  await select('select[aria-label="Premissa na simulação · Aluguel"]', 'continue');
  assert.match((await monthValues('2028-03'))[1], /100,00 de premissas/);
  assert.match(await seriesText(), /Continuidade assumida/);

  await select('select[aria-label="Premissa na simulação · Aluguel"]', 'end');
  await evaluate(`(() => {
    const element = document.querySelector('input[aria-label="Data de fim · Aluguel"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '2028-02-29');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.match(await seriesText(), /Fim confirmado para 29\/02\/2028/);
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 320);
  await evaluate(`[...document.querySelectorAll('.purchase-series details')].find(details => details.textContent.includes('dívida')).open = true`);
  await click('Ver no extrato · Financiamento · 21/02/2028 · parcela 2');
  await waitFor(() => evaluate(`document.activeElement.matches('.ledger-row')
    && document.activeElement.textContent.includes('Financiamento')`), 'parcela da simulação no Extrato');
});

test('PIN no navegador isola trocas rápidas, restauração, expiração e bloqueio com SQLite temporário', { timeout: 45000 }, async t => {
  let cleanDatabase, prisma;
  t.after(async () => {
    await prisma?.$disconnect();
    await cleanDatabase?.();
  });
  process.env.DATABASE_URL = await temporarySqlite(cleanup => { cleanDatabase = cleanup; });
  process.env.PROFILE_PIN_SECRET = randomBytes(32).toString('hex');
  ({ prisma } = require('../apps/api/dist/prisma'));
  const { hashPin } = require('../apps/api/dist/profileAccess');
  await prisma.profile.createMany({
    data: [{ ...profiles[0], pinHash: await hashPin('0007') }, profiles[1]].map(({ hasPin, ...record }) => record),
  });
  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 7));
  const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 7));
  const rows = [
    ['alfa', 'Lançamento privado de Alfa', thisMonth],
    ['beta', 'Lançamento público de Beta', thisMonth],
    ['alfa', 'Compromisso privado de Alfa', nextMonth],
    ['beta', 'Compromisso público de Beta', nextMonth],
  ];
  await prisma.transaction.createMany({ data: rows.map(([profileId, description, date]) => ({
    profileId, description, date, type: 'expense', category: 'fixed', amount: 15,
  })) });

  const webUrl = await previewWeb(t, createServer(require('../apps/api/dist/app').default));
  const { send, evaluate } = await browserPage(t);
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = fetch.bind(window);
    window.fetch = (url, options) => {
      if (window.holdUnlock && options?.method === 'POST' && String(url).endsWith('/alfa/session')) {
        window.holdUnlock = false;
        return originalFetch(url, options).then(response => new Promise(resolve => {
          window.releaseUnlock = () => resolve(response);
        }));
      }
      if (window.holdPurchase && options?.method === 'POST' && String(url).endsWith('/complete')) {
        window.holdPurchase = false;
        return new Promise(resolve => {
          window.releasePurchase = () => resolve(originalFetch(url, options));
        });
      }
      return originalFetch(url, options);
    };
  ` });
  await send('Page.navigate', { url: webUrl });
  const visible = text => waitFor(() => evaluate('document.body.innerText.includes(' + JSON.stringify(text) + ')'), text);
  const absent = async text => assert.equal(await evaluate('document.body.innerText.includes(' + JSON.stringify(text) + ')'), false, text);
  const click = async label => {
    const button = `[...document.querySelectorAll('button')].find(button =>
      (button.ariaLabel === ${JSON.stringify(label)} || button.textContent.trim() === ${JSON.stringify(label)})
      && button.getClientRects().length)`;
    await waitFor(() => evaluate('Boolean(' + button + ')'), label);
    await evaluate(button + '.click()');
  };
  const pinInputs = (label = 'PIN do perfil') => `[...document.querySelectorAll('dialog[open] fieldset')]
    .find(group => group.querySelector(':scope > legend')?.textContent.trim() === ${JSON.stringify(label)})
    ?.querySelectorAll('input[type="password"]')`;
  const pinValues = () => evaluate(`Array.from(${pinInputs()}, input => input.value)`);
  const focusedDigit = () => evaluate(`Array.from(${pinInputs()}).indexOf(document.activeElement)`);

  async function press(key, windowsVirtualKeyCode, modifiers = 0) {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, windowsVirtualKeyCode, modifiers,
      ...(key === 'Enter' && { text: '\r', unmodifiedText: '\r' }),
    });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode, modifiers });
  }

  async function pastePin(label, value, index = 0) {
    const inputs = pinInputs(label);
    await waitFor(() => evaluate(`(${inputs})?.length === 4`), label);
    await evaluate(`(() => {
      const input = (${inputs})[${index}];
      input.focus();
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', ${JSON.stringify(value)});
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    })()`);
  }

  async function submitPin(pin, index) {
    await pastePin('PIN do perfil', pin, index);
    await click('Desbloquear');
  }

  async function fillText(label, value) {
    const field = `[...document.querySelectorAll('dialog[open] label')].find(label =>
      label.textContent.trim() === ${JSON.stringify(label)})?.control`;
    await waitFor(() => evaluate('Boolean(' + field + ')'), label);
    await evaluate(`(() => { const input = ${field}; input.focus(); input.select(); })()`);
    await send('Input.insertText', { text: value });
  }
  async function reload() {
    await evaluate('window.pinReloadPending = true');
    await send('Page.reload');
    await waitFor(async () => {
      try {
        return await evaluate('!window.pinReloadPending && document.readyState === "complete"');
      } catch {
        return false;
      }
    }, 'uma nova página após recarregar');
  }
  const sessionCount = () => prisma.profileSession.count({ where: { profileId: 'alfa' } });

  await click('Entrar no perfil Alfa');
  await visible('Desbloquear Alfa');
  const digitAttributes = await evaluate(`Array.from(${pinInputs()}, input =>
    [input.type, input.inputMode, input.maxLength, input.required, input.ariaLabel])`);
  assert.deepEqual(digitAttributes, Array.from({ length: 4 }, (_, index) =>
    ['password', 'numeric', 1, true, `Dígito ${index + 1} de 4`]));
  const { nodes } = await send('Accessibility.getFullAXTree');
  assert.ok(nodes.some(node => node.role.value === 'group' && node.name?.value === 'PIN do perfil'));
  assert.equal(await focusedDigit(), 0);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  assert.deepEqual(await evaluate(`Array.from(${pinInputs()}, input =>
    [input.offsetWidth, input.offsetHeight, getComputedStyle(input).textAlign])`),
  Array.from({ length: 4 }, () => [48, 48, 'center']));
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 320);
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Input.insertText', { text: 'x' });
  assert.deepEqual(await pinValues(), ['', '', '', '']);
  await press('Tab', 9);
  assert.equal(await focusedDigit(), 1);
  await press('Tab', 9, 8);
  assert.equal(await focusedDigit(), 0);
  await press('9', 57);
  await send('Input.insertText', { text: '9' });
  assert.deepEqual(await pinValues(), ['9', '9', '', '']);
  assert.equal(await focusedDigit(), 2);
  assert.equal(await evaluate(`document.querySelector('dialog[open] form').checkValidity()`), false);
  await press('Backspace', 8);
  assert.deepEqual(await pinValues(), ['9', '', '', '']);
  assert.equal(await focusedDigit(), 1);
  await press('ArrowLeft', 37);
  assert.equal(await focusedDigit(), 0);
  await send('Input.insertText', { text: '9' });
  assert.equal(await focusedDigit(), 1);
  for (let index = 1; index < 4; index++) await send('Input.insertText', { text: '9' });
  assert.deepEqual(await pinValues(), ['9', '9', '9', '9']);
  await press('Enter', 13);
  await visible('PIN incorreto.');
  assert.ok(await evaluate(`document.querySelector('dialog[open] [role="alert"]').textContent.includes('PIN incorreto')`));
  assert.ok(await evaluate(`Array.from(${pinInputs()}).every(input => input.ariaInvalid === 'true'
    && input.getAttribute('aria-describedby')?.includes(document.querySelector('dialog[open] [role="alert"]').id))`));
  assert.deepEqual(await pinValues(), ['', '', '', '']);
  assert.equal(await focusedDigit(), 0);
  await evaluate('window.holdUnlock = true');
  await pastePin('PIN do perfil', '00 07', 2);
  assert.deepEqual(await pinValues(), ['0', '0', '0', '7']);
  await click('Desbloquear');
  await waitFor(() => evaluate('typeof window.releaseUnlock === "function"'), 'resposta de desbloqueio retida');
  assert.equal(await sessionCount(), 1);
  await click('Cancelar');
  await click('Entrar no perfil Beta');
  await visible('Lançamento público de Beta');
  await evaluate('window.releaseUnlock()');
  await waitFor(async () => await sessionCount() === 0, 'revogação do desbloqueio obsoleto');
  await absent('Lançamento privado de Alfa');

  await click('Compromissos futuros');
  await visible('Compromisso público de Beta');
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Perfil"]');
    select.value = 'alfa';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await visible('Desbloquear Alfa');
  await absent('Compromisso público de Beta');
  await absent('Compromisso privado de Alfa');
  await submitPin('0007');
  await visible('Compromisso privado de Alfa');
  await click('Extrato');
  await visible('Lançamento privado de Alfa');
  await reload();
  await visible('Lançamento privado de Alfa');
  await absent('Desbloquear Alfa');

  await prisma.profileSession.updateMany({ where: { profileId: 'alfa' }, data: { expiresAt: new Date(0) } });
  await reload();
  await visible('A sessão terminou. Digite o PIN para entrar.');
  await absent('Lançamento privado de Alfa');
  await submitPin('0007');
  await visible('Lançamento privado de Alfa');

  await t.test('Lista de compras preenche a Calculadora e integra a compra ao Extrato e aos Compromissos', async () => {
    const name = 'Cadeira de teste';
    const firstDue = nextMonth.toISOString().slice(0, 10);
    const month = firstDue.slice(0, 7);
    async function setField(label, value) {
      const expression = `[...document.querySelectorAll('label')].find(label => label.textContent.trim() === ${JSON.stringify(label)})?.control`;
      await waitFor(() => evaluate(`Boolean(${expression})`), label);
      await evaluate(`(() => {
        const control = ${expression};
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value').set.call(control, ${JSON.stringify(value)});
        control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      })()`);
    }

    await click('Lista de compras');
    await visible('Nenhum item a comprar.');
    await click('Adicionar item');
    await setField('Nome do item', name);
    await setField('Preço estimado (opcional)', '129,99');
    await setField('Forma de pagamento (opcional)', 'installments');
    await setField('Quantidade de parcelas (opcional)', '3');
    await click('Salvar item');
    await visible('Item adicionado à Lista de compras.');
    await click('Abrir na Calculadora');
    await waitFor(() => evaluate(`document.querySelector('input[name="product"]')?.value === ${JSON.stringify(name)}`), 'produto preenchido');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.purchase-fields [name]'), field => field.value)`),
      [name, '129.99', 'installments', '3', '']);
    await setField('Primeiro vencimento', firstDue);
    await visible('Sobra mensal projetada');
    assert.equal(await prisma.transaction.count({ where: { description: name } }), 0);

    await click('Lista de compras');
    await visible(name);
    await click('Marcar como comprado');
    await visible('Confirmar compra');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('dialog[open] label'), label => label.textContent.trim())`),
      ['Primeiro vencimento']);
    await click('Corrigir valor');
    await setField('Valor real da compra (R$)', '100');
    await setField('Primeiro vencimento', firstDue);
    await evaluate(`(() => {
      const confirm = document.querySelector('dialog[open] button[type="submit"]');
      confirm.click();
      confirm.click();
    })()`);
    await visible('Compra registrada no Extrato.');
    assert.equal(await prisma.transaction.count({ where: { description: name } }), 3);
    assert.ok(await evaluate(`document.querySelector('#shopping-bought + ul').textContent.includes('100,00')`));
    await click('Ver no Extrato');
    await visible(name);
    await waitFor(() => evaluate(`document.activeElement.textContent.includes(${JSON.stringify(name)})`), 'foco no lançamento');

    await click('Compromissos futuros');
    await visible(name);
    await click('Simular compra');
    await setField('Valor total da oferta (R$)', '1');
    await visible('Sobra mensal projetada');
    const cells = await evaluate(`Array.from(document.querySelectorAll('tr[data-month="${month}"] td'), cell => cell.textContent)`);
    assert.match(cells[1], /48,34/);
    assert.match(cells[2], /0,00/);
    assert.equal(await evaluate(`document.querySelector('input[name="product"]').value`), '');

    await click('Lista de compras');
    await visible(name);
    await evaluate(`document.querySelector('#shopping-bought + ul button:last-child').click()`);
    await visible('Item arquivado.');
    assert.equal(await prisma.transaction.count({ where: { description: name } }), 3);

    const cashName = 'Caneca de teste';
    await click('Adicionar item');
    await setField('Nome do item', cashName);
    await setField('Preço estimado (opcional)', '25');
    await setField('Forma de pagamento (opcional)', 'cash');
    await setField('Data do pagamento (opcional)', thisMonth.toISOString().slice(0, 10));
    await click('Salvar item');
    await visible(cashName);
    await evaluate('window.holdPurchase = true');
    await click('Marcar como comprado');
    await waitFor(() => evaluate('Boolean(window.releasePurchase)'), 'pedido de compra à vista pendente');
    await click('Extrato');
    await click('Lista de compras');
    await visible('Carregando lista…');
    await evaluate('window.releasePurchase()');
    await waitFor(() => evaluate(`document.querySelector('#shopping-bought + ul')?.textContent.includes(${JSON.stringify(cashName)})`),
      'compra à vista atualizada ao voltar à lista');
    const cashRows = await prisma.transaction.findMany({ where: { description: cashName } });
    assert.equal(cashRows.length, 1);
    assert.equal(cashRows[0].status, 'paid');
    assert.equal(cashRows[0].date.toISOString().slice(0, 10), thisMonth.toISOString().slice(0, 10));
    assert.deepEqual(cashRows[0].paymentDate, cashRows[0].date);
    await click('Extrato');
  });

  await click('Bloquear perfil');
  await visible('Perfil bloqueado.');
  await absent('Lançamento privado de Alfa');
  await waitFor(async () => await sessionCount() === 0, 'revogação pelo cabeçalho');
  await reload();
  await visible('Desbloquear Alfa');
  await absent('Lançamento privado de Alfa');

  await click('Cancelar');
  await click('Criar perfil');
  await fillText('Nome do perfil', 'Gama');
  await evaluate(`document.querySelector('dialog[open] input[type="checkbox"]').click()`);
  await pastePin('Novo PIN', '0007');
  await pastePin('Confirmar novo PIN', '7000');
  await click('Criar e entrar');
  await visible('Os PINs precisam ser iguais.');
  await pastePin('Confirmar novo PIN', '0007');
  await click('Criar e entrar');
  await visible('Perfil Gama criado.');

  await click('Configurações do perfil');
  await pastePin('PIN atual', '0007');
  await pastePin('Novo PIN', '0008');
  await pastePin('Confirmar novo PIN', '0008');
  await click('Salvar PIN');
  await visible('Desbloquear Gama');
  await submitPin('0008');

  await click('Configurações do perfil');
  await click('Remover PIN');
  await pastePin('PIN atual', '0008');
  await click('Confirmar remoção');
  await waitFor(async () => await prisma.profile.count({ where: { name: 'Gama', pinHash: null } }) === 1, 'remoção do PIN');
  await waitFor(() => evaluate(`!document.querySelector('dialog[open]')
    && document.querySelector('.active-profile')?.textContent.includes('Gama')
    && !document.querySelector('button[aria-label="Bloquear perfil"]')`), 'perfil reaberto sem PIN');
  await click('Configurações do perfil');
  await pastePin('Novo PIN', '0123');
  await pastePin('Confirmar novo PIN', '0123');
  await click('Salvar PIN');
  await visible('Desbloquear Gama');
  await submitPin('0123');
  await click('Excluir perfil Gama');
  await pastePin('PIN atual', '0123');
  await click('Sim, excluir perfil');
  await visible('Perfil Gama excluído.');
});
