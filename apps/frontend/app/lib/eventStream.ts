export type EscrowEventType =
  | 'RULE_UPDATE'
  | 'LOCK_DEPOSIT'
  | 'MILESTONE_CREATED'
  | 'PAYOUT_RELEASED'
  | 'CANNON'
  | 'FLASHLOAN-ARBITRAGE';

export interface EscrowEvent {
  id: string;
  type: EscrowEventType;
  actor: string;
  actorAvatar?: string;
  description: string;
  timestamp: string; // ISO 8601
  repoFullName?: string;
  txHash?: string;
}

const EVENT_TYPE_BADGE: Record<EscrowEventType, string> = {
  RULE_UPDATE: 'bg-blue-600 text-white',
  LOCK_DEPOSIT: 'bg-green-600 text-white',
  MILESTONE_CREATED: 'bg-purple-600 text-white',
  PAYOUT_RELEASED: 'bg-amber-600 text-white',
  CANNON: 'bg-red-600 text-white',
  'FLASHLOAN-ARBITRAGE': 'bg-cyan-600 text-white',
};

export function getEventBadge(type: EscrowEventType): string {
  return EVENT_TYPE_BADGE[type];
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  if (diff < 0) return 'Just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
