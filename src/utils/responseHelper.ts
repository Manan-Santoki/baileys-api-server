import type { Response } from 'express';
import type { ApiResponse } from '../types';

/**
 * Send a success response
 */
export function sendSuccess<T>(res: Response, data: T, extraFields: Record<string, unknown> = {}): void {
  const response: ApiResponse<T> = {
    success: true,
    ...extraFields,
  };

  // If data is an object with specific keys, spread them at the top level
  // This matches the wwebjs-api response format
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(response, data);
  } else if (data !== undefined) {
    response.data = data;
  }

  res.json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 500,
  message?: string
): void {
  const response: ApiResponse = {
    success: false,
    error,
    message: message || error,
  };
  res.status(statusCode).json(response);
}

/**
 * Send a session not found error
 */
export function sendSessionNotFound(res: Response, sessionId: string): void {
  sendError(res, `Session not found: ${sessionId}`, 404, 'session_not_found');
}

/**
 * Send a session not connected error
 */
export function sendSessionNotConnected(res: Response, sessionId: string): void {
  sendError(res, `Session not connected: ${sessionId}`, 400, 'session_not_connected');
}

/**
 * Send a validation error
 */
export function sendValidationError(res: Response, message: string): void {
  sendError(res, message, 400, 'validation_error');
}

/**
 * Wrap async controller functions to handle errors
 */
export function asyncHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const [, res] = args as [unknown, Response];
      if (res && typeof res.status === 'function') {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        sendError(res, errorMessage, 500);
      }
    }
  }) as T;
}
