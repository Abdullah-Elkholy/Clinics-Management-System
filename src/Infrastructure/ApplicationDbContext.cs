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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<Queue>().HasIndex(q => q.DoctorName);
            modelBuilder.Entity<Patient>().HasIndex(p => new { p.QueueId, p.Position });

            modelBuilder.Entity<Patient>()
                .HasOne(p => p.Queue)
                .WithMany()
                .HasForeignKey(p => p.QueueId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MessageTemplate>().HasIndex(t => t.CreatedBy);
            modelBuilder.Entity<Message>().HasIndex(m => new { m.Status, m.CreatedAt });
            modelBuilder.Entity<FailedTask>().HasIndex(f => f.RetryCount);
            modelBuilder.Entity<Quota>().HasIndex(q => q.ModeratorUserId);
            modelBuilder.Entity<MessageSession>().HasIndex(s => new { s.Status, s.StartTime });

            modelBuilder.Entity<MessageTemplate>().Property(t => t.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Message>().Property(m => m.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<FailedTask>().Property(f => f.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Quota>().Property(q => q.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<Session>().Property(s => s.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<WhatsAppSession>().Property(w => w.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            modelBuilder.Entity<MessageSession>().Property(s => s.StartTime).HasDefaultValueSql("SYSUTCDATETIME()");
        }
    }
}
