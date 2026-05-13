import { toast } from 'sonner';

/**
 * A structured way to handle and display errors using sonner.
 * This ensures consistency across the application.
 */
export const handleError = (error: any, context?: string) => {
  console.error(`[Error]${context ? ` in ${context}:` : ''}`, error);

  const message = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : 'An unexpected error occurred';

  toast.error(context || 'Error', {
    description: message,
    duration: 5000,
  });
};

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
