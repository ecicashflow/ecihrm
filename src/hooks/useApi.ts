import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions<T> {
  url: string | null;
  fallback?: T;
  enabled?: boolean;
  errorMessage?: string;
}

interface UseApiResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>({ url, fallback, enabled = true, errorMessage }: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T | undefined>(fallback);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) {
      setIsLoading(false);
      if (fallback) setData(fallback);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setIsError(true);
      setError(errorMessage || 'Connection issue. Using cached data.');
      if (fallback) setData(fallback);
      console.warn(`[useApi] Failed to fetch ${url}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [url, enabled, fallback, errorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, isError, error, refetch: fetchData };
}

// For POST/PUT/DELETE mutations
export function useMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (url: string, options?: RequestInit) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error, setError };
}
