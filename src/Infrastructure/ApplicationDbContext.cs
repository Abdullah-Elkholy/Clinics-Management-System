using Microsoft.EntityFrameworkCore;
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
                .OnDelete(DeleteBehavior.Cascade);

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
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Moderator)
                .WithMany()
                .HasForeignKey(m => m.ModeratorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FailedTask>().HasIndex(f => f.RetryCount);
            
            // Quota: enforce one-to-one with Moderator via unique index
            modelBuilder.Entity<Quota>().HasIndex(q => q.ModeratorUserId).IsUnique();
            
            // MessageTemplate: enforce exactly one default per queue via filtered unique index
            modelBuilder.Entity<MessageTemplate>()
                .HasIndex(t => new { t.QueueId, t.IsDefault })
                .IsUnique()
                .HasFilter("[QueueId] IS NOT NULL AND [IsDefault] = 1");
            
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
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ModeratorSettings>().HasIndex(m => m.ModeratorUserId).IsUnique();

            modelBuilder.Entity<MessageTemplate>().Property(t => t.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Message>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<FailedTask>().Property(f => f.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Quota>().Property(q => q.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Session>().Property(s => s.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<WhatsAppSession>().Property(w => w.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<MessageSession>().Property(s => s.StartTime).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<ModeratorSettings>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<ModeratorSettings>().Property(m => m.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

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
    }
}
