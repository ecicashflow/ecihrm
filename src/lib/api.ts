import { useAppStore } from '@/store/app-store';

/**
 * Authenticated fetch wrapper.
 * Automatically adds the X-User-Id header from the Zustand store
 * so server-side auth guards can verify the user's identity and role.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { currentUser } = useAppStore.getState();
  const headers = new Headers(init?.headers);

  if (currentUser?.id) {
    headers.set('X-User-Id', currentUser.id);
  }

  return fetch(input, { ...init, headers });
}