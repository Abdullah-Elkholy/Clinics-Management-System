using System;

namespace Clinics.Domain
{
    /// <summary>
    /// Marker interface for entities supporting soft-delete.
    /// </summary>
    public interface ISoftDeletable
    {
        bool IsDeleted { get; set; }
        DateTime? DeletedAt { get; set; }
        int? DeletedBy { get; set; }
        DateTime? RestoredAt { get; set; }
        int? RestoredBy { get; set; }
    }

    /// <summary>
    /// Marker interface for entities with audit trail support.
    /// </summary>
    public interface IAuditable
    {
        DateTime CreatedAt { get; set; }
        int? CreatedBy { get; set; }
        DateTime? UpdatedAt { get; set; }
        int? UpdatedBy { get; set; }
    }

    /// <summary>
    /// Enum for audit log action types.
    /// </summary>
    public enum AuditAction
    {
        Create = 0,
        Update = 1,
        SoftDelete = 2,
        Restore = 3,
        Purge = 4,
        ToggleDefault = 5,
        QuotaConsume = 6,
        QuotaRelease = 7,
        RestoreBlocked = 8,
        Other = 99
    }
}
