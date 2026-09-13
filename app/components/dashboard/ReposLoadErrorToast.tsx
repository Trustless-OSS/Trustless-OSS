'use client';

import { useEffect, useRef } from 'react';
import { handleError } from '@/lib/notifications';

export default function ReposLoadErrorToast({ message }: { message: string }) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    handleError(message, 'Failed to load repositories');
  }, [message]);

  return null;
}
