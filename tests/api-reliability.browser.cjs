const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { existsSync } = require('node:fs');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');

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
}));

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
