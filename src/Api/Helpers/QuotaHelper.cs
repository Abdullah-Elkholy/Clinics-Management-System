namespace Clinics.Api.Helpers;

/// <summary>
/// Helper class for handling quota values.
/// -1 represents unlimited quota in both API and database.
/// No conversion needed - -1 is the standard representation for unlimited.
/// </summary>
public static class QuotaHelper
{
    /// <summary>
    /// Convert API quota value to database format.
    /// -1 (unlimited) is passed through as-is.
    /// For messages quota, accepts long to support large values up to JavaScript's MAX_SAFE_INTEGER.
    /// </summary>
    public static long ToDbMessagesQuota(long apiQuota)
    {
        return apiQuota; // -1 is unlimited, otherwise use the value directly
    }

    /// <summary>
    /// Convert database quota value to API format.
    /// -1 (unlimited) is passed through as-is.
    /// For messages quota, converts long to long (no conversion needed, but caps at int.MaxValue for consistency).
    /// Values greater than int.MaxValue are capped to int.MaxValue to prevent issues in frontend.
    /// </summary>
    public static long ToApiMessagesQuota(long dbQuota)
    {
        if (dbQuota == -1) return -1;
        // Cap at int.MaxValue to prevent overflow issues in frontend (JavaScript number precision)
        // Frontend uses int.MaxValue (2147483647) as the maximum safe value
        if (dbQuota > int.MaxValue) return int.MaxValue;
        return dbQuota;
    }

    /// <summary>
    /// Convert API quota value to database format for queues.
    /// -1 (unlimited) is passed through as-is.
    /// </summary>
    public static int ToDbQueuesQuota(int apiQuota)
    {
        return apiQuota; // -1 is unlimited, otherwise use the value directly
    }

    /// <summary>
    /// Convert database quota value to API format for queues.
    /// -1 (unlimited) is passed through as-is.
    /// </summary>
    public static int ToApiQueuesQuota(int dbQuota)
    {
        return dbQuota; // -1 is unlimited, otherwise use the value directly
    }
}

