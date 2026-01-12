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

    // AuditAction enum REMOVED: No longer used after AuditLog removal
}

