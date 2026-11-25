import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Profile, CreateProfileDTO, ProfileSession, ProfileSessionStatus, UpdateProfileDTO, UpdateProfilePinDTO } from '@organizador/shared';

import { ApiError, requestApi } from '../api';
const STORAGE_KEY = '@organizador:active_profile_id';
const SESSION_KEY = '@organizador:profile_session';

type StoredSession = { profileId: string; token: string };
type ActiveProfile = { profile: Profile; session?: { token: string; deadline: number }; intent: number };
type Entry = { profile: Profile; pending: boolean; needsPin: boolean; error: string };

function rememberedSelection(): { id: string | null; session?: StoredSession } {
  let id: string | null = null;
  try {
    id = localStorage.getItem(STORAGE_KEY);
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (session && session.profileId === id && typeof session.token === 'string') return { id, session };
  } catch {
    // O ID ainda pode ser recuperado quando a sessão armazenada é inválida.
  }
  return { id };
}

function remember(id: string | null, token?: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // O acesso funciona mesmo se o navegador bloquear o armazenamento.
  }
  try {
    if (token && id) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, profileId: id }));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // A sessão continua disponível em memória.
  }
}

const profilePath = (id: string) => '/profiles/' + encodeURIComponent(id);

function json(method: string, data: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

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
  selectionVersion: number | null;
  profileListStatus: 'loading' | 'ready' | 'error';
  entry: Entry | null;
  accessNotice: string;
  selectProfile: (profile: Profile | null) => void;
  unlockProfile: (pin: string) => Promise<void>;
  lockProfile: () => void;
  requestProfileApi: <T>(path: string, error: string, init?: RequestInit) => Promise<T | undefined>;
  fetchProfiles: () => Promise<void>;
  createProfile: (data: CreateProfileDTO) => Promise<Profile>;
  updateProfile: (id: string, data: UpdateProfileDTO) => Promise<Profile>;
  updatePin: (data: UpdateProfilePinDTO) => Promise<void>;
  deleteProfile: (id: string, currentPin?: string) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextData | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<ActiveProfile | null>(null);
  const activeRef = useRef<ActiveProfile | null>(null);
  const restoringSession = useRef<StoredSession>();
  const activeProfile = active?.profile ?? null;
  const [entry, setEntry] = useState<Entry | null>(null);
  const [accessNotice, setAccessNotice] = useState('');
  const [restored] = useState(rememberedSelection);
  const didRestore = useRef(false);
  const [profileListStatus, setProfileListStatus] = useState<ProfileContextData['profileListStatus']>('loading');
  const listRequest = useRef<AbortController | null>(null);
  const selectionIntent = useRef(0);
  const pendingProfiles = useRef(new Set<string>());

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

  const revokeSession = useCallback(async (id: string, token?: string) => {
    if (!token) return;
    const revoke = () => requestApi(profilePath(id) + '/session', 'Falha ao encerrar a sessão.', {
      method: 'DELETE', keepalive: true,
    }, token);
    try {
      await revoke();
    } catch {
      try {
        await revoke();
      } catch {
        setAccessNotice('A sessão foi removida desta aba. O servidor não confirmou o encerramento.');
      }
    }
  }, []);

  const clearActive = useCallback(() => {
    const previous = activeRef.current;
    const restoring = restoringSession.current;
    activeRef.current = null;
    restoringSession.current = undefined;
    setActive(null);
    if (previous) void revokeSession(previous.profile.id, previous.session?.token);
    if (restoring) void revokeSession(restoring.profileId, restoring.token);
  }, [revokeSession]);

  const storeProfile = useCallback((profile: Profile) => {
    setProfiles(previous => previous.some(item => item.id === profile.id)
      ? previous.map(item => item.id === profile.id ? profile : item)
      : [...previous, profile]);
  }, []);

  const enter = useCallback(async (profile: Profile, options: { pin?: string; session?: StoredSession } = {}) => {
    const intent = ++selectionIntent.current;
    clearActive();
    restoringSession.current = options.session;
    remember(profile.id, options.session?.token);
    setAccessNotice('');
    setEntry({ profile, pending: true, needsPin: options.pin !== undefined, error: '' });

    const path = profilePath(profile.id) + '/session';
    const errorMessage = 'Não foi possível entrar no perfil. Tente novamente.';
    try {
      let opened: { profile: Profile; session?: ProfileSession } | undefined;
      if (options.pin === undefined) {
        const status = await requestApi<ProfileSessionStatus>(path, errorMessage, undefined, options.session?.token);
        if (status) {
          opened = { profile: status.profile };
          if (status.session && options.session) opened.session = { ...status.session, token: options.session.token };
        }
      } else {
        opened = await requestApi(path, errorMessage, json('POST', { pin: options.pin }));
      }
      if (selectionIntent.current !== intent) {
        if (options.pin !== undefined) void revokeSession(profile.id, opened?.session?.token);
        return;
      }
      if (opened?.profile?.id !== profile.id || (opened.profile.hasPin && !opened.session)) throw new Error(errorMessage);

      const session = opened.profile.hasPin && opened.session
        ? { token: opened.session.token, deadline: performance.now() + opened.session.expiresInMs } : undefined;
      const access = { profile: opened.profile, session, intent };
      storeProfile(opened.profile);
      remember(profile.id, session?.token);
      restoringSession.current = undefined;
      activeRef.current = access;
      setActive(access);
      setEntry(null);
    } catch (error) {
      if (selectionIntent.current !== intent) return;
      const needsSession = error instanceof ApiError && error.code === 'PROFILE_SESSION_REQUIRED';
      const target = needsSession ? { ...profile, hasPin: true } : profile;
      if (needsSession) {
        storeProfile(target);
        restoringSession.current = undefined;
        remember(profile.id);
      }
      setEntry({
        profile: target, pending: false, needsPin: needsSession || options.pin !== undefined,
        error: needsSession && options.pin === undefined && !options.session ? ''
          : needsSession && options.session ? 'A sessão terminou. Digite o PIN para entrar.'
          : error instanceof Error ? error.message : errorMessage,
      });
    }
  }, [clearActive, revokeSession, storeProfile]);

  const selectProfile = useCallback((profile: Profile | null) => {
    if (profile) {
      if (activeRef.current?.profile.id !== profile.id) void enter(profile);
      return;
    }
    selectionIntent.current += 1;
    clearActive();
    remember(null);
    setEntry(null);
    setAccessNotice('');
  }, [clearActive, enter]);

  const lockProfile = useCallback(() => {
    const id = activeRef.current?.profile.id;
    if (!id) return;
    selectProfile(null);
    remember(id);
    setAccessNotice('Perfil bloqueado.');
  }, [selectProfile]);

  const unlockProfile = async (pin: string) => {
    if (entry && !entry.pending) await enter(entry.profile, { pin });
  };

  const requestProfileApi = useCallback(async <T,>(path: string, error: string, init?: RequestInit) => {
    if (!active || selectionIntent.current !== active.intent) throw new Error(error);
    try {
      return await requestApi<T>(path, error, init, active.session?.token);
    } catch (failure) {
      if (selectionIntent.current === active.intent && failure instanceof ApiError &&
          failure.code === 'PROFILE_SESSION_REQUIRED') void enter(active.profile);
      throw failure;
    }
  }, [active, enter]);

  useEffect(() => {
    if (!active?.session) return;
    const delay = Math.max(0, active.session.deadline - performance.now());
    const timeout = window.setTimeout(() => {
      if (selectionIntent.current === active.intent) void enter(active.profile);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [active, enter]);

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
        if (!didRestore.current && selectionIntent.current === 0) {
          didRestore.current = true;
          const profile = list.find(item => item.id === restored.id);
          if (profile) void enter(profile, { session: restored.session });
          else remember(null);
        }
      }
    } catch {
      if (listRequest.current === controller) setProfileListStatus('error');
    } finally {
      if (listRequest.current === controller) listRequest.current = null;
    }
  }, [enter, restored]);

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
    const created = await requestApi<Profile>('/profiles', error, json('POST', data));
    if (!created?.id) throw new Error(error);
    storeProfile(created);
    refreshPendingList();
    if (selectionIntent.current === intent) await enter(created, { pin: data.pin });
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
      const updated = await requestProfileApi<Profile>(profilePath(id), error, json('PUT', data));
      if (updated?.id !== id) throw new Error(error);
      storeProfile(updated);
      if (activeRef.current && selectionIntent.current === active?.intent && activeRef.current.profile.id === id) {
        activeRef.current = { ...activeRef.current, profile: updated };
        setActive(activeRef.current);
      }
      return updated;
    });
  }

  async function updatePin(data: UpdateProfilePinDTO) {
    if (!active) return;
    const id = active.profile.id;
    return mutateProfile(id, async () => {
      const error = 'Não foi possível salvar o PIN. Confira a confirmação e tente novamente.';
      const updated = await requestProfileApi<Profile>(profilePath(id) + '/pin', error, json('PUT', data));
      if (updated?.id !== id) throw new Error(error);
      storeProfile(updated);
      if (selectionIntent.current === active.intent) void enter(updated);
    });
  }

  function deleteProfile(id: string, currentPin?: string) {
    return mutateProfile(id, async () => {
      const error = 'Não foi possível excluir o perfil. Tente novamente.';
      const init = currentPin === undefined ? { method: 'DELETE' } : json('DELETE', { currentPin });
      if (active?.profile.id === id) await requestProfileApi(profilePath(id), error, init);
      else await requestApi(profilePath(id), error, init);
      setProfiles((previous) => previous.filter((profile) => profile.id !== id));
      if (activeRef.current?.profile.id === id) selectProfile(null);
    });
  }

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        selectionVersion: active?.intent ?? null,
        selectProfile,
        lockProfile,
        unlockProfile,
        entry,
        accessNotice,
        requestProfileApi,
        profileListStatus,
        fetchProfiles,
        createProfile,
        updateProfile,
        updatePin,
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

