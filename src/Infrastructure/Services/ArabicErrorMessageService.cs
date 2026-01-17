using System;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for translating error messages to Arabic for end-users.
    /// All error messages stored in Message.ErrorMessage should be in Arabic.
    /// </summary>
    public interface IArabicErrorMessageService
    {
        /// <summary>
        /// Converts English provider error message to Arabic user-friendly message.
        /// </summary>
        /// <param name="providerResponse">Raw error from WhatsApp provider</param>
        /// <returns>Arabic error message</returns>
        string TranslateProviderError(string? providerResponse);

        /// <summary>
        /// Converts system exception message to Arabic user-friendly message.
        /// </summary>
        /// <param name="exception">System exception</param>
        /// <returns>Arabic error message</returns>
        string TranslateException(Exception exception);

        /// <summary>
        /// Gets Arabic message for quota exceeded scenario.
        /// </summary>
        /// <param name="availableQuota">Current available quota</param>
        /// <returns>Arabic error message</returns>
        string GetQuotaExceededMessage(long availableQuota);

        /// <summary>
        /// Gets Arabic message for authentication required scenario (PendingQR).
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetAuthenticationRequiredMessage();

        /// <summary>
        /// Gets Arabic message for invalid WhatsApp number.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetInvalidWhatsAppNumberMessage();

        /// <summary>
        /// Gets Arabic message for network/connection errors.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetNetworkErrorMessage();

        /// <summary>
        /// Gets Arabic message for extension not connected.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetExtensionNotConnectedMessage();

        /// <summary>
        /// Gets Arabic message for browser not open/detected.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetBrowserNotOpenMessage();

        /// <summary>
        /// Gets Arabic message for chat not found in WhatsApp.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetChatNotFoundMessage();

        /// <summary>
        /// Gets Arabic message for message send timeout.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetSendTimeoutMessage();

        /// <summary>
        /// Gets Arabic message for duplicate message prevention.
        /// </summary>
        /// <returns>Arabic error message</returns>
        string GetDuplicateMessageMessage();
    }

    public class ArabicErrorMessageService : IArabicErrorMessageService
    {
        public string TranslateProviderError(string? providerResponse)
        {
            if (string.IsNullOrWhiteSpace(providerResponse))
            {
                return "فشل الإرسال بدون سبب محدد من المزود";
            }

            var response = providerResponse.ToLowerInvariant();

            // Check for common provider error patterns
            if (response.Contains("pendingqr") || response.Contains("pending qr") || response.Contains("qr_pending"))
            {
                return GetAuthenticationRequiredMessage();
            }

            if (response.Contains("invalid number") || response.Contains("invalid phone") || response.Contains("number invalid"))
            {
                return GetInvalidWhatsAppNumberMessage();
            }

            if (response.Contains("rate limit") || response.Contains("too many") || response.Contains("ratelimit"))
            {
                return "تم تجاوز الحد الأقصى لعدد الرسائل المسموح إرسالها. يرجى الانتظار قليلاً والمحاولة لاحقاً";
            }

            if (response.Contains("not registered") || response.Contains("number not found") || response.Contains("not on whatsapp"))
            {
                return "رقم الواتساب غير مسجل أو غير موجود على الواتساب";
            }

            if (response.Contains("blocked") || response.Contains("banned"))
            {
                return "تم حظر الحساب من إرسال الرسائل. يرجى التواصل مع الدعم الفني";
            }

            // HTTP request timeout detection (more specific patterns first)
            if (response.Contains("request timeout") || response.Contains("request timed out") || 
                response.Contains("operation timed out") || response.Contains("connection timed out"))
            {
                return "انتهت مهلة الطلب. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى";
            }

            if (response.Contains("timeout") || response.Contains("timed out"))
            {
                return GetSendTimeoutMessage();
            }

            if (response.Contains("connection") || response.Contains("network") || response.Contains("offline"))
            {
                return GetNetworkErrorMessage();
            }

            if (response.Contains("quota") || response.Contains("limit exceeded"))
            {
                return "تم تجاوز الحد المسموح من الرسائل";
            }

            if (response.Contains("unauthorized") || response.Contains("authentication") || response.Contains("unauthenticated"))
            {
                return "خطأ في المصادقة. يرجى إعادة تسجيل الدخول أو مسح رمز QR";
            }

            if (response.Contains("extension") && (response.Contains("not connected") || response.Contains("disconnected")))
            {
                return GetExtensionNotConnectedMessage();
            }

            if (response.Contains("browser") && (response.Contains("closed") || response.Contains("not open")))
            {
                return GetBrowserNotOpenMessage();
            }

            if (response.Contains("chat not found") || response.Contains("contact not found") || response.Contains("no chat"))
            {
                return GetChatNotFoundMessage();
            }

            if (response.Contains("duplicate") || response.Contains("already sent") || response.Contains("already processed"))
            {
                return GetDuplicateMessageMessage();
            }

            if (response.Contains("input") && (response.Contains("not found") || response.Contains("missing")))
            {
                return "لم يتم العثور على حقل إدخال الرسالة. يرجى التأكد من فتح محادثة في الواتساب";
            }

            if (response.Contains("send button") && (response.Contains("not found") || response.Contains("missing")))
            {
                return "لم يتم العثور على زر الإرسال. يرجى التأكد من فتح محادثة في الواتساب";
            }

            if (response.Contains("not in chat") || response.Contains("no active chat"))
            {
                return "لا توجد محادثة نشطة. يرجى فتح محادثة أولاً";
            }

            if (response.Contains("media") && (response.Contains("failed") || response.Contains("error")))
            {
                return "فشل إرسال الوسائط. يرجى التحقق من نوع الملف والمحاولة مرة أخرى";
            }

            if (response.Contains("session") && (response.Contains("expired") || response.Contains("invalid")))
            {
                return "انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول";
            }

            if (response.Contains("command") && response.Contains("failed"))
            {
                return "فشل تنفيذ الأمر. يرجى المحاولة مرة أخرى";
            }

            if (response.Contains("failed") || response.Contains("error"))
            {
                // Try to extract a meaningful message
                return $"فشل الإرسال: {providerResponse}";
            }

            // Default: return original message with Arabic prefix
            return $"خطأ: {providerResponse}";
        }

        public string TranslateException(Exception exception)
        {
            if (exception == null)
            {
                return "حدث خطأ غير متوقع";
            }

            var message = exception.Message?.ToLowerInvariant() ?? "";

            // WhatsApp authentication required
            if (message.Contains("whatsapp session requires authentication") ||
                message.Contains("pendingqr") ||
                message.Contains("qr_pending"))
            {
                return GetAuthenticationRequiredMessage();
            }

            // Extension not connected
            if (message.Contains("extension not connected") ||
                message.Contains("no extension") ||
                message.Contains("extension disconnected"))
            {
                return GetExtensionNotConnectedMessage();
            }

            // Browser closed
            if (message.Contains("browser closed") ||
                message.Contains("browser not open") ||
                message.Contains("whatsapp web not open"))
            {
                return GetBrowserNotOpenMessage();
            }

            // Network/connection errors
            if (exception is System.Net.Http.HttpRequestException ||
                message.Contains("connection") ||
                message.Contains("network") ||
                message.Contains("timeout") ||
                message.Contains("offline"))
            {
                return GetNetworkErrorMessage();
            }

            // Validation errors
            if (exception is ArgumentException ||
                exception is ArgumentNullException ||
                message.Contains("validation") ||
                message.Contains("invalid"))
            {
                return "بيانات غير صالحة. يرجى التحقق من المعلومات المدخلة";
            }

            // Quota errors
            if (message.Contains("quota") || message.Contains("limit"))
            {
                return "تم تجاوز الحد المسموح من الرسائل";
            }

            // Unauthorized/forbidden
            if (exception is UnauthorizedAccessException ||
                message.Contains("unauthorized") ||
                message.Contains("forbidden") ||
                message.Contains("access denied"))
            {
                return "غير مصرح بهذا الإجراء. يرجى تسجيل الدخول مرة أخرى";
            }

            // Database errors
            if (message.Contains("database") ||
                message.Contains("sql") ||
                message.Contains("entity") ||
                message.Contains("concurrency"))
            {
                return "خطأ في قاعدة البيانات. يرجى المحاولة لاحقاً";
            }

            // Null reference
            if (exception is NullReferenceException)
            {
                return "خطأ في البيانات المطلوبة - قيمة مفقودة";
            }

            // Timeout exceptions (explicit TimeoutException or timeout-related TaskCanceledException)
            if (exception is TimeoutException)
            {
                return "انتهت مهلة الطلب. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى";
            }

            // Task cancelled - distinguish between timeout and manual cancellation
            if (exception is TaskCanceledException taskCanceledException)
            {
                // Check if it's a timeout-related cancellation
                if (taskCanceledException.CancellationToken.IsCancellationRequested == false ||
                    message.Contains("timeout") || message.Contains("timed out"))
                {
                    return "انتهت مهلة الطلب. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى";
                }
                return "تم إلغاء العملية";
            }

            if (exception is OperationCanceledException)
            {
                return "تم إلغاء العملية";
            }

            // Default: generic error with exception type
            return $"حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى";
        }

        public string GetQuotaExceededMessage(long availableQuota)
        {
            if (availableQuota <= 0)
            {
                return "نفذت كمية الرسائل المتاحة. يرجى التواصل مع الإدارة لزيادة الكمية";
            }

            return $"تجاوزت عدد الرسائل المسموح به. المتاح حالياً: {availableQuota} رسالة";
        }

        public string GetAuthenticationRequiredMessage()
        {
            return "مطلوب مسح رمز QR لإعادة المصادقة على حساب الواتساب. يرجى الذهاب إلى صفحة المصادقة";
        }

        public string GetInvalidWhatsAppNumberMessage()
        {
            return "رقم الواتساب غير صحيح أو غير مسجل على الواتساب";
        }

        public string GetNetworkErrorMessage()
        {
            return "خطأ في الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى";
        }

        public string GetExtensionNotConnectedMessage()
        {
            return "إضافة الواتساب غير متصلة. يرجى التأكد من تثبيت الإضافة وتفعيلها في المتصفح";
        }

        public string GetBrowserNotOpenMessage()
        {
            return "متصفح الواتساب غير مفتوح. يرجى فتح web.whatsapp.com في المتصفح";
        }

        public string GetChatNotFoundMessage()
        {
            return "لم يتم العثور على المحادثة. يرجى التأكد من وجود الرقم في جهات الاتصال";
        }

        public string GetSendTimeoutMessage()
        {
            return "انتهت مهلة إرسال الرسالة. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى";
        }

        public string GetDuplicateMessageMessage()
        {
            return "تم إرسال هذه الرسالة مسبقاً - تم تجاهل الطلب المكرر";
        }
    }
}
