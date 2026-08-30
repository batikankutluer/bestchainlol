const STORAGE_KEY = 'bestchain.admin.jwt';

export const getToken = (): string | null => localStorage.getItem(STORAGE_KEY);
export const setToken = (token: string): void => localStorage.setItem(STORAGE_KEY, token);
export const clearToken = (): void => localStorage.removeItem(STORAGE_KEY);
