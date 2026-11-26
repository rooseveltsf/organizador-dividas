const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const electron = spawn(require('electron'), [resolve(__dirname, '..'), ...process.argv.slice(2)], { env, stdio: 'inherit' });
electron.on('exit', code => { process.exitCode = code ?? 1; });
