/**
 * Logs API Client
 * Handles fetching system logs from log files for admin monitoring
 */

import logger from '@/utils/logger';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Log entry from the backend
 */
export interface LogEntry {
    lineNumber: number;
    timestamp: string;
    level: string;
    levelArabic: string;
    message: string;
}

/**
 * Response from logs API
 */
export interface LogsResponse {
    logs: LogEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    message?: string;
}

/**
 * Log file info
 */
export interface LogFileInfo {
    name: string;
    sizeBytes: number;
    sizeFormatted: string;
    lastModified: string;
}

/**
 * Response from log files listing API
 */
export interface LogFilesResponse {
    files: LogFileInfo[];
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
 * Logs API client
 */
export const logsApiClient = {
    /**
     * Get system logs from log files with pagination
     * @param date Date in YYYYMMDD format (optional, defaults to today)
     * @param page Page number (1-indexed)
     * @param pageSize Number of log lines per page (default 25, max 100)
     * @param level Filter by level: All, INF, WRN, ERR
     */
    async getLogs(date?: string, page: number = 1, pageSize: number = 25, level: string = 'All', search?: string): Promise<LogsResponse> {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
            level
        });
        if (date) {
            params.append('date', date);
        }
        if (search) {
            params.append('search', search);
        }
        const response = await fetch(`${API_BASE}/api/logs?${params}`, {
            method: 'GET',
            headers: getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('Failed to get logs:', error);
            throw new Error(error || 'Failed to get logs');
        }

        return response.json();
    },

    /**
     * Get list of available log files
     */
    async getLogFiles(): Promise<LogFilesResponse> {
        const response = await fetch(`${API_BASE}/api/logs/files`, {
            method: 'GET',
            headers: getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('Failed to get log files:', error);
            throw new Error(error || 'Failed to get log files');
        }

        return response.json();
    },
};

/**
 * Get level badge color
 */
export function getLevelColor(level: string): string {
    switch (level) {
        case 'INF':
            return 'bg-blue-100 text-blue-800';
        case 'WRN':
            return 'bg-yellow-100 text-yellow-800';
        case 'ERR':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Get level icon
 */
export function getLevelIcon(level: string): string {
    switch (level) {
        case 'INF':
            return 'fa-info-circle text-blue-500';
        case 'WRN':
            return 'fa-exclamation-triangle text-yellow-500';
        case 'ERR':
            return 'fa-times-circle text-red-500';
        default:
            return 'fa-circle text-gray-500';
    }
}
