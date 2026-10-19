import { toast } from 'sonner';

/**
 * A structured way to handle and display errors using sonner.
 * This ensures consistency across the application.
 */
export const handleError = (error: unknown, context?: string) => {
  const message = extractUserFriendlyMessage(error);

  // Only log in development or if there's a message
  if (process.env.NODE_ENV === 'development' || message) {
    console.error(`[Error]${context ? ` in ${context}:` : ''}`, message);
  }

  toast.error(context || 'Error', {
    description: message,
    duration: 5000,
  });
};

/**
 * Convert technical error messages into user-friendly messages
 */
function extractUserFriendlyMessage(error: unknown): string {
  let errorText = '';

  // Extract message from various error formats
  if (error instanceof Error) {
    errorText = error.message;
  } else if (typeof error === 'string') {
    errorText = error;
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    errorText = (obj.message || obj.error || JSON.stringify(error)) as string;
  }

  // Sanitize and convert technical messages to user-friendly ones
  const sanitized = sanitizeErrorMessage(errorText);
  return sanitized || 'An unexpected error occurred';
}

/**
 * Sanitize technical error messages and convert to user-friendly format
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return '';

  // Remove wallet addresses and technical details
  const cleaned = message
    .replace(/0x[a-fA-F0-9]{40,}/g, '[wallet address]')
    .replace(/G[A-Z0-9]{55,}/g, '[stellar account]')
    .replace(/\{.*\}/g, '')
    .replace(/\/deployer\/[a-z-]+/g, '[service]')
    .replace(/\d{4}-\d{2}-\d{2}T.*Z/g, '[timestamp]');

  // Map common backend errors to friendly messages
  const errorMappings: Record<string, string> = {
    'account not found': 'The wallet account could not be found. Please check your wallet setup.',
    'insufficient funds': 'Insufficient funds in your wallet. Please add more USDC.',
    'invalid signature': 'The transaction signature is invalid. Please try again.',
    'network error': 'A network error occurred. Please check your connection and try again.',
    timeout: 'The request took too long. Please try again.',
    unauthorized: 'You do not have permission to perform this action.',
    'bad request': 'Invalid request. Please check your input and try again.',
    'not found': 'The requested resource was not found.',
    'internal server error': 'An unexpected error occurred on the server. Please try again later.',
  };

  // Check if message matches any known error patterns
  for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
    if (cleaned.toLowerCase().includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // Return cleaned message if no mapping found
  return cleaned.length > 0 ? cleaned : 'An unexpected error occurred';
}

/**
 * Success notification utility
 */
export const notifySuccess = (title: string, message?: string) => {
  toast.success(title, {
    description: message,
    duration: 3000,
  });
};

/**
 * Loading state notification helper
 */
export const notifyLoading = (message: string) => {
  return toast.loading(message);
};

export { toast };
