/**
 * PauseReason Translation Utility
 * Translates backend pause reason codes to Arabic UI text
 */

export const PAUSE_REASON_TRANSLATIONS: Record<string, string> = {
    // Connection status reasons
    'PendingQR': 'بانتظار مسح رمز QR',
    'pending_qr': 'بانتظار مسح رمز QR',
    'PendingNET': 'انقطاع في الاتصال',
    'pending_net': 'انقطاع في الاتصال',
    'BrowserClosure': 'تم إغلاق المتصفح',
    'browser_closed': 'تم إغلاق المتصفح',
    'disconnected': 'غير متصل',

    // User action reasons
    'UserPaused': 'تم الإيقاف بواسطة المستخدم',
    'GlobalPause': 'تم إيقاف جميع المهام',
    'CheckWhatsApp': 'جاري التحقق من WhatsApp',

    // System reasons
    'QuotaExceeded': 'تم تجاوز الحصة',
    'RateLimited': 'تم تحديد معدل الإرسال',
    'SessionExpired': 'انتهت صلاحية الجلسة',
    'MaintenanceMode': 'وضع الصيانة',
};

/**
 * Translates a pause reason code to Arabic text
 * @param reason - The backend pause reason code
 * @returns Translated Arabic text, or the original reason if no translation exists
 */
export function translatePauseReason(reason: string | null | undefined): string {
    if (!reason) return 'تم الإيقاف المؤقت';

    // Check for exact match first
    if (PAUSE_REASON_TRANSLATIONS[reason]) {
        return PAUSE_REASON_TRANSLATIONS[reason];
    }

    // Check for partial matches (includes)
    for (const [key, translation] of Object.entries(PAUSE_REASON_TRANSLATIONS)) {
        if (reason.includes(key)) {
            return translation;
        }
    }

    // Return original if no translation found
    return reason;
}

/**
 * Gets the icon class for a pause reason
 */
export function getPauseReasonIcon(reason: string | null | undefined): string {
    if (!reason) return 'fa-pause-circle';

    if (reason.includes('PendingQR') || reason.includes('pending_qr')) {
        return 'fa-qrcode';
    }
    if (reason.includes('PendingNET') || reason.includes('pending_net') || reason.includes('disconnected')) {
        return 'fa-wifi';
    }
    if (reason.includes('BrowserClosure') || reason.includes('browser_closed')) {
        return 'fa-window-close';
    }
    if (reason.includes('CheckWhatsApp')) {
        return 'fa-search';
    }

    return 'fa-pause-circle';
}

/**
 * Gets the color class for a pause reason
 */
export function getPauseReasonColor(reason: string | null | undefined): string {
    if (!reason) return 'text-yellow-500';

    if (reason.includes('PendingQR') || reason.includes('pending_qr')) {
        return 'text-orange-500';
    }
    if (reason.includes('PendingNET') || reason.includes('pending_net') || reason.includes('disconnected')) {
        return 'text-red-500';
    }
    if (reason.includes('BrowserClosure') || reason.includes('browser_closed')) {
        return 'text-red-600';
    }
    if (reason.includes('CheckWhatsApp')) {
        return 'text-blue-500';
    }

    return 'text-yellow-500';
}
