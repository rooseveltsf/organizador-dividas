import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, Profile } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import { profilePinSchema } from '@organizador/shared';
import { prisma } from './prisma';
import { matchesPinHash, pinKey } from './pinHash';

const attemptLimit = 5;
const attemptWindowMs = 5 * 60_000;
const sessionDurationMs = 8 * 60 * 60_000;
const attemptFields = { id: true, pinHash: true, pinAttempts: true, pinAttemptUntil: true } as const;
const resetAttempts = { pinAttempts: 0, pinAttemptUntil: null };
type PinState = Pick<Profile, keyof typeof attemptFields>;

export class ProfileAccessError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function sessionRequired() {
  return new ProfileAccessError(401, 'PROFILE_SESSION_REQUIRED', 'Desbloqueie o perfil para continuar.');
}

export function respondProfileError(res: Response, error: unknown, message: string) {
  if (error instanceof ProfileAccessError) {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return;
  }
  res.status(500).json({ success: false, message });
}

function sessionHash(req: Request) {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(req.get('Authorization') ?? '')?.[1];
  return token ? createHash('sha256').update(token).digest('hex') : undefined;
}

export function profileAccessFilter(req: Request): Pick<Prisma.ProfileWhereInput, 'pinHash' | 'OR'> {
  const tokenHash = sessionHash(req);
  return tokenHash ? {
    OR: [
      { pinHash: null },
      { sessions: { some: { tokenHash, expiresAt: { gt: new Date() } } } },
    ],
  } : { pinHash: null };
}

export async function requireProfileAccess(req: Request, profileId: string, db: Pick<Prisma.TransactionClient, 'profile'> = prisma) {
  const profile = await db.profile.findUnique({ where: { id: profileId, ...profileAccessFilter(req) } });
  if (profile) return profile;
  if (await db.profile.findUnique({ where: { id: profileId }, select: { id: true } })) throw sessionRequired();
  throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
}

export function authorizeProfile(getId: (req: Request) => unknown): RequestHandler {
  return async (req, res, next) => {
    const id = getId(req);
    if (typeof id !== 'string' || !id.trim()) {
      res.status(400).json({ success: false, message: 'Informe o ID do perfil.' });
      return;
    }
    try {
      res.locals.profile = await requireProfileAccess(req, id.trim());
      next();
    } catch (error) {
      respondProfileError(res, error, 'Não foi possível verificar o acesso ao perfil.');
    }
  };
}

function pinSecret() {
  const secret = process.env.PROFILE_PIN_SECRET ?? '';
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new ProfileAccessError(503, 'PROFILE_PIN_UNAVAILABLE', 'A proteção por PIN precisa ser configurada no servidor.');
  }
  return Buffer.from(secret, 'hex');
}

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await pinKey(pin, salt, pinSecret());
  return `scrypt-v1:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function waitError(until: Date) {
  const seconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  return new ProfileAccessError(429, 'PROFILE_PIN_RATE_LIMITED', `Muitas tentativas. Tente novamente em ${seconds} s.`, seconds);
}

export async function verifyPin(profileId: string, expectedHash: string, input: unknown) {
  const pin = profilePinSchema.safeParse(input);
  if (!pin.success) {
    throw new ProfileAccessError(400, 'PROFILE_PIN_REQUIRED', 'Informe o PIN de quatro dígitos.');
  }
  const secret = pinSecret();

  let reservation: PinState;
  // Reserve uma tentativa antes do scrypt. O compare-and-swap também vale entre processos.
  for (;;) {
    const state = await prisma.profile.findUnique({ where: { id: profileId }, select: attemptFields });
    if (state?.pinHash !== expectedHash) throw sessionRequired();
    const now = Date.now();
    const inWindow = state.pinAttemptUntil !== null && state.pinAttemptUntil.getTime() > now;
    if (inWindow && state.pinAttempts >= attemptLimit) throw waitError(state.pinAttemptUntil!);
    const pinAttempts = inWindow ? state.pinAttempts + 1 : 1;
    const pinAttemptUntil = inWindow && pinAttempts < attemptLimit
      ? state.pinAttemptUntil! : new Date(now + attemptWindowMs);
    const updated = await prisma.profile.updateMany({
      where: state, data: { pinAttempts, pinAttemptUntil },
    });
    if (updated.count) {
      reservation = { ...state, pinAttempts, pinAttemptUntil };
      break;
    }
  }

  if (!await matchesPinHash(pin.data, expectedHash, secret)) {
    if (reservation.pinAttempts >= attemptLimit) throw waitError(reservation.pinAttemptUntil!);
    throw new ProfileAccessError(401, 'PROFILE_PIN_INVALID', 'PIN incorreto.');
  }
  await prisma.profile.updateMany({ where: reservation, data: resetAttempts });
}

export async function createProfileSession(id: string, pinHash: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const expiresAt = new Date(now + sessionDurationMs);
  try {
    await prisma.profile.update({
      where: { id, pinHash },
      data: {
        sessions: {
          deleteMany: { expiresAt: { lte: new Date(now) } },
          create: { tokenHash, expiresAt },
        },
      },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingRecord(error)) throw sessionRequired();
    throw error;
  }
  return { token, ...sessionExpiration(expiresAt) };
}

function sessionExpiration(expiresAt: Date) {
  return { expiresAt: expiresAt.toISOString(), expiresInMs: expiresAt.getTime() - Date.now() };
}

export async function profileSessionStatus(req: Request, profileId: string) {
  const tokenHash = sessionHash(req);
  const session = tokenHash && await prisma.profileSession.findFirst({
    where: { tokenHash, profileId, expiresAt: { gt: new Date() } },
    select: { expiresAt: true },
  });
  if (!session) throw sessionRequired();
  return sessionExpiration(session.expiresAt);
}

export async function revokeProfileSession(req: Request, profileId: string) {
  const tokenHash = sessionHash(req);
  if (tokenHash) await prisma.profileSession.deleteMany({ where: { profileId, tokenHash } });
}

export function isMissingRecord(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'P2025';
}
