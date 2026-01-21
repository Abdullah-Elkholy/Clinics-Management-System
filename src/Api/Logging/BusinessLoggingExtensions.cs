using Microsoft.Extensions.Logging;

namespace Clinics.Api.Logging;

public static class BusinessLoggingExtensions
{
    /// <summary>
    /// Standard business log entry.
    /// These events are routed by Serilog based on the "[Business]" prefix.
    /// </summary>
    public static void LogBusinessInformation(this ILogger logger, string messageTemplate, params object?[] propertyValues)
    {
        logger.LogInformation("[Business] " + messageTemplate, propertyValues);
    }

    public static void LogBusinessError(this ILogger logger, Exception exception, string messageTemplate, params object?[] propertyValues)
    {
        logger.LogError(exception, "[Business] " + messageTemplate, propertyValues);
    }
}
