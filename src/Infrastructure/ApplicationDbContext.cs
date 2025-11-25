using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Clinics.Domain;

namespace Clinics.Infrastructure
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Queue> Queues => Set<Queue>();
        public DbSet<Patient> Patients => Set<Patient>();
        public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<FailedTask> FailedTasks => Set<FailedTask>();
        public DbSet<Quota> Quotas => Set<Quota>();
        public DbSet<Session> Sessions => Set<Session>();
        public DbSet<WhatsAppSession> WhatsAppSessions => Set<WhatsAppSession>();
        public DbSet<MessageSession> MessageSessions => Set<MessageSession>();
        public DbSet<ModeratorSettings> ModeratorSettings => Set<ModeratorSettings>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

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
            modelBuilder.Entity<FailedTask>()
                .HasOne(f => f.Queue)
                .WithMany()
                .HasForeignKey(f => f.QueueId)
                .OnDelete(DeleteBehavior.Restrict);
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
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Moderator)
                .WithMany()
                .HasForeignKey(m => m.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FailedTask>().HasIndex(f => f.RetryCount);
            
            // Quota: enforce one-to-one with Moderator via unique index
            modelBuilder.Entity<Quota>().HasIndex(q => q.ModeratorUserId).IsUnique();
            
            // MessageCondition: enforce exactly one DEFAULT condition per queue via filtered unique index
            modelBuilder.Entity<MessageCondition>()
                .HasIndex(c => new { c.QueueId, c.Operator })
                .IsUnique()
                .HasFilter("[Operator] = 'DEFAULT'");
            
            modelBuilder.Entity<MessageSession>().HasIndex(s => new { s.Status, s.StartTime });

            modelBuilder.Entity<User>()
                .HasOne(u => u.Moderator)
                .WithMany(u => u.ManagedUsers)
                .HasForeignKey(u => u.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ModeratorSettings>()
                .HasOne(m => m.Moderator)
                .WithMany()
                .HasForeignKey(m => m.ModeratorUserId)
                .OnDelete(DeleteBehavior.Restrict);
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

            modelBuilder.Entity<ModeratorSettings>().HasIndex(m => m.ModeratorUserId).IsUnique();

            modelBuilder.Entity<MessageTemplate>().Property(t => t.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Message>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<FailedTask>().Property(f => f.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Quota>().Property(q => q.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Session>().Property(s => s.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<WhatsAppSession>().Property(w => w.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            
            // WhatsAppSession unique constraint - one session per moderator
            modelBuilder.Entity<WhatsAppSession>()
                .HasIndex(w => w.ModeratorUserId)
                .IsUnique();
            
            // WhatsAppSession soft-delete global query filter
            modelBuilder.Entity<WhatsAppSession>()
                .HasQueryFilter(w => !w.IsDeleted);
            
            modelBuilder.Entity<MessageSession>().Property(s => s.StartTime).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<ModeratorSettings>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<ModeratorSettings>().Property(m => m.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            
            // Patient CountryCode default value
            modelBuilder.Entity<Patient>().Property(p => p.CountryCode).HasDefaultValue("+20");

            // AuditLog configuration
            modelBuilder.Entity<AuditLog>().HasIndex(a => new { a.EntityType, a.EntityId });
            modelBuilder.Entity<AuditLog>().HasIndex(a => a.Action);
            modelBuilder.Entity<AuditLog>().HasIndex(a => a.ActorUserId);
            modelBuilder.Entity<AuditLog>().HasIndex(a => a.CreatedAt);
            modelBuilder.Entity<AuditLog>()
                .HasOne(a => a.Actor)
                .WithMany()
                .HasForeignKey(a => a.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<AuditLog>().Property(a => a.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
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
