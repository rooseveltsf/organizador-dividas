const { accessSync } = require('node:fs');
const { join } = require('node:path');

module.exports = {
  appId: 'br.com.organizador.dividas',
  productName: 'Caderno de Dívidas',
  executableName: 'Caderno de Dividas',
  artifactName: 'Caderno-de-Dividas-${version}-Windows-${arch}-Setup.${ext}',
  electronVersion: require('../../package.json').devDependencies.electron,
  directories: { app: 'apps/desktop/build/application', output: 'dist/desktop' },
  files: ['dist/main.js', 'dist/database.js', 'dist/desktop-data.js', 'dist/local-api.js', 'dist/import-preload.js',
    'dist/notebook-preload.js', 'setup/**/*'],
  extraResources: [
    { from: 'apps/desktop/build/runtime', to: 'runtime' },
    { from: 'apps/desktop/build/runtime/node_modules', to: 'runtime/node_modules' },
    { from: 'apps/api/prisma/migrations', to: 'migrations', filter: ['**/migration.sql'] },
    { from: 'apps/desktop/resources/legacy-transactions.sql', to: 'legacy-transactions.sql' },
  ],
  asar: true,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    onlyLoadAppFromAsar: true,
  },
  npmRebuild: false,
  afterPack({ appOutDir }) {
    for (const file of [
      'app.asar', 'legacy-transactions.sql', 'runtime/web/index.html', 'runtime/backend.js',
      'runtime/node_modules/@organizador/api/dist/app.js',
      'runtime/node_modules/@organizador/shared/dist/index.js',
      'runtime/node_modules/.prisma/client/query_engine-windows.dll.node',
      'runtime/node_modules/pdfjs-dist/legacy/build/pdf.mjs',
      'runtime/node_modules/@napi-rs/canvas-win32-x64-msvc/package.json',
    ]) accessSync(join(appOutDir, 'resources', file));
  },
  win: { target: 'nsis', signAndEditExecutable: false },
  nsis: {
    oneClick: true,
    perMachine: false,
    createStartMenuShortcut: true,
    createDesktopShortcut: true,
    shortcutName: 'Caderno de Dívidas',
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    installerLanguages: ['pt_BR'],
  },
};
