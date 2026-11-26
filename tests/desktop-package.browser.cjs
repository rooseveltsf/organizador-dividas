const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');

async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  assert.fail(`Tempo esgotado: ${label}`);
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = event => {
    const response = JSON.parse(event.data);
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.error) request.reject(new Error(response.error.message));
    else request.resolve(response.result);
  };
  socket.onclose = () => {
    for (const request of pending.values()) request.resolve();
    pending.clear();
  };
  return {
    send(method, params) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

function pdf(month, year) {
  const line = (x, y, text) => `BT /F1 11 Tf ${x} ${y} Td (${text}) Tj ET\n`;
  const page = line(40, 760, 'Empresa Ficticia LTDA') + line(40, 740, `Folha Mensal: ${month}/${year}`) +
    line(40, 710, 'Código Descrição') + line(290, 710, 'Referencia') +
    line(370, 710, 'Vencimentos') + line(454, 710, 'Descontos') +
    line(40, 690, '001') + line(80, 690, 'Salario Ficticio') + line(375, 690, '1.234,56') +
    line(40, 650, 'Valor Liquido 1.234,56');
  const stream = data => `<< /Length ${data.length} >>\nstream\n${data}endstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    stream(page),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>',
    stream(line(40, 760, 'Anexo ficticio')),
  ];
  let output = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = output.length;
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  return output + `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.join('')}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${output.length}\n%%EOF\n`;
}

test('executável desktop offline com API, PIN, finanças, PDF, tutorial e reabertura', { timeout: 180000 }, async t => {
  const executable = resolve(process.env.DESKTOP_TEST_EXECUTABLE || 'dist/desktop/win-unpacked/Caderno de Dividas.exe');
  const directory = await mkdtemp(join(tmpdir(), 'Organizador instalação e testes '));
  const profileDir = join(directory, 'Dados com acentuação');
  const children = [];
  const connections = [];
  t.after(async () => {
    for (const connection of connections) connection.close();
    for (const child of children) {
      if (child.exitCode === null && !child.signalCode) child.kill();
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(path|node_.+|electron_.+)$/i.test(key)));
  env.Path = directory;

  function spawnApp(debug) {
    const flags = [`--user-data-dir=${profileDir}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'];
    if (debug) flags.push('--remote-debugging-port=0');
    const child = spawn(executable, flags, { cwd: directory, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    const exited = new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    children.push(child);
    let output = '';
    child.stderr.setEncoding('utf8').on('data', text => { output += text; });
    return { exited, get output() { return output; } };
  }

  async function open() {
    const app = spawnApp(true);
    const debug = await until(() => /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+)\//.exec(app.output)?.[1], 'CDP');
    const address = debug.replace('ws:', 'http:');
    const browser = await connect((await fetch(address + '/json/version').then(r => r.json())).webSocketDebuggerUrl);
    connections.push(browser);
    const target = await until(async () => (await fetch(address + '/json/list').then(r => r.json()))
      .find(page => page.url.startsWith('http://127.0.0.1:')), `interface local (${app.output})`);
    const page = await connect(target.webSocketDebuggerUrl);
    connections.push(page);
    function evaluate(expression) {
      return page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then(result => {
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      });
    }
    await until(() => evaluate(`location.href === ${JSON.stringify(target.url)} && Boolean(document.querySelector('#root'))`), 'interface carregada');
    async function click(label) {
      const node = `[...document.querySelectorAll('button')].find(b =>
        (b.textContent.trim() === ${JSON.stringify(label)} || b.ariaLabel === ${JSON.stringify(label)}) &&
        b.offsetParent && !b.disabled && b.getAttribute('aria-disabled') !== 'true')`;
      await until(() => evaluate(`Boolean(${node})`), label);
      await evaluate(`${node}.click()`);
    }
    const visible = text => until(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text);
    async function pointer(label) {
      const point = await until(() => evaluate(`(() => {
        const button = [...document.querySelectorAll('button')].find(b =>
          b.offsetParent && !b.disabled && b.textContent.trim() === ${JSON.stringify(label)});
        if (!button) return;
        button.scrollIntoView({ block: 'center' });
        const { x, y, width, height } = button.getBoundingClientRect();
        return { x: x + width / 2, y: y + height / 2 };
      })()`), label);
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    }
    async function key(code) {
      const virtual = { Tab: 9, Space: 32 };
      const key = code === 'Space' ? ' ' : code;
      for (const type of ['keyDown', 'keyUp']) {
        await page.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: virtual[code],
          ...(type === 'keyDown' && code === 'Space' ? { text: ' ', unmodifiedText: ' ' } : {}) });
      }
    }
    async function chapter(label) {
      await click('Ver capítulos');
      await until(() => evaluate(`[...document.querySelectorAll('.guide-chapter summary')].some(e => e.textContent === ${JSON.stringify(label)})`), label);
      await evaluate(`[...document.querySelectorAll('.guide-chapter summary')].find(e => e.textContent === ${JSON.stringify(label)}).click()`);
    }
    async function api(path, options = {}) {
      return evaluate(`fetch(${JSON.stringify('/api' + path)}, ${JSON.stringify({ headers: { 'Content-Type': 'application/json' }, ...options })})
        .then(async r => [r.status, await r.json()])`);
    }
    async function selectPdf(path) {
      const { root } = await page.send('DOM.getDocument');
      const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
      await page.send('DOM.setFileInputFiles', { nodeId, files: [path] });
    }
    async function close() {
      page.close();
      await browser.send('Browser.close');
      assert.equal(await app.exited, 0);
      await assert.rejects(fetch(target.url));
    }
    return { target, page, evaluate, click, pointer, key, chapter, visible, api, selectPdf, close };
  }

  const app = await open();
  await app.visible('Boas-vindas ao Caderno de Dívidas');
  assert.equal(await app.evaluate("document.activeElement.tagName"), 'H1');
  await app.pointer('Pular e usar o aplicativo');
  await app.visible('Criar meu perfil');
  assert.deepEqual(await app.evaluate('window.notebookTutorial.read()'), { choice: 'skipped' });
  await app.visible('Caderno de Dívidas');
  assert.equal(await app.evaluate('document.title'), 'Caderno de Dívidas');
  for (const route of ['/api/profiles', '/api/transactions', '/api/payslip/parse', '/profiles', '/transactions', '/payslip/parse']) {
    const response = await fetch(new URL(route, app.target.url), {
      method: route.endsWith('/parse') ? 'POST' : 'GET', headers: { Origin: 'http://example.invalid' },
    });
    assert.equal(response.status, route.startsWith('/api/') ? 403 : 404);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(await app.evaluate('typeof require'), 'undefined');
  assert.equal(await spawnApp(false).exited, 0);
  assert.deepEqual(await app.api('/profiles'), [200, { success: true, data: [] }]);

  const post = value => ({ method: 'POST', body: JSON.stringify(value) });
  const colors = { primaryColor: '#224488', secondaryColor: '#884422' };
  const [, { data: protectedProfile }] = await app.api('/profiles', post({ name: 'Teste com PIN', pin: '0123', pinConfirmation: '0123', ...colors }));
  const [, { data: profile }] = await app.api('/profiles', post({ name: 'Teste aberto', ...colors }));
  const list = '/transactions?profileId=' + profile.id;
  assert.equal((await app.api('/transactions?profileId=' + protectedProfile.id))[0], 401);
  const today = new Date().toISOString().slice(0, 10);
  const [, { data: expense }] = await app.api('/transactions', post({
    profileId: profile.id, type: 'expense', category: 'daily', amount: 12.34, description: 'Despesa fictícia', date: today,
  }));
  const [status, { data: paid }] = await app.api(`/transactions/${expense.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'paid' }),
  });
  assert.equal(status, 200);
  assert.equal(paid.status, 'paid');
  const shop = `/profiles/${profile.id}/shopping-list`;
  const [, { data: item }] = await app.api(shop, post({
    name: 'Compra fictícia', paymentMethod: 'installments', estimatedAmount: 45, installmentCount: 3, scheduledDate: today,
  }));
  const results = await Promise.all([app.api(`${shop}/${item.id}/complete`, post({})), app.api(`${shop}/${item.id}/complete`, post({}))]);
  assert.equal(results[0][1].data.groupId, results[1][1].data.groupId);
  const before = (await app.api(list))[1].data;
  assert.equal(before.filter(row => row.description === 'Compra fictícia').length, 3);

  await app.page.send('Page.reload');
  await app.click('Entrar no perfil Teste aberto');
  await app.visible('Despesa fictícia');
  await app.visible('Caderno de Dívidas');
  await app.click('Lista de compras');
  await app.visible('Compra fictícia');
  await app.click('Compromissos futuros');
  await app.visible('Compra fictícia');
  await app.click('Simular compra');
  await until(() => app.evaluate(`Boolean(document.querySelector('input[name="total"]'))`), 'valor da simulação');
  await app.evaluate(`(() => {
    const field = document.querySelector('input[name="total"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, '50');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await app.visible('Sobra mensal projetada');
  assert.deepEqual((await app.api(list))[1].data, before);
  await app.click('Extrato');
  await app.click('Mês anterior');
  const returnMonth = await app.evaluate("document.querySelector('.month-nav h1').innerText");
  await app.click('Ajuda e tutorial');
  await app.chapter('Importar contracheque');
  await app.click('Documento original e Trocar PDF');
  await app.visible('Página 1 de 2');
  await app.click('Próxima');
  await app.visible('Página 2 de 2');
  await app.chapter('Importar contracheque');
  await app.click('Confirmação · Confirmar e registrar');
  await app.visible('é o botão que grava os lançamentos');
  const { nodes } = await app.page.send('Accessibility.getFullAXTree');
  assert.ok(nodes.some(node => node.role?.value === 'heading' && node.name?.value === 'Confirmação · Confirmar e registrar' &&
    node.description?.value.includes('passo 6 de 6')));
  assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === 'Confirmar e registrar'));
  await app.click('Confirmar e registrar');
  await app.visible('Importação concluída');
  await app.click('Sair do tutorial');
  assert.equal(await app.evaluate("document.querySelector('.month-nav h1').innerText"), returnMonth);
  assert.equal(await app.evaluate("document.activeElement.textContent.trim()"), 'Ajuda e tutorial');
  assert.deepEqual((await app.api(list))[1].data, before);
  await app.click('Próximo mês');

  await app.click('Importar contracheque');
  const pdfPath = join(directory, 'Contracheque ficção.pdf');
  const contents = Buffer.from(pdf(today.slice(5, 7), today.slice(0, 4)), 'latin1');
  await writeFile(pdfPath, contents);
  const [parseStatus, parseResult] = await app.evaluate(`(async () => {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(atob('${contents.toString('base64')}'), c => c.charCodeAt(0))],
      { type: 'application/pdf' }), 'ficticio.pdf');
    const response = await fetch('/api/payslip/parse?profileId=${profile.id}', { method: 'POST', body: form });
    return [response.status, await response.json()];
  })()`);
  assert.equal(parseStatus, 200, JSON.stringify(parseResult));
  await app.selectPdf(pdfPath);
  try {
    await app.visible('Conferir a leitura');
  } catch (error) {
    throw new Error(`Falha na leitura do PDF: ${await app.evaluate("document.querySelector('.payslip-modal')?.innerText")}`, { cause: error });
  }
  await app.visible('1.234,56');
  await until(() => app.evaluate(`Boolean(document.querySelector('.payslip-local-preview canvas:not([hidden])'))`), 'prévia PDF renderizada');
  await app.click('Próxima');
  await app.visible('Página 2 de 2');
  await app.click('Escolher lançamentos');
  await app.click('Revisar importação');
  await app.click('Confirmar e registrar');
  try {
    await app.visible('Importação concluída');
  } catch (error) {
    throw new Error(`Falha no registro do PDF: ${await app.evaluate("document.querySelector('.payslip-modal')?.innerText")}`, { cause: error });
  }
  assert.ok((await app.api(list))[1].data.some(row => row.type === 'income' && row.amount === 1234.56));
  await app.click('Concluir');
  const actualRows = (await app.api(list))[1].data;
  await app.click('Ajuda e tutorial');
  await app.click('Recomeçar tutorial');
  await app.visible('Capa do exemplo · passo 1 de 1');
  await app.pointer('Avançar');
  await app.visible('Anotar e corrigir lançamentos · passo 1 de 11');
  await app.pointer('Avançar');
  await app.visible('148,32');
  await app.click('Salvar lançamento');
  await app.visible('Despesa cadastrada.');
  await app.pointer('Avançar');
  await app.visible('Anotar e corrigir lançamentos · passo 3 de 11');
  await until(() => app.evaluate("document.querySelector('[data-guide=light] .settle-button')?.ariaLabel.includes('Marcar como pago')"), 'conta pendente');
  const expenseTotals = () => app.evaluate(`Array.from(document.querySelectorAll('.guide-demo .flow:last-child dd'),
    node => Number(node.textContent.replace(/[^\\d,]/g, '').replace(',', ''))) `);
  const pendingTotals = await expenseTotals();
  await app.click('Pendente — Marcar como pago — Conta de luz');
  await app.visible('Conta de luz: marcado como pago');
  await until(() => app.evaluate("document.querySelector('[data-guide=light] .settle-button')?.ariaLabel.includes('Marcar como pendente')"), 'conta paga');
  const paidTotals = await expenseTotals();
  assert.deepEqual(paidTotals, [pendingTotals[0] + 14832, pendingTotals[1] - 14832]);
  await app.click('Avançar');
  await app.click('Sair do tutorial');
  assert.deepEqual(await app.evaluate('window.notebookTutorial.read()'), { choice: 'started', chapter: 'lancamentos', step: 'paga' });
  assert.deepEqual((await app.api(list))[1].data, actualRows);
  await app.close();

  const reopened = await open();
  assert.notEqual(reopened.target.url, app.target.url);
  const [, { data: profiles }] = await reopened.api('/profiles');
  assert.deepEqual(profiles.map(row => row.id), [protectedProfile.id, profile.id]);
  assert.equal((await reopened.api('/profiles/' + protectedProfile.id + '/session', post({ pin: '0123' })))[0], 200);
  await reopened.click('Entrar no perfil Teste aberto');
  await reopened.click('Ajuda e tutorial');
  await reopened.click('Continuar de onde parei');
  await reopened.visible('Anotar e corrigir lançamentos · passo 4 de 11');
  assert.equal(await reopened.evaluate("document.activeElement.textContent.trim()"), 'Conta de luz paga');
  await reopened.page.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 420, deviceScaleFactor: 2, mobile: false });
  await reopened.page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await reopened.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await reopened.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  await reopened.key('Tab');
  await reopened.visible('Ir ao controle do exemplo');
  await reopened.key('Tab');
  await reopened.key('Tab');
  assert.equal(await reopened.evaluate("document.activeElement.textContent.trim()"), 'Avançar');
  await reopened.key('Space');
  await reopened.visible('Anotar e corrigir lançamentos · passo 5 de 11');
  assert.equal(await reopened.evaluate("document.activeElement.textContent.trim()"), 'Nova receita');
  const visited = [];
  while (await reopened.evaluate("Boolean(document.querySelector('.guide-progress'))")) {
    const progress = await reopened.evaluate("document.querySelector('.guide-progress').textContent");
    assert.ok(!visited.includes(progress), progress);
    visited.push(progress);
    await until(() => reopened.evaluate("Boolean(document.querySelector('.guide-demo [data-guide-focus]'))"), 'destaque em ' + progress);
    if (progress === 'Compromissos futuros · passo 4 de 4') {
      await reopened.click('Tentar novamente');
      await reopened.visible('Em aberto no mês');
    }
    if (progress === 'Recursos do Windows · passo 2 de 3') {
      await reopened.click('Selecionar banco SQLite');
      await reopened.visible('caderno-exemplo.sqlite');
    }
    if (progress === 'Recursos do Windows · passo 3 de 3') {
      await reopened.click('Ativar base importada');
      await reopened.visible('Cópia de demonstração ativada.');
    }
    await reopened.click('Avançar');
  }
  assert.ok(visited.some(progress => progress.startsWith('Recursos do Windows')));
  await reopened.visible('Tudo pronto para usar seu caderno');
  assert.deepEqual(await reopened.evaluate('window.notebookTutorial.read()'), { choice: 'completed' });
  await reopened.click('Usar o Caderno de Dívidas');
  assert.equal(await reopened.evaluate("document.activeElement.textContent.trim()"), 'Ajuda e tutorial');
  await reopened.page.send('Emulation.clearDeviceMetricsOverride');
  await reopened.page.send('Network.enable');
  await reopened.page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await reopened.page.send('Network.setBlockedURLs', { urls: ['*DesktopPdfPreview-*.js'] });
  await reopened.page.send('Page.reload');
  await reopened.visible('Despesa fictícia');
  await reopened.click('Importar contracheque');
  await reopened.selectPdf(pdfPath);
  await reopened.visible('Conferir a leitura');
  await reopened.visible('Não foi possível carregar a prévia do PDF.');
  await reopened.visible('1.234,56');
  await reopened.click('Escolher lançamentos');
  await reopened.click('Revisar importação');
  await reopened.visible('Confirmar a importação');
  await reopened.click('Fechar importação');
  await reopened.click('Trocar perfil');
  await reopened.click('Entrar no perfil Teste com PIN');
  await reopened.visible('Desbloquear Teste com PIN');
  await reopened.close();
});
