using Microsoft.EntityFrameworkCore;
using Clinics.Domain;

namespace Clinics.Infrastructure
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Role> Roles => Set<Role>();
        public DbSet<User> Users => Set<User>();
        public DbSet<Queue> Queues => Set<Queue>();
        public DbSet<Patient> Patients => Set<Patient>();
        public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<FailedTask> FailedTasks => Set<FailedTask>();
        public DbSet<Quota> Quotas => Set<Quota>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<Session> Sessions => Set<Session>();
        public DbSet<WhatsAppSession> WhatsAppSessions => Set<WhatsAppSession>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();
            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<Queue>().HasIndex(q => q.DoctorName);
            modelBuilder.Entity<Patient>().HasIndex(p => new { p.QueueId, p.Position });

            modelBuilder.Entity<MessageTemplate>().HasIndex(t => t.CreatedBy);
            modelBuilder.Entity<Message>().HasIndex(m => new { m.Status, m.CreatedAt });
            modelBuilder.Entity<FailedTask>().HasIndex(f => f.RetryCount);
            modelBuilder.Entity<Quota>().HasIndex(q => q.ModeratorUserId);
            modelBuilder.Entity<AuditLog>().HasIndex(a => a.UserId);

            // Set defaults for CreatedAt where appropriate
            modelBuilder.Entity<MessageTemplate>().Property(t => t.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Message>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<FailedTask>().Property(f => f.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Quota>().Property(q => q.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<AuditLog>().Property(a => a.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Session>().Property(s => s.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<WhatsAppSession>().Property(w => w.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
        }
    }
}
