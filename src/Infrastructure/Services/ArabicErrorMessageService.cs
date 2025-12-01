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
            if (response.Contains("pendingqr") || response.Contains("pending qr"))
            {
                return GetAuthenticationRequiredMessage();
            }

            if (response.Contains("invalid number") || response.Contains("invalid phone"))
            {
                return GetInvalidWhatsAppNumberMessage();
            }

            if (response.Contains("rate limit") || response.Contains("too many"))
            {
                return "تم تجاوز الحد الأقصى لعدد الرسائل المسموح إرسالها. يرجى المحاولة لاحقاً";
            }

            if (response.Contains("not registered") || response.Contains("number not found"))
            {
                return "رقم الواتساب غير مسجل أو غير صحيح";
            }

            if (response.Contains("blocked") || response.Contains("banned"))
            {
                return "تم حظر الحساب من إرسال الرسائل. يرجى التواصل مع الدعم الفني";
            }

            if (response.Contains("timeout") || response.Contains("timed out"))
            {
                return "انتهت مهلة الاتصال. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى";
            }

            if (response.Contains("connection") || response.Contains("network"))
            {
                return GetNetworkErrorMessage();
            }

            if (response.Contains("quota") || response.Contains("limit exceeded"))
            {
                return "تم تجاوز الحد المسموح من الرسائل";
            }

            if (response.Contains("unauthorized") || response.Contains("authentication"))
            {
                return "خطأ في المصادقة. يرجى إعادة تسجيل الدخول";
            }

            if (response.Contains("failed") || response.Contains("error"))
            {
                return $"فشل الإرسال: {providerResponse}";
            }

            // Default: return original message with Arabic prefix
            return $"خطأ من المزود: {providerResponse}";
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
                message.Contains("pendingqr"))
            {
                return GetAuthenticationRequiredMessage();
            }

            // Network/connection errors
            if (exception is System.Net.Http.HttpRequestException ||
                message.Contains("connection") ||
                message.Contains("network") ||
                message.Contains("timeout"))
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
                message.Contains("forbidden"))
            {
                return "غير مصرح بهذا الإجراء";
            }

            // Database errors
            if (message.Contains("database") ||
                message.Contains("sql") ||
                message.Contains("entity"))
            {
                return "خطأ في قاعدة البيانات. يرجى المحاولة لاحقاً";
            }

            // Null reference
            if (exception is NullReferenceException)
            {
                return "خطأ في البيانات المطلوبة";
            }

            // Default: generic error with exception type
            return $"حدث خطأ: {exception.GetType().Name}";
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
            return "مطلوب مسح رمز QR لإعادة المصادقة على حساب الواتساب";
        }

        public string GetInvalidWhatsAppNumberMessage()
        {
            return "رقم الواتساب غير صحيح أو غير مسجل على الواتساب";
        }

        public string GetNetworkErrorMessage()
        {
            return "خطأ في الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى";
        }
    }
}
