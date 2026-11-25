import type { Profile as ProfileRecord } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { calendarDay, calendarMonthRange, createProfileSchema, profilePinSchema, updateProfileSchema,
  type Profile, type ProfileDetails, type ProfileSession, type ProfileSessionStatus } from '@organizador/shared';
import { prisma } from '../prisma';
import {
  createProfileSession, hashPin, isMissingRecord, profileAccessFilter, ProfileAccessError, profileSessionStatus,
  respondProfileError, revokeProfileSession, sessionRequired, verifyPin,
} from '../profileAccess';

const updatePinSchema = z.object({
  pin: profilePinSchema.nullable(),
  pinConfirmation: profilePinSchema.optional(),
  currentPin: profilePinSchema.optional(),
}).refine(({ pin, pinConfirmation }) => (pin ?? undefined) === pinConfirmation, {
  message: 'Confirme o mesmo PIN de quatro dígitos.',
  path: ['pinConfirmation'],
});

const directoryFields = {
  id: true, name: true, avatarInitials: true, primaryColor: true, secondaryColor: true, pinHash: true,
} as const;

function directoryProfile({ id, name, avatarInitials, primaryColor, secondaryColor, pinHash }:
  Pick<ProfileRecord, keyof typeof directoryFields>): Profile {
  return { id, name, avatarInitials, primaryColor, secondaryColor, hasPin: pinHash !== null };
}

export function generateAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export class ProfileController {
  static async list(_req: Request, res: Response) {
    try {
      const profiles = await prisma.profile.findMany({ orderBy: { createdAt: 'asc' }, select: directoryFields });
      res.json({ success: true, data: profiles.map(directoryProfile) });
    } catch (error) {
      respondProfileError(res, error, 'Erro ao listar perfis.');
    }
  }

  static async create(req: Request, res: Response) {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Confira o nome, as cores e a confirmação do PIN.' });
      return;
    }
    const { name, avatarInitials, primaryColor, secondaryColor, pin } = parsed.data;
    try {
      const profile = await prisma.profile.create({
        data: {
          name, primaryColor, secondaryColor,
          avatarInitials: avatarInitials ?? generateAvatarInitials(name),
          pinHash: pin === undefined ? null : await hashPin(pin),
        },
        select: directoryFields,
      });
      res.status(201).json({ success: true, data: directoryProfile(profile) });
    } catch (error) {
      respondProfileError(res, error, 'Erro ao criar perfil.');
    }
  }

  static async details(req: Request, res: Response) {
    const profile: ProfileRecord = res.locals.profile;
    try {
      const pending = await prisma.transaction.aggregate({
        where: {
          profileId: profile.id,
          profile: profileAccessFilter(req),
          status: 'pending',
          date: calendarMonthRange(calendarDay(new Date()).slice(0, 7)),
        },
        _count: { id: true },
        _sum: { amount: true },
      });
      const data: ProfileDetails = {
        ...directoryProfile(profile),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
        pendingCountCurrentMonth: pending._count.id,
        pendingAmountCurrentMonth: pending._sum.amount ?? 0,
      };
      res.json({ success: true, data });
    } catch (error) {
      respondProfileError(res, error, 'Erro ao consultar os dados do perfil.');
    }
  }

  static async update(req: Request, res: Response) {
    const profile: ProfileRecord = res.locals.profile;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Confira o nome e as cores do perfil.' });
      return;
    }
    try {
      const { name, avatarInitials, primaryColor, secondaryColor } = parsed.data;
      const updated = await prisma.profile.update({
        where: { id: profile.id, ...profileAccessFilter(req) },
        data: {
          name, primaryColor, secondaryColor,
          avatarInitials: avatarInitials ?? (name && name !== profile.name ? generateAvatarInitials(name) : undefined),
        },
        select: directoryFields,
      });
      res.json({ success: true, data: directoryProfile(updated) });
    } catch (error) {
      respondProfileError(res, isMissingRecord(error) ? sessionRequired() : error, 'Erro ao atualizar perfil.');
    }
  }

  static async delete(req: Request, res: Response) {
    const profile: ProfileRecord = res.locals.profile;
    try {
      if (profile.pinHash !== null) await verifyPin(profile.id, profile.pinHash, req.body?.currentPin);
      const deleted = await prisma.profile.delete({
        where: { id: profile.id, AND: [{ pinHash: profile.pinHash }, profileAccessFilter(req)] },
        select: directoryFields,
      });
      res.json({ success: true, data: directoryProfile(deleted) });
    } catch (error) {
      respondProfileError(res, isMissingRecord(error) ? sessionRequired() : error, 'Erro ao remover perfil.');
    }
  }

  static async updatePin(req: Request, res: Response) {
    const profile: ProfileRecord = res.locals.profile;
    const parsed = updatePinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Confira os PINs de quatro dígitos e a confirmação.' });
      return;
    }
    try {
      if (profile.pinHash !== null) await verifyPin(profile.id, profile.pinHash, parsed.data.currentPin);
      const updated = await prisma.profile.update({
        where: { id: profile.id, AND: [{ pinHash: profile.pinHash }, profileAccessFilter(req)] },
        data: {
          pinHash: parsed.data.pin === null ? null : await hashPin(parsed.data.pin),
          pinAttempts: 0,
          pinAttemptUntil: null,
          sessions: { deleteMany: {} },
        },
        select: directoryFields,
      });
      res.json({ success: true, data: directoryProfile(updated) });
    } catch (error) {
      respondProfileError(res, isMissingRecord(error) ? sessionRequired() : error, 'Erro ao atualizar o PIN.');
    }
  }

  static async status(req: Request, res: Response) {
    const profile = directoryProfile(res.locals.profile);
    try {
      const data: ProfileSessionStatus = { profile };
      if (profile.hasPin) data.session = await profileSessionStatus(req, profile.id);
      res.json({ success: true, data });
    } catch (error) {
      respondProfileError(res, error, 'Não foi possível verificar a sessão.');
    }
  }

  static async enter(req: Request, res: Response) {
    try {
      const profile = await prisma.profile.findUnique({ where: { id: req.params.id }, select: directoryFields });
      if (!profile) throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
      let session: ProfileSession | undefined;
      if (profile.pinHash !== null) {
        await verifyPin(profile.id, profile.pinHash, req.body?.pin);
        session = await createProfileSession(profile.id, profile.pinHash);
      }
      res.json({ success: true, data: { profile: directoryProfile(profile), session } });
    } catch (error) {
      respondProfileError(res, error, 'Não foi possível entrar no perfil.');
    }
  }

  static async leave(req: Request, res: Response) {
    try {
      await revokeProfileSession(req, req.params.id);
      res.json({ success: true });
    } catch (error) {
      respondProfileError(res, error, 'Não foi possível revogar a sessão.');
    }
  }
}
