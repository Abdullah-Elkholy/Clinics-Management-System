using System;

namespace Clinics.Tests.Common
{
    /// <summary>
    /// Provides deterministic time for testing (e.g., appointment overlap scenarios).
    /// Allows tests to control the current time for time-sensitive logic.
    /// </summary>
    public interface ISystemClock
    {
        DateTime UtcNow { get; }
    }

    /// <summary>
    /// Default system clock (uses actual time).
    /// </summary>
    public class SystemClock : ISystemClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    /// <summary>
    /// Test clock with settable time (for deterministic test scenarios).
    /// </summary>
    public class TestClock : ISystemClock
    {
        public DateTime UtcNow { get; set; } = new(2025, 1, 15, 10, 0, 0, DateTimeKind.Utc);

        /// <summary>
        /// Advance the test clock by the specified duration.
        /// </summary>
        public TestClock Advance(TimeSpan duration)
        {
            UtcNow = UtcNow.Add(duration);
            return this;
        }

        /// <summary>
        /// Set the test clock to a specific date/time.
        /// </summary>
        public TestClock SetTo(DateTime dateTime)
        {
            UtcNow = dateTime.Kind == DateTimeKind.Utc
                ? dateTime
                : DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
            return this;
        }
    }
}
