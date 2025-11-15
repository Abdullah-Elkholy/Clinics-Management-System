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
    }
}
