using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Clinics.Domain;

namespace Clinics.Infrastructure
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        // Database provider detection for multi-database support
        public bool IsPostgreSql => Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;

        // Helper method to get the correct UTC timestamp function based on provider
        private string GetUtcNowSql() => IsPostgreSql ? "NOW()" : "SYSUTCDATETIME()";

        // Helper method to get proper column quoting based on provider
        // PostgreSQL uses "double quotes", SQL Server uses [brackets]
        private string GetQuotedColumn(string column) => IsPostgreSql ? $"\"{column}\"" : $"[{column}]";

        public DbSet<User> Users => Set<User>();
        public DbSet<Queue> Queues => Set<Queue>();
        public DbSet<Patient> Patients => Set<Patient>();
        public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
        public DbSet<Message> Messages => Set<Message>();
        // FailedTasks DbSet REMOVED: Failures now tracked via Message.Status
        public DbSet<Quota> Quotas => Set<Quota>();
        public DbSet<Session> Sessions => Set<Session>();
        public DbSet<WhatsAppSession> WhatsAppSessions => Set<WhatsAppSession>();
        public DbSet<MessageSession> MessageSessions => Set<MessageSession>();
        // ModeratorSettings DbSet REMOVED - entity deprecated
        // AuditLogs DbSet REMOVED: No longer used
        public DbSet<PhoneWhatsAppRegistry> PhoneWhatsAppRegistry => Set<PhoneWhatsAppRegistry>();

        // Extension Runner entities
        public DbSet<ExtensionDevice> ExtensionDevices => Set<ExtensionDevice>();
        public DbSet<ExtensionPairingCode> ExtensionPairingCodes => Set<ExtensionPairingCode>();
        public DbSet<ExtensionSessionLease> ExtensionSessionLeases => Set<ExtensionSessionLease>();
        public DbSet<ExtensionCommand> ExtensionCommands => Set<ExtensionCommand>();

        // System settings for rate limiting and other admin-configurable options
        public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<Queue>().HasIndex(q => q.DoctorName);
            modelBuilder.Entity<Queue>().HasIndex(q => q.ModeratorId);
            modelBuilder.Entity<Patient>().HasIndex(p => new { p.QueueId, p.Position });

            modelBuilder.Entity<Patient>()
                .HasOne(p => p.Queue)
                .WithMany()
                .HasForeignKey(p => p.QueueId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<MessageTemplate>()
                .HasOne(t => t.Queue)
                .WithMany()
                .HasForeignKey(t => t.QueueId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Queue)
                .WithMany()
                .HasForeignKey(m => m.QueueId)
                .OnDelete(DeleteBehavior.Restrict);
            // FailedTask configuration REMOVED
            modelBuilder.Entity<Quota>()
                .HasOne(q => q.Moderator)
                .WithMany()
                .HasForeignKey(q => q.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<MessageSession>()
                .HasOne(s => s.Queue)
                .WithMany()
                .HasForeignKey(s => s.QueueId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageSession>()
                .HasOne(s => s.Moderator)
                .WithMany()
                .HasForeignKey(s => s.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageSession>().HasIndex(s => s.ModeratorId);

            modelBuilder.Entity<Queue>()
                .HasOne(q => q.Moderator)
                .WithMany()
                .HasForeignKey(q => q.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageTemplate>().HasIndex(t => t.CreatedBy);
            modelBuilder.Entity<MessageTemplate>().HasIndex(t => t.ModeratorId);
            modelBuilder.Entity<MessageTemplate>()
                .HasOne(t => t.Moderator)
                .WithMany()
                .HasForeignKey(t => t.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>().HasIndex(m => new { m.Status, m.CreatedAt });
            modelBuilder.Entity<Message>().HasIndex(m => m.ModeratorId);
            modelBuilder.Entity<Message>().HasIndex(m => m.SessionId);
            modelBuilder.Entity<Message>().HasIndex(m => new { m.IsPaused, m.Status });

            // Performance: Composite indexes for ongoing/retry queries
            modelBuilder.Entity<Message>().HasIndex(m => new { m.SessionId, m.Status, m.IsPaused, m.IsDeleted });
            modelBuilder.Entity<Message>().HasIndex(m => new { m.ModeratorId, m.Status, m.IsPaused });
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Moderator)
                .WithMany()
                .HasForeignKey(m => m.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            // Fix: Disable OUTPUT clause for Messages table due to database triggers
            // SQL Server doesn't allow OUTPUT clause on tables with enabled triggers
            // See: https://aka.ms/efcore-docs-sqlserver-save-changes-and-output-clause
            // Note: UseSqlOutputClause is SQL Server-specific, skip for PostgreSQL
            if (!IsPostgreSql)
            {
                modelBuilder.Entity<Message>()
                    .ToTable(tb => tb.UseSqlOutputClause(false));
            }

            // FailedTask indexes REMOVED - entity deleted

            // Quota: enforce one-to-one with Moderator via unique index
            modelBuilder.Entity<Quota>().HasIndex(q => q.ModeratorUserId).IsUnique();

            // FailedTask configuration REMOVED - failures tracked via Message.Status

            // MessageCondition: enforce exactly one DEFAULT condition per queue via filtered unique index
            modelBuilder.Entity<MessageCondition>()
                .HasIndex(c => new { c.QueueId, c.Operator })
                .IsUnique()
                .HasFilter($"{GetQuotedColumn("Operator")} = 'DEFAULT'");

            modelBuilder.Entity<MessageSession>().HasIndex(s => new { s.Status, s.StartTime });

            modelBuilder.Entity<User>()
                .HasOne(u => u.Moderator)
                .WithMany(u => u.ManagedUsers)
                .HasForeignKey(u => u.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            // ModeratorSettings FK configuration REMOVED - entity deprecated
            // MessageCondition: One-to-one required relationship with MessageTemplate
            // MessageTemplate owns the relationship (has MessageConditionId foreign key)
            // MessageCondition also has TemplateId foreign key for reverse lookup (maintained manually)
            modelBuilder.Entity<MessageTemplate>()
                .HasOne(t => t.Condition)
                .WithOne(mc => mc.Template)
                .HasForeignKey<MessageTemplate>(t => t.MessageConditionId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            // Ensure MessageConditionId is unique (one condition per template)
            modelBuilder.Entity<MessageTemplate>()
                .HasIndex(t => t.MessageConditionId)
                .IsUnique();

            // Configure MessageCondition.TemplateId as a foreign key for reverse lookup
            // This is maintained alongside the one-to-one relationship for easier queries
            // Note: This creates a bidirectional FK relationship - both FKs must be kept in sync
            modelBuilder.Entity<MessageCondition>()
                .HasOne<MessageTemplate>()
                .WithMany()
                .HasForeignKey(mc => mc.TemplateId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            // TemplateId is optional; keep a non-unique index for lookup performance
            modelBuilder.Entity<MessageCondition>()
                .HasIndex(mc => mc.TemplateId);

            modelBuilder.Entity<MessageCondition>()
                .HasOne(mc => mc.Queue)
                .WithMany()
                .HasForeignKey(mc => mc.QueueId)
                .OnDelete(DeleteBehavior.Restrict);

            // ModeratorSettings index REMOVED - entity deprecated

            modelBuilder.Entity<MessageTemplate>().Property(t => t.CreatedAt).HasDefaultValueSql(GetUtcNowSql());
            modelBuilder.Entity<Message>().Property(m => m.CreatedAt).HasDefaultValueSql(GetUtcNowSql());
            // FailedTask CreatedAt REMOVED
            modelBuilder.Entity<Quota>().Property(q => q.UpdatedAt).HasDefaultValueSql(GetUtcNowSql());
            modelBuilder.Entity<Session>().Property(s => s.CreatedAt).HasDefaultValueSql(GetUtcNowSql());
            modelBuilder.Entity<WhatsAppSession>().Property(w => w.CreatedAt).HasDefaultValueSql(GetUtcNowSql());

            // WhatsAppSession unique constraint - one session per moderator
            modelBuilder.Entity<WhatsAppSession>()
                .HasIndex(w => w.ModeratorUserId)
                .IsUnique();

            // WhatsAppSession soft-delete global query filter
            modelBuilder.Entity<WhatsAppSession>()
                .HasQueryFilter(w => !w.IsDeleted);

            modelBuilder.Entity<MessageSession>().Property(s => s.StartTime).HasDefaultValueSql(GetUtcNowSql());
            // ModeratorSettings default values REMOVED - entity deprecated

            // Patient CountryCode default value
            modelBuilder.Entity<Patient>().Property(p => p.CountryCode).HasDefaultValue("+20");

            // AuditLog configuration REMOVED

            // PhoneWhatsAppRegistry configuration
            modelBuilder.Entity<PhoneWhatsAppRegistry>().HasIndex(p => p.PhoneNumber).IsUnique();
            modelBuilder.Entity<PhoneWhatsAppRegistry>().HasIndex(p => p.ExpiresAt);

            #region Extension Runner Entity Configuration

            // ExtensionDevice configuration
            modelBuilder.Entity<ExtensionDevice>()
                .HasOne(d => d.Moderator)
                .WithMany()
                .HasForeignKey(d => d.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Unique constraint: only one active (non-revoked) device per moderator+deviceId combination
            // Revoked devices are historical records and don't conflict
            modelBuilder.Entity<ExtensionDevice>()
                .HasIndex(d => new { d.ModeratorUserId, d.DeviceId })
                .IsUnique()
                .HasFilter($"{GetQuotedColumn("RevokedAtUtc")} IS NULL");

            modelBuilder.Entity<ExtensionDevice>()
                .HasIndex(d => d.ModeratorUserId);

            modelBuilder.Entity<ExtensionDevice>()
                .Property(d => d.CreatedAtUtc)
                .HasDefaultValueSql(GetUtcNowSql());

            // ExtensionPairingCode configuration
            modelBuilder.Entity<ExtensionPairingCode>()
                .HasOne(p => p.Moderator)
                .WithMany()
                .HasForeignKey(p => p.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // ExtensionPairingCode ↔ ExtensionDevice one-to-one relationship
            modelBuilder.Entity<ExtensionPairingCode>()
                .HasOne(p => p.UsedByDevice)
                .WithOne(d => d.PairingCode)
                .HasForeignKey<ExtensionPairingCode>(p => p.UsedByDeviceId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<ExtensionPairingCode>()
                .HasIndex(p => p.Code);

            modelBuilder.Entity<ExtensionPairingCode>()
                .HasIndex(p => p.ModeratorUserId);

            modelBuilder.Entity<ExtensionPairingCode>()
                .Property(p => p.CreatedAtUtc)
                .HasDefaultValueSql(GetUtcNowSql());

            // ExtensionSessionLease configuration
            // CRITICAL: Only one active lease per moderator (filtered unique index)
            modelBuilder.Entity<ExtensionSessionLease>()
                .HasIndex(l => l.ModeratorUserId)
                .IsUnique()
                .HasFilter($"{GetQuotedColumn("RevokedAtUtc")} IS NULL");

            modelBuilder.Entity<ExtensionSessionLease>()
                .HasOne(l => l.Moderator)
                .WithMany()
                .HasForeignKey(l => l.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ExtensionSessionLease>()
                .HasOne(l => l.Device)
                .WithMany()
                .HasForeignKey(l => l.DeviceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ExtensionSessionLease>()
                .HasIndex(l => new { l.ModeratorUserId, l.RevokedAtUtc });

            modelBuilder.Entity<ExtensionSessionLease>()
                .Property(l => l.AcquiredAtUtc)
                .HasDefaultValueSql(GetUtcNowSql());

            modelBuilder.Entity<ExtensionSessionLease>()
                .Property(l => l.LastHeartbeatAtUtc)
                .HasDefaultValueSql(GetUtcNowSql());

            // ExtensionCommand configuration
            modelBuilder.Entity<ExtensionCommand>()
                .HasOne(c => c.Moderator)
                .WithMany()
                .HasForeignKey(c => c.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ExtensionCommand>()
                .HasOne(c => c.Message)
                .WithMany()
                .HasForeignKey(c => c.MessageId)
                .OnDelete(DeleteBehavior.SetNull);

            // Index for pending commands per moderator (for command dispatch)
            modelBuilder.Entity<ExtensionCommand>()
                .HasIndex(c => new { c.ModeratorUserId, c.Status, c.Priority, c.CreatedAtUtc });

            // Index for command status tracking
            modelBuilder.Entity<ExtensionCommand>()
                .HasIndex(c => new { c.Status, c.ExpiresAtUtc });

            // Index for message-related commands
            modelBuilder.Entity<ExtensionCommand>()
                .HasIndex(c => c.MessageId);

            modelBuilder.Entity<ExtensionCommand>()
                .Property(c => c.CreatedAtUtc)
                .HasDefaultValueSql(GetUtcNowSql());

            #endregion

            #region SystemSettings Configuration

            // Unique index on Key for fast lookups
            modelBuilder.Entity<SystemSettings>()
                .HasIndex(s => s.Key)
                .IsUnique();

            modelBuilder.Entity<SystemSettings>()
                .Property(s => s.CreatedAt)
                .HasDefaultValueSql(GetUtcNowSql());

            // Seed default rate limit settings
            modelBuilder.Entity<SystemSettings>().HasData(
                new SystemSettings
                {
                    Id = 1,
                    Key = SystemSettingKeys.RateLimitEnabled,
                    Value = "true",
                    Description = "تفعيل تحديد معدل الإرسال بين الرسائل",
                    Category = "RateLimit",
                    CreatedAt = new DateTime(2026, 1, 12, 0, 0, 0, DateTimeKind.Utc)
                },
                new SystemSettings
                {
                    Id = 2,
                    Key = SystemSettingKeys.RateLimitMinSeconds,
                    Value = "3",
                    Description = "الحد الأدنى للتأخير بين الرسائل (بالثواني)",
                    Category = "RateLimit",
                    CreatedAt = new DateTime(2026, 1, 12, 0, 0, 0, DateTimeKind.Utc)
                },
                new SystemSettings
                {
                    Id = 3,
                    Key = SystemSettingKeys.RateLimitMaxSeconds,
                    Value = "7",
                    Description = "الحد الأقصى للتأخير بين الرسائل (بالثواني)",
                    Category = "RateLimit",
                    CreatedAt = new DateTime(2026, 1, 12, 0, 0, 0, DateTimeKind.Utc)
                }
            );

            #endregion
        }

        /// <summary>
        /// Override SaveChangesAsync to automatically update MessageSession counters
        /// when Message.Status or Message.IsDeleted changes.
        /// </summary>
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            // Track Message.Status and IsDeleted changes before save
            var affectedSessionIds = new HashSet<string>();

            foreach (var entry in ChangeTracker.Entries<Message>())
            {
                if (entry.State == EntityState.Added || entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                {
                    var message = entry.Entity;
                    var sessionId = message.SessionId;

                    if (!string.IsNullOrEmpty(sessionId))
                    {
                        // Track if status changed
                        if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
                        {
                            var oldStatus = entry.OriginalValues["Status"]?.ToString();
                            var newStatus = message.Status;
                            if (oldStatus != newStatus)
                            {
                                affectedSessionIds.Add(sessionId);
                            }
                        }

                        // Track if IsDeleted changed
                        if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
                        {
                            var oldIsDeleted = entry.OriginalValues.GetValue<bool>("IsDeleted");
                            var newIsDeleted = message.IsDeleted;
                            if (oldIsDeleted != newIsDeleted)
                            {
                                affectedSessionIds.Add(sessionId);
                            }
                        }

                        // Track if message is being deleted (soft delete)
                        if (entry.State == EntityState.Deleted)
                        {
                            affectedSessionIds.Add(sessionId);
                        }
                    }
                }
            }

            // Save changes first
            var result = await base.SaveChangesAsync(cancellationToken);

            // Update MessageSession counters after save
            if (affectedSessionIds.Any())
            {
                foreach (var sessionIdStr in affectedSessionIds)
                {
                    if (Guid.TryParse(sessionIdStr, out var sessionGuid))
                    {
                        var session = await MessageSessions.FindAsync(new object[] { sessionGuid }, cancellationToken);
                        if (session != null)
                        {
                            // Recalculate counters based on current Message.Status and IsDeleted
                            var sessionMessages = await Messages
                                .Where(m => m.SessionId == sessionIdStr && !m.IsDeleted)
                                .ToListAsync(cancellationToken);

                            session.OngoingMessages = sessionMessages.Count(m => m.Status == "queued" || m.Status == "sending");
                            session.FailedMessages = sessionMessages.Count(m => m.Status == "failed");
                            session.SentMessages = sessionMessages.Count(m => m.Status == "sent");

                            // Check for session completion
                            if (session.OngoingMessages == 0 && session.Status != "completed" && session.Status != "cancelled")
                            {
                                // Check if all messages are processed (sent or failed)
                                // Note: Deleted messages are tracked via IsDeleted, not Status
                                var allProcessed = sessionMessages.All(m =>
                                    m.Status == "sent" || m.Status == "failed" || m.IsDeleted);

                                if (allProcessed)
                                {
                                    session.Status = "completed";
                                    session.EndTime = DateTime.UtcNow;
                                }
                            }

                            session.LastUpdated = DateTime.UtcNow;
                        }
                    }
                }

                // Save counter updates
                await base.SaveChangesAsync(cancellationToken);
            }

            return result;
        }
    }
}
