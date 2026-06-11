import { Alert, Platform } from 'react-native';

/**
 * Global error handler for Supabase and network operations
 * Provides structured logging and user-friendly error messages
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  details?: Record<string, any>;
}

/**
 * Categorize errors for appropriate user messaging and logging
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error object for internal logging
 */
export interface AppError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  originalError?: any;
  context?: ErrorContext;
  timestamp: string;
  platform: string;
}

/**
 * Classify error based on type and message
 */
function classifyError(error: any): ErrorCategory {
  if (!error) return ErrorCategory.UNKNOWN;

  const message = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
  const code = error?.code?.toUpperCase() || error?.status?.toString() || '';

  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('failed to fetch') ||
    code === 'NETWORK_ERROR' ||
    code === 'ENOTFOUND'
  ) {
    return ErrorCategory.NETWORK;
  }

  // Auth errors
  if (
    message.includes('auth') ||
    message.includes('unauthorized') ||
    message.includes('401') ||
    code === 'PGRST401' ||
    code === '401'
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  // Permission errors
  if (
    message.includes('permission') ||
    message.includes('403') ||
    message.includes('forbidden') ||
    code === 'PGRST403' ||
    code === '403'
  ) {
    return ErrorCategory.PERMISSION;
  }

  // Not found errors
  if (
    message.includes('not found') ||
    message.includes('404') ||
    code === 'PGRST404' ||
    code === '404'
  ) {
    return ErrorCategory.NOT_FOUND;
  }

  // Validation errors
  if (
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('400') ||
    code === 'PGRST400' ||
    code === '400'
  ) {
    return ErrorCategory.VALIDATION;
  }

  // Server errors
  if (message.includes('500') || code === 'PGRST500' || code === '500') {
    return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly message based on error category
 */
function getUserMessage(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorCategory.AUTHENTICATION:
      return 'Your session has expired. Please sign in again.';
    case ErrorCategory.PERMISSION:
      return 'You do not have permission to perform this action.';
    case ErrorCategory.NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorCategory.VALIDATION:
      return 'Invalid input. Please check your data and try again.';
    case ErrorCategory.SERVER:
      return 'The server encountered an error. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Main error handler function
 * Logs errors and returns structured information
 */
export function handleError(error: any, context: ErrorContext): AppError {
  const category = classifyError(error);
  const userMessage = getUserMessage(category);

  const appError: AppError = {
    category,
    message: error?.message || error?.toString?.() || 'Unknown error',
    userMessage,
    originalError: error,
    context,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
  };

  // Log to console with context
  console.error('[AppError]', {
    category: appError.category,
    operation: context.operation,
    component: context.component,
    message: appError.message,
    code: error?.code,
    details: context.details,
    timestamp: appError.timestamp,
  });

  // TODO: In production, send to monitoring service (Sentry, LogRocket, etc.)
  // sendToMonitoring(appError);

  return appError;
}

/**
 * Show error alert to user
 */
export function showErrorAlert(error: AppError, onDismiss?: () => void): void {
  Alert.alert(
    'Error',
    error.userMessage,
    [
      {
        text: 'OK',
        onPress: onDismiss || (() => {}),
      },
    ],
    { cancelable: false }
  );
}

/**
 * Show error alert with retry option
 */
export function showErrorAlertWithRetry(
  error: AppError,
  onRetry: () => void,
  onDismiss?: () => void
): void {
  Alert.alert(
    'Error',
    error.userMessage,
    [
      {
        text: 'Dismiss',
        onPress: onDismiss || (() => {}),
      },
      {
        text: 'Retry',
        onPress: onRetry,
        isPreferred: true,
      },
    ],
    { cancelable: false }
  );
}

/**
 * Wrap async operations with error handling
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<{ success: boolean; data?: T; error?: AppError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = handleError(error, context);
    return { success: false, error: appError };
  }
}

/**
 * Wrap sync operations with error handling
 */
export function safeSyncOperation<T>(
  operation: () => T,
  context: ErrorContext
): { success: boolean; data?: T; error?: AppError } {
  try {
    const data = operation();
    return { success: true, data };
  } catch (error) {
    const appError = handleError(error, context);
    return { success: false, error: appError };
  }
}

/**
 * Format error for display in UI (toast, inline message, etc.)
 */
export function formatErrorMessage(error: AppError): string {
  if (error.category === ErrorCategory.NETWORK) {
    return 'Network connection lost. Please check your internet.';
  }
  return error.userMessage;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  return [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
    ErrorCategory.UNKNOWN,
  ].includes(error.category);
}

/**
 * Check if error requires authentication refresh
 */
export function requiresAuthRefresh(error: AppError): boolean {
  return error.category === ErrorCategory.AUTHENTICATION;
}
