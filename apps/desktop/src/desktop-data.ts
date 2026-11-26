import { safeStorage } from 'electron';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearImportedSessions, prepareDatabase, protectedProfiles, readMigrations, snapshot } from './database';

const validSecret = /^[0-9a-f]{64}$/i;
export interface ImportCredentials {
  secret: string;
  pins: string[];
}

export function atomicWrite(path: string, value: string | Buffer) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, value, { flag: 'wx' });
    renameSync(tmp, path);
  } finally {
    rmSync(tmp, { force: true });
  }
}

export class DesktopData {
  private readonly bases: string;
  private readonly selection: string;
  private readonly migrations: ReturnType<typeof readMigrations>;

  constructor(root: string, legacySql: string, migrations: string, private readonly pinModule: string) {
    this.bases = join(root, 'bases');
    this.selection = join(root, 'base-ativa.txt');
    this.migrations = readMigrations(legacySql, migrations);
  }

  current() {
    const name = existsSync(this.selection) ? readFileSync(this.selection, 'utf8').trim() : 'principal';
    if (!/^(?:principal|importacao-[A-Za-z0-9]{6})$/.test(name)) {
      throw new Error('A seleção da base local é inválida. Verifique o arquivo base-ativa.txt.');
    }
    const dir = join(this.bases, name);
    if (name !== 'principal' && !existsSync(this.database(dir))) {
      throw new Error(`A base selecionada está ausente em ${dir}. Restaure a base antes de tentar novamente.`);
    }
    return dir;
  }

  select(dir: string) {
    const name = dir.slice(this.bases.length + 1);
    atomicWrite(this.selection, `${name}\n`);
  }

  database(dir: string) {
    return join(dir, 'organizador.sqlite');
  }

  private async prepare(dir: string, importing = false) {
    await prepareDatabase(this.database(dir), this.migrations, join(dir, 'backups'), importing);
  }

  private async saveSecret(dir: string, secret: string) {
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('A proteção de credenciais do Windows está indisponível.');
    atomicWrite(join(dir, 'pin-secret.bin'), await safeStorage.encryptStringAsync(secret));
  }

  async open(dir: string) {
    await this.prepare(dir);
    const path = join(dir, 'pin-secret.bin');
    if (!existsSync(path)) {
      if (protectedProfiles(this.database(dir)).length) {
        throw new Error(`A chave dos PINs está ausente em ${dir}. Restaure pin-secret.bin para abrir esta base.`);
      }
      await this.saveSecret(dir, randomBytes(32).toString('hex'));
    }
    try {
      const encrypted = readFileSync(path);
      const decrypted = await safeStorage.decryptStringAsync(encrypted);
      const { result: secret } = decrypted.shouldReEncrypt ? await safeStorage.decryptStringAsync(encrypted) : decrypted;
      if (validSecret.test(secret)) return secret;
    } catch {
      // A chave está vinculada à conta Windows que a protegeu.
    }
    throw new Error(`A conta Windows não conseguiu ler a chave dos PINs em ${dir}. Restaure pin-secret.bin.`);
  }

  async stageImport(source: string) {
    mkdirSync(this.bases, { recursive: true });
    const dir = mkdtempSync(join(this.bases, 'importacao-'));
    try {
      const database = this.database(dir);
      await snapshot(source, database);
      await this.prepare(dir, true);
      return { dir, profiles: protectedProfiles(database) };
    } catch (error) {
      if (!existsSync(join(dir, 'backups'))) this.discard(dir);
      throw error;
    }
  }

  discard(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

  async confirm(candidate: Awaited<ReturnType<DesktopData['stageImport']>>, input: unknown) {
    const credentials = input as Partial<ImportCredentials> | null;
    if (!credentials || typeof credentials.secret !== 'string' || !Array.isArray(credentials.pins) ||
        credentials.pins.length !== candidate.profiles.length ||
        credentials.pins.some(pin => typeof pin !== 'string' || !/^\d{4}$/.test(pin))) {
      throw new Error('Preencha o PIN de quatro dígitos de cada perfil protegido.');
    }
    const secret = candidate.profiles.length ? credentials.secret.trim() : randomBytes(32).toString('hex');
    if (!validSecret.test(secret)) throw new Error('Informe o PROFILE_PIN_SECRET original de 64 caracteres hexadecimais.');
    const { matchesPinHash } = require(this.pinModule) as {
      matchesPinHash(pin: string, hash: string, secret: Buffer): Promise<boolean>;
    };
    for (const [index, profile] of candidate.profiles.entries()) {
      if (!await matchesPinHash(credentials.pins[index], profile.hash, Buffer.from(secret, 'hex'))) {
        throw new Error(`O PIN do perfil ${profile.name} ou o segredo da versão web está incorreto. Revise e tente novamente.`);
      }
    }
    clearImportedSessions(this.database(candidate.dir));
    await this.saveSecret(candidate.dir, secret);
    return secret;
  }
}
