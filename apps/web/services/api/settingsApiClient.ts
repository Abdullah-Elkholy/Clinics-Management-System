/**
 * Settings API Client
 * Handles system settings including rate limit configuration
 */

import logger from '@/utils/logger';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Rate limit settings from the backend
 */
export interface RateLimitSettings {
    minSeconds: number;
    maxSeconds: number;
    enabled: boolean;
    estimatedSecondsPerMessage: number;
}

/**
 * Request to update rate limit settings
 */
export interface UpdateRateLimitRequest {
    minSeconds: number;
    maxSeconds: number;
    enabled: boolean;
}

/**
 * Get the stored auth token
 */
function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

/**
 * Create headers with auth token
 */
function getHeaders(): HeadersInit {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/**
 * Settings API client
 */
export const settingsApiClient = {
    /**
     * Get current rate limit settings
     */
    async getRateLimitSettings(): Promise<RateLimitSettings> {
        const response = await fetch(`${API_BASE}/api/settings/rate-limit`, {
            method: 'GET',
            headers: getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('Failed to get rate limit settings:', error);
            throw new Error(error || 'Failed to get rate limit settings');
        }

        return response.json();
    },

    /**
     * Update rate limit settings (admin only)
     */
    async updateRateLimitSettings(request: UpdateRateLimitRequest): Promise<RateLimitSettings> {
        const response = await fetch(`${API_BASE}/api/settings/rate-limit`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('Failed to update rate limit settings:', error);
            throw new Error(error || 'Failed to update rate limit settings');
        }

        return response.json();
    },
};

/**
 * Format time in Arabic for display
 * @param seconds - Time in seconds
 * @returns Formatted time string in Arabic
 */
export function formatTimeArabic(seconds: number): string {
    if (seconds <= 0) return '0 ثانية';

    if (seconds < 60) {
        return `${Math.round(seconds)} ثانية`;
    }

    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        if (secs > 0) {
            return `${mins} دقيقة و ${secs} ثانية`;
        }
        return `${mins} دقيقة`;
    }

    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (mins > 0) {
        return `${hours} ساعة و ${mins} دقيقة`;
    }
    return `${hours} ساعة`;
}

/**
 * Calculate estimated remaining time for a session
 * @param remainingMessages - Number of messages left to send
 * @param estimatedSecondsPerMessage - Estimated seconds per message from settings
 * @returns Total estimated seconds remaining
 */
export function calculateEstimatedTime(
    remainingMessages: number,
    estimatedSecondsPerMessage: number
): number {
    return remainingMessages * estimatedSecondsPerMessage;
}
