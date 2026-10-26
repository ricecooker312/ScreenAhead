import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

/** Loads data with loading / error / reload state. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fn();
      if (mounted.current) setData(d);
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
