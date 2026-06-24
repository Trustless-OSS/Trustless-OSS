'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EscrowEvent, EscrowEventType } from '@/app/lib/eventStream';
import { getEventBadge, relativeTime } from '@/app/lib/eventStream';

const MAX_EVENTS_PER_SEC = 10;
const EVENT_BUFFER_MS = 1000;

export default function EscrowEventLog() {
  const [events, setEvents] = useState<EscrowEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const bufferRef = useRef<EscrowEvent[]>([]);
  const lastFlushRef = useRef(Date.now());
  const supabase = useMemo(() => createClient(), []);

  // Debounced batch flush: never more than MAX_EVENTS_PER_SEC
  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const now = Date.now();
    if (now - lastFlushRef.current < EVENT_BUFFER_MS / MAX_EVENTS_PER_SEC) {
      // Wait for the next tick
      return;
    }
    lastFlushRef.current = now;
    const batch = bufferRef.current.splice(0, MAX_EVENTS_PER_SEC);
    setEvents((prev) => [...batch, ...prev].slice(0, 1000));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('escrow-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'escrow_events' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const event: EscrowEvent = {
            id: (row.id as string) ?? crypto.randomUUID(),
            type: (row.type as EscrowEventType) ?? 'RULE_UPDATE',
            actor: (row.actor as string) ?? 'unknown',
            actorAvatar: row.actor_avatar as string | undefined,
            description: (row.description as string) ?? '',
            timestamp: (row.timestamp as string) ?? new Date().toISOString(),
            repoFullName: row.repo_full_name as string | undefined,
            txHash: row.tx_hash as string | undefined,
          };
          bufferRef.current.push(event);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Flush timer
  useEffect(() => {
    const timer = setInterval(flushBuffer, 100);
    return () => clearInterval(timer);
  }, [flushBuffer]);

  const clearHistory = (): void => {
    setEvents([]);
    bufferRef.current = [];
  };

  return (
    <div className="bg-white brutal-border brutal-shadow flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-slate-950 px-4 py-3">
        <div>
          <h2 className="title-brutal text-lg text-slate-950">
            ESCROW EVENT LOGS{' '}
            <span className="label-brutal bg-slate-950 text-white text-xs px-2">
              WEB3 EXECUTIONS
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-mono font-bold uppercase mt-1">
            {connected ? '● LIVE' : '○ DISCONNECTED'}
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="brutal-button-outline px-3 py-1.5 text-xs font-bold font-mono uppercase"
          aria-label="Clear custom log history"
        >
          CLEAR CUSTOM LOG HISTORY
        </button>
      </div>

      {/* Event List */}
      <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
        {events.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 font-mono font-bold uppercase text-sm">
              NO_EVENTS_RECEIVED
            </p>
            <p className="text-slate-300 text-xs mt-1">Waiting for escrow events...</p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-slate-200">
            {events.map((event) => (
              <li key={event.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-slate-950 text-white flex items-center justify-center border-2 border-slate-950 font-black text-sm shrink-0">
                    {event.actorAvatar ? (
                      <img
                        src={event.actorAvatar}
                        alt={event.actor}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (event.actor[0]?.toUpperCase() ?? '?')
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-950">{event.actor}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 border-2 border-slate-950 uppercase ${getEventBadge(event.type)}`}
                      >
                        {event.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 ml-auto">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-2">{event.description}</p>
                    {event.txHash && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                        TX: {event.txHash.slice(0, 10)}...
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-4 border-slate-950 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {connected ? '● LIVE' : '○ RECONNECTING'}
        </span>
      </div>
    </div>
  );
}
