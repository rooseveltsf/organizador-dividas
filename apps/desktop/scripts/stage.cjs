const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, join, relative, resolve } = require('node:path');

const desktop = resolve(__dirname, '..');
const root = resolve(desktop, '../..');
const modules = join(root, 'node_modules');
const api = join(root, 'apps', 'api');
const shared = join(root, 'packages', 'shared');
const build = join(desktop, 'build');
const application = join(build, 'application');
const runtime = join(build, 'runtime');
const included = new Map();

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function copy(from, to, options) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true, ...options });
}

function includeDependencies(from, target) {
  const pkg = json(join(from, 'package.json'));
  const load = createRequire(join(from, 'package.json'));
  const optional = pkg.optionalDependencies ?? {};
  for (const name of Object.keys({ ...pkg.dependencies, ...optional })) {
    if (name === '@organizador/shared') {
      const destination = join(runtime, 'node_modules', name);
      if (included.has(destination)) continue;
      included.set(destination, shared);
      copy(join(shared, 'package.json'), join(destination, 'package.json'));
      copy(join(shared, 'dist'), join(destination, 'dist'));
      includeDependencies(shared, destination);
      continue;
    }
    const source = load.resolve.paths(name).map(path => join(path, name)).find(path => existsSync(join(path, 'package.json')));
    if (!source) {
      if (name in optional) continue;
      throw new Error(`Dependência ausente: ${name} (${from})`);
    }

    const relativeToModules = relative(modules, source);
    const relativeToWorkspace = relative(from, source);
    // Preserve a posição no node_modules, inclusive quando o npm aninha uma versão.
    const destination = !relativeToModules.startsWith('..') ? join(runtime, 'node_modules', relativeToModules) :
      !relativeToWorkspace.startsWith('..') ? join(target, relativeToWorkspace) :
      join(runtime, 'node_modules', relative(root, source).startsWith('apps') ? '@organizador/api' : '@organizador/shared',
        ...relative(root, source).split(/[\\/]/).slice(2));
    if (included.has(destination)) {
      if (included.get(destination) !== source) throw new Error(`Conflito de resolução para ${name}.`);
      continue;
    }
    included.set(destination, source);
    copy(source, destination, {
      filter: path => {
        const parts = relative(source, path).split(/[\\/]/);
        return !parts.some(part => part === 'node_modules' || /^\.env(?:\.|$)|\.(?:db|sqlite3?)(?:-|$)/i.test(part)) &&
          !(name === 'zod' && (parts[0] === 'src' || /\.d\.(?:ts|cts|mts)$/.test(path)));
      },
    });
    includeDependencies(source, destination);
  }
}

for (const target of [application, runtime]) rmSync(target, { recursive: true, force: true });
for (const name of ['dist', 'setup']) copy(join(desktop, name), join(application, name));
const { version, main } = json(join(desktop, 'package.json'));
writeFileSync(join(application, 'package.json'), JSON.stringify({
  name: 'caderno-dividas', productName: 'Caderno de Dívidas', version, main,
  description: 'Caderno de Dívidas para controle de finanças pessoais', author: 'Caderno de Dívidas',
}));
const apiPackage = join(runtime, 'node_modules', '@organizador', 'api');
copy(join(api, 'dist'), join(apiPackage, 'dist'));
copy(join(desktop, 'dist', 'backend.js'), join(runtime, 'backend.js'));
copy(join(root, 'apps', 'web', 'dist-desktop'), join(runtime, 'web'));
includeDependencies(api, apiPackage);

const generated = join(dirname(createRequire(join(api, 'package.json')).resolve('@prisma/client/package.json')), '..', '..', '.prisma', 'client');
for (const name of ['default.js', 'index.js', 'package.json', 'schema.prisma', 'query_engine-windows.dll.node']) {
  copy(join(generated, name), join(runtime, 'node_modules', '.prisma', 'client', name));
}
if (!existsSync(join(runtime, 'node_modules', '@napi-rs', 'canvas-win32-x64-msvc'))) {
  throw new Error('O binário Windows x64 de @napi-rs/canvas precisa estar instalado para empacotar os PDFs.');
}
