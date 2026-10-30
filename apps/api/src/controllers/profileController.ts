import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { ApiResponse, Profile, CreateProfileDTO, UpdateProfileDTO } from '@organizador/shared';

const HEX_COLOR_REGEX = /^#([0-9A-F]{3}){1,2}$/i;

export const createProfileBodySchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  primaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, 'A cor primária deve ser um código hexadecimal válido (ex: #6366F1)'),
  secondaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, 'A cor secundária deve ser um código hexadecimal válido (ex: #EC4899)'),
  avatarInitials: z.string().trim().min(1).max(4).optional(),
});

export const updateProfileBodySchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, 'A cor primária deve ser um código hexadecimal válido (ex: #6366F1)')
    .optional(),
  secondaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, 'A cor secundária deve ser um código hexadecimal válido (ex: #EC4899)')
    .optional(),
  avatarInitials: z.string().trim().min(1).max(4).optional(),
});

/**
 * Utilitário para gerar iniciais limpas a partir do nome (ex: "João Silva" -> "JS", "Maria" -> "MA")
 */
export function generateAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export class ProfileController {
  /**
   * 1. GET /profiles
   * Lista todos os perfis ordenados por data de criação com contagem/resumo de pendências do mês vigente.
   */
  public static async list(_req: Request, res: Response): Promise<void> {
    try {
      const profiles = await prisma.profile.findMany({
        orderBy: { createdAt: 'asc' },
      });

      // Intervalo do mês vigente para computar resumo de pendências
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const pendingAggregations = await prisma.transaction.groupBy({
        by: ['profileId'],
        where: {
          status: 'pending',
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      const pendingMap = new Map(
        pendingAggregations.map((item) => [
          item.profileId,
          {
            count: item._count.id,
            amount: item._sum.amount ?? 0,
          },
        ])
      );

      const data = profiles.map((profile) => {
        const pending = pendingMap.get(profile.id) ?? { count: 0, amount: 0 };
        return {
          ...profile,
          pendingCountCurrentMonth: pending.count,
          pendingAmountCurrentMonth: pending.amount,
        };
      });

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao listar perfis de usuário.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 2. POST /profiles
   * Cria um novo perfil validando name, primaryColor e secondaryColor e gerando avatarInitials se ausente.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = createProfileBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para criação do perfil.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const { name, primaryColor, secondaryColor, avatarInitials: requestedInitials } = parseResult.data;
      const avatarInitials = requestedInitials?.trim() || generateAvatarInitials(name);

      const createdProfile = await prisma.profile.create({
        data: {
          name,
          primaryColor,
          secondaryColor,
          avatarInitials,
        },
      });

      const response: ApiResponse<typeof createdProfile> = {
        success: true,
        message: 'Perfil criado com sucesso.',
        data: createdProfile,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao criar perfil.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 3. PUT /profiles/:id
   * Atualiza as informações do perfil existente (nome, cores e iniciais).
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existingProfile = await prisma.profile.findUnique({
        where: { id },
      });

      if (!existingProfile) {
        const notFound: ApiResponse = {
          success: false,
          message: 'Perfil não encontrado.',
        };
        res.status(404).json(notFound);
        return;
      }

      const parseResult = updateProfileBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para atualização do perfil.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const payload = parseResult.data;
      const updateData: {
        name?: string;
        primaryColor?: string;
        secondaryColor?: string;
        avatarInitials?: string;
      } = {};

      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.primaryColor !== undefined) updateData.primaryColor = payload.primaryColor;
      if (payload.secondaryColor !== undefined) updateData.secondaryColor = payload.secondaryColor;

      if (payload.avatarInitials !== undefined) {
        updateData.avatarInitials = payload.avatarInitials;
      } else if (payload.name && payload.name !== existingProfile.name) {
        // Se o nome foi alterado e iniciais não foram explicitamente passadas, re-gerar iniciais
        updateData.avatarInitials = generateAvatarInitials(payload.name);
      }

      const updatedProfile = await prisma.profile.update({
        where: { id },
        data: updateData,
      });

      const response: ApiResponse<typeof updatedProfile> = {
        success: true,
        message: 'Perfil atualizado com sucesso.',
        data: updatedProfile,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao atualizar perfil.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 4. DELETE /profiles/:id
   * Remove o perfil e todas as suas transações vinculadas via exclusão em cascata.
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existingProfile = await prisma.profile.findUnique({
        where: { id },
      });

      if (!existingProfile) {
        const notFound: ApiResponse = {
          success: false,
          message: 'Perfil não encontrado.',
        };
        res.status(404).json(notFound);
        return;
      }

      const deletedProfile = await prisma.profile.delete({
        where: { id },
      });

      const response: ApiResponse<typeof deletedProfile> = {
        success: true,
        message: `Perfil "${deletedProfile.name}" e suas transações vinculadas foram removidos com sucesso.`,
        data: deletedProfile,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao remover perfil.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }
}

