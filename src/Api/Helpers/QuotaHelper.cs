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
    /// For messages quota, converts long to int (safe for API since -1 fits in int).
    /// </summary>
    public static int ToApiMessagesQuota(long dbQuota)
    {
        return dbQuota == -1 ? -1 : (int)dbQuota;
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

