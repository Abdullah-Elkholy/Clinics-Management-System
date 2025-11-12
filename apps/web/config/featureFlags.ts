/**
 * Feature Flags & Runtime Configuration
 * 
 * Environment Variables:
 * - NEXT_PUBLIC_USE_MOCK_DATA: When true, uses local mock data instead of live backend endpoints.
 *   Useful for development, testing, and when backend is unavailable.
 *   Set in .env.local or via deployment environment.
 */

/**
 * Returns true if mock data mode is enabled.
 * Reads from NEXT_PUBLIC_USE_MOCK_DATA environment variable.
 * Defaults to false in production (must be explicitly enabled).
 */
export const isUseMockData = (): boolean => {
  if (typeof window === 'undefined') {
    // Server-side: check Node process env
    return process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  }
  // Client-side: check window or fallback
  return (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true');
};

/**
 * Memoized flag for mock data mode (call once per session)
 */
let cachedUseMockData: boolean | null = null;

export const getCachedUseMockData = (): boolean => {
  if (cachedUseMockData === null) {
    cachedUseMockData = isUseMockData();
  }
  return cachedUseMockData;
};

/**
 * Feature Flags
 */
export const featureFlags = {
  /**
   * When true, fetch templates and conditions from mock data instead of backend.
   * On backend failures, automatically falls back to mock data even if flag is false.
   */
  USE_MOCK_DATA: getCachedUseMockData(),

  /**
   * When true, enable verbose logging for data mutations (create/update/delete).
   * Useful for debugging data flow issues.
   */
  DEBUG_MUTATIONS: process.env.NEXT_PUBLIC_DEBUG_MUTATIONS === 'true',
};

export default featureFlags;
