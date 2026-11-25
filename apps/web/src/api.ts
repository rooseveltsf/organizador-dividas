import type { ApiResponse } from '@organizador/shared';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export async function requestApi<T>(
  path: string, errorMessage: string, init?: RequestInit, token?: string,
): Promise<T | undefined> {
  try {
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch(apiBaseUrl + path, { ...init, headers, cache: 'no-store' });
    const result: ApiResponse<T> & { code?: string } = await response.json();
    if (!response.ok && result?.code?.startsWith('PROFILE_') && result.message) {
      throw new ApiError(result.message, result.code);
    }
    if (!response.ok) throw new Error();
    if (result?.success !== true) throw new Error();
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(errorMessage);
  }
}
