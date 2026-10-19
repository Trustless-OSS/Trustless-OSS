'use client';

import { useEffect, useState } from 'react';
import { fetchActivity } from '@/lib/dashboard-api';
import type { ActivityRow } from '@/app/components/dashboard/activity';

export type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

export function useActivity(): AsyncState<ActivityRow[]> {
  const [state, setState] = useState<AsyncState<ActivityRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    fetchActivity()
      .then((rows) => active && setState({ data: rows, loading: false, error: null }))
      .catch(
        (e) =>
          active &&
          setState({ data: null, loading: false, error: e?.message || 'Failed to load activity.' })
      );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
