import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Profile, CreateProfileDTO, UpdateProfileDTO, ApiResponse } from '@organizador/shared';

const API_BASE_URL = 'http://localhost:3000';
const STORAGE_KEY = '@organizador:active_profile_id';

/**
 * Converte código Hexadecimal (#RRGGBB ou #RGB) para rgba com o nível de opacidade fornecido
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return `rgba(59, 130, 246, ${alpha})`;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Escurece suavemente a cor hexadecimal para gerar tons dinâmicos de hover e active
 */
export function adjustHexBrightness(hex: string, percent: number = -12): string {
  if (!hex) return '#2563eb';
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return '#2563eb';
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r = Math.min(255, Math.max(0, Math.round(r * (1 + percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g * (1 + percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b * (1 + percent / 100))));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export interface ProfileContextData {
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoading: boolean;
  selectProfile: (profile: Profile | null) => void;
  fetchProfiles: () => Promise<void>;
  createProfile: (data: CreateProfileDTO) => Promise<Profile>;
  updateProfile: (id: string, data: UpdateProfileDTO) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextData | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Efeito dinâmico que injeta as variáveis CSS globais no :root do documento
  useEffect(() => {
    const root = document.documentElement;
    if (activeProfile) {
      const primary = activeProfile.primaryColor || '#3b82f6';
      const secondary = activeProfile.secondaryColor || '#8b5cf6';
      const primaryHover = adjustHexBrightness(primary, -12);
      const primarySoft = hexToRgba(primary, 0.15);
      const secondarySoft = hexToRgba(secondary, 0.15);

      root.style.setProperty('--profile-primary', primary);
      root.style.setProperty('--profile-primary-hover', primaryHover);
      root.style.setProperty('--profile-primary-soft', primarySoft);
      root.style.setProperty('--profile-secondary', secondary);
      root.style.setProperty('--profile-secondary-soft', secondarySoft);
    } else {
      // Fallback para valores padrão quando nenhum perfil estiver ativo
      root.style.setProperty('--profile-primary', '#3b82f6');
      root.style.setProperty('--profile-primary-hover', '#2563eb');
      root.style.setProperty('--profile-primary-soft', 'rgba(59, 130, 246, 0.15)');
      root.style.setProperty('--profile-secondary', '#8b5cf6');
      root.style.setProperty('--profile-secondary-soft', 'rgba(139, 92, 246, 0.15)');
    }
  }, [activeProfile]);

  const selectProfile = useCallback((profile: Profile | null) => {
    setActiveProfile(profile);
    if (profile) {
      localStorage.setItem(STORAGE_KEY, profile.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/profiles`);
      if (!response.ok) {
        throw new Error(`Falha ao buscar perfis: status ${response.status}`);
      }
      const result: ApiResponse<Profile[]> = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setProfiles(result.data);

        // Restaura perfil ativo salvo anteriormente se existente
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const found = result.data.find((p) => p.id === savedId);
          if (found) {
            setActiveProfile(found);
          }
        }
      } else {
        setProfiles([]);
      }
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProfile = useCallback(
    async (data: CreateProfileDTO): Promise<Profile> => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || 'Erro ao criar perfil.');
        }

        const result: ApiResponse<Profile> = await response.json();
        if (!result.data) throw new Error('Dados do perfil não retornados pela API.');

        const newProfile = result.data;
        setProfiles((prev) => [...prev, newProfile]);
        selectProfile(newProfile);
        return newProfile;
      } catch (error) {
        console.error('Erro ao criar perfil:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [selectProfile]
  );

  const updateProfile = useCallback(
    async (id: string, data: UpdateProfileDTO): Promise<Profile> => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/profiles/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || 'Erro ao atualizar perfil.');
        }

        const result: ApiResponse<Profile> = await response.json();
        if (!result.data) throw new Error('Dados do perfil não retornados pela API.');

        const updated = result.data;
        setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
        if (activeProfile?.id === id) {
          setActiveProfile(updated);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeProfile]
  );

  const deleteProfile = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/profiles/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || 'Erro ao remover perfil.');
        }

        setProfiles((prev) => prev.filter((p) => p.id !== id));
        if (activeProfile?.id === id) {
          selectProfile(null);
        }
      } catch (error) {
        console.error('Erro ao remover perfil:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeProfile, selectProfile]
  );

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        isLoading,
        selectProfile,
        fetchProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfiles(): ProfileContextData {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles deve ser utilizado dentro de um ProfileProvider');
  }
  return context;
}

