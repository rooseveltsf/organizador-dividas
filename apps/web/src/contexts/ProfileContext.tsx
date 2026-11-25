import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Profile, CreateProfileDTO, UpdateProfileDTO } from '@organizador/shared';

import { requestApi } from '../api';
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
  profileListStatus: 'loading' | 'ready' | 'error';
  selectProfile: (profile: Profile | null) => void;
  fetchProfiles: () => Promise<void>;
  createProfile: (data: CreateProfileDTO) => Promise<Profile>;
  updateProfile: (id: string, data: UpdateProfileDTO) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextData | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const [profileListStatus, setProfileListStatus] = useState<ProfileContextData['profileListStatus']>('loading');
  const listRequest = useRef<AbortController | null>(null);
  const selectionIntent = useRef(0);
  const pendingProfiles = useRef(new Set<string>());

  useEffect(() => {
    try {
      if (activeProfileId) localStorage.setItem(STORAGE_KEY, activeProfileId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // O perfil pode ser usado mesmo se o navegador bloquear o armazenamento.
    }
  }, [activeProfileId]);

  useEffect(() => {
    const root = document.documentElement;
    const primary = activeProfile?.primaryColor || '#3b82f6';
    const secondary = activeProfile?.secondaryColor || '#8b5cf6';
    root.style.setProperty('--profile-primary', primary);
    root.style.setProperty('--profile-primary-hover', activeProfile ? adjustHexBrightness(primary, -12) : '#2563eb');
    root.style.setProperty('--profile-primary-soft', hexToRgba(primary, 0.15));
    root.style.setProperty('--profile-secondary', secondary);
    root.style.setProperty('--profile-secondary-soft', hexToRgba(secondary, 0.15));
  }, [activeProfile]);

  const selectProfile = useCallback((profile: Profile | null) => {
    selectionIntent.current += 1;
    setActiveProfileId(profile?.id ?? null);
  }, []);

  const fetchProfiles = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setProfileListStatus('loading');

    try {
      const list = await requestApi<Profile[]>('/profiles', 'Não foi possível carregar a lista de perfis.', {
        signal: controller.signal,
      });
      if (!Array.isArray(list)) throw new Error();
      if (listRequest.current === controller) {
        setProfiles(list);
        setProfileListStatus('ready');
      }
    } catch {
      if (listRequest.current === controller) setProfileListStatus('error');
    } finally {
      if (listRequest.current === controller) listRequest.current = null;
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
    return () => {
      listRequest.current?.abort();
      listRequest.current = null;
    };
  }, [fetchProfiles]);

  function refreshPendingList() {
    // Uma consulta iniciada antes da gravação pode retornar a lista anterior.
    if (listRequest.current) void fetchProfiles();
  }

  async function createProfile(data: CreateProfileDTO) {
    const intent = ++selectionIntent.current;
    const error = 'Não foi possível criar o perfil. Tente novamente.';
    const created = await requestApi<Profile>('/profiles', error, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!created?.id) throw new Error(error);
    setProfiles((previous) => [...previous.filter((profile) => profile.id !== created.id), created]);
    if (selectionIntent.current === intent) selectProfile(created);
    refreshPendingList();
    return created;
  }

  async function mutateProfile<T>(id: string, mutate: () => Promise<T>) {
    if (pendingProfiles.current.has(id)) throw new Error('Há uma alteração em andamento neste perfil.');
    pendingProfiles.current.add(id);
    try {
      const result = await mutate();
      refreshPendingList();
      return result;
    } finally {
      pendingProfiles.current.delete(id);
    }
  }

  function updateProfile(id: string, data: UpdateProfileDTO) {
    return mutateProfile(id, async () => {
      const error = 'Não foi possível salvar as alterações do perfil. Tente novamente.';
      const updated = await requestApi<Profile>('/profiles/' + encodeURIComponent(id), error, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (updated?.id !== id) throw new Error(error);
      setProfiles((previous) => previous.map((profile) => profile.id === id ? updated : profile));
      return updated;
    });
  }

  function deleteProfile(id: string) {
    return mutateProfile(id, async () => {
      await requestApi('/profiles/' + encodeURIComponent(id), 'Não foi possível excluir o perfil. Tente novamente.', {
        method: 'DELETE',
      });
      setProfiles((previous) => previous.filter((profile) => profile.id !== id));
      setActiveProfileId((previous) => previous === id ? null : previous);
    });
  }

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        selectProfile,
        profileListStatus,
        fetchProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles(): ProfileContextData {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles deve ser utilizado dentro de um ProfileProvider');
  }
  return context;
}

