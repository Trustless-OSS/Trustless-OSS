export const SUPPORT_CATEGORIES = [
  { value: 'general', label: 'General Question' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'bounty', label: 'Bounty Setup' },
  { value: 'escrow', label: 'Escrow Help' },
  { value: 'payment', label: 'Payment Issue' },
  { value: 'integration', label: 'Integration' },
  { value: 'bug', label: 'Report Bug' },
  { value: 'feature', label: 'Feature Request' },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value'];

export interface SupportRequest {
  org?: string;
  category: SupportCategory;
  subject: string;
  message: string;
  attachment?: string;
}

export interface StoredSupportRequest extends SupportRequest {
  id: string;
  timestamp: string;
}

export function isSupportCategory(value: string): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((category) => category.value === value);
}
