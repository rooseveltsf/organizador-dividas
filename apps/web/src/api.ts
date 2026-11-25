import type { ApiResponse } from '@organizador/shared';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/+$/, '');

export async function requestApi<T>(path: string, errorMessage: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const response = await fetch(apiBaseUrl + path, { cache: 'no-store', ...init });
    if (!response.ok) throw new Error();
    const result: ApiResponse<T> = await response.json();
    if (result?.success !== true) throw new Error();
    return result.data;
  } catch {
    throw new Error(errorMessage);
  }
}
