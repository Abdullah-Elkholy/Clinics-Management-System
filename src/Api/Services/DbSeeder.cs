using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Seed realistic FK'd test data and initialize quotas for moderators.
    /// Run this after all migrations have been applied.
    /// </summary>
    public class DbSeeder
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<DbSeeder> _logger;

        public DbSeeder(ApplicationDbContext db, ILogger<DbSeeder> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Seed the database with test data if not already seeded.
        /// </summary>
        public async Task SeedAsync()
        {
            try
            {
                // Skip if data already exists
                if (await _db.Users.AnyAsync())
                {
                    _logger.LogInformation("Database already seeded. Skipping.");
                    return;
                }

                _logger.LogInformation("Starting database seeding...");

                // Create admin users
                var adminPrimary = new User
                {
                    Username = "admin_primary",
                    FirstName = "أحمد",
                    LastName = "المدير الأول",
                    Role = "primary_admin",
                    PasswordHash = "AQAAAAIAAYagAAAAEFis02t8W90rJ6Pkqw6wwD45hx6QI2ArKLqW8tl77SnIidCWW43DLldUP2G1BhxkXw==" // In real app, use proper hashing
                };

                var adminSecondary = new User
                {
                    Username = "admin_secondary",
                    FirstName = "سارة",
                    LastName = "المديرة الثانية",
                    Role = "secondary_admin",
                    PasswordHash = "AQAAAAIAAYagAAAAEFmtEKOGKA5/ficlHNopu3+fZ1ly0ocuBAvJgl59wxjRQgGSFDlPgKNa+KR2a8vpTA=="
                };

                // Create moderators
                var moderatorAhmed = new User
                {
                    Username = "moderator_ahmed",
                    FirstName = "د.",
                    LastName = "أحمد",
                    Role = "moderator",
                    PasswordHash = "AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ=="
                };

                var moderatorSara = new User
                {
                    Username = "moderator_sara",
                    FirstName = "د.",
                    LastName = "سارة",
                    Role = "moderator",
                    PasswordHash = "AQAAAAIAAYagAAAAEAl24nxVIY22QRB5OdNaWSlDWAVFL0NJRq5VxIpS2ReFYDg3Vh1KbnJbsNOnQPC/kw=="
                };

                _db.Users.AddRange(adminPrimary, adminSecondary, moderatorAhmed, moderatorSara);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created admin and moderator users.");

                // Auto-create quotas for moderators (0 messages, 0 queues initially)
                var quotaAhmed = new Quota
                {
                    ModeratorUserId = moderatorAhmed.Id,
                    MessagesQuota = 0,
                    ConsumedMessages = 0,
                    QueuesQuota = 0,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                var quotaSara = new Quota
                {
                    ModeratorUserId = moderatorSara.Id,
                    MessagesQuota = 0,
                    ConsumedMessages = 0,
                    QueuesQuota = 0,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Quotas.AddRange(quotaAhmed, quotaSara);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created quotas for moderators.");

                // Create queues for each moderator
                var queueAhmed = new Queue
                {
                    DoctorName = "عيادة د. أحمد",
                    ModeratorId = moderatorAhmed.Id,
                    CreatedBy = adminPrimary.Id,
                    CurrentPosition = 1,
                    EstimatedWaitMinutes = 15
                };

                var queueSara = new Queue
                {
                    DoctorName = "عيادة د. سارة",
                    ModeratorId = moderatorSara.Id,
                    CreatedBy = adminPrimary.Id,
                    CurrentPosition = 1,
                    EstimatedWaitMinutes = 20
                };

                _db.Queues.AddRange(queueAhmed, queueSara);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created queues.");

                // Create patients for each queue
                var patientsAhmed = new List<Patient>
                {
                    new Patient { QueueId = queueAhmed.Id, FullName = "محمد علي", PhoneNumber = "+2001012345678", Position = 1, Status = "waiting" },
                    new Patient { QueueId = queueAhmed.Id, FullName = "فاطمة أحمد", PhoneNumber = "+2001112345679", Position = 2, Status = "waiting" },
                    new Patient { QueueId = queueAhmed.Id, FullName = "علي محمود", PhoneNumber = "+2001212345670", Position = 3, Status = "waiting" },
                    new Patient { QueueId = queueAhmed.Id, FullName = "نور الدين", PhoneNumber = "+2001312345671", Position = 4, Status = "waiting" },
                    new Patient { QueueId = queueAhmed.Id, FullName = "ليلى عمر", PhoneNumber = "+2001412345672", Position = 5, Status = "waiting" }
                };

                var patientsSara = new List<Patient>
                {
                    new Patient { QueueId = queueSara.Id, FullName = "أحمد حسن", PhoneNumber = "+2001512345673", Position = 1, Status = "waiting" },
                    new Patient { QueueId = queueSara.Id, FullName = "هند محمد", PhoneNumber = "+2001612345674", Position = 2, Status = "waiting" },
                    new Patient { QueueId = queueSara.Id, FullName = "يوسف إبراهيم", PhoneNumber = "+2001712345675", Position = 3, Status = "waiting" },
                    new Patient { QueueId = queueSara.Id, FullName = "دينا خليل", PhoneNumber = "+2001812345676", Position = 4, Status = "waiting" },
                    new Patient { QueueId = queueSara.Id, FullName = "صلاح الدين", PhoneNumber = "+2001912345677", Position = 5, Status = "waiting" }
                };

                _db.Patients.AddRange(patientsAhmed);
                _db.Patients.AddRange(patientsSara);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created patients for queues.");

                // Create templates: 1 default per queue, 1-2 non-default per queue
                var defaultTemplateAhmed = new MessageTemplate
                {
                    Title = "رسالة ترحيب أحمد",
                    Content = "مرحباً {PN}، أنت في الموضع {CQP} في الطابور. الوقت المتوقع {ETR} دقيقة.",
                    CreatedBy = moderatorAhmed.Id,
                    ModeratorId = moderatorAhmed.Id,
                    QueueId = queueAhmed.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionalTemplateAhmed = new MessageTemplate
                {
                    Title = "رسالة خاصة (موضع مبكر)",
                    Content = "مرحباً {PN}، أنت ستستدعى قريباً! الموضع: {CQP}",
                    CreatedBy = moderatorAhmed.Id,
                    ModeratorId = moderatorAhmed.Id,
                    QueueId = queueAhmed.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var defaultTemplateSara = new MessageTemplate
                {
                    Title = "رسالة ترحيب سارة",
                    Content = "أهلاً وسهلاً {PN}، رقمك {CQP} في الطابور.",
                    CreatedBy = moderatorSara.Id,
                    ModeratorId = moderatorSara.Id,
                    QueueId = queueSara.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionalTemplateSara = new MessageTemplate
                {
                    Title = "تنبيه حركة",
                    Content = "يا {PN}، الرجاء التحضير، موضعك سيتم استدعاؤه بعد قليل.",
                    CreatedBy = moderatorSara.Id,
                    ModeratorId = moderatorSara.Id,
                    QueueId = queueSara.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.MessageTemplates.AddRange(
                    defaultTemplateAhmed, conditionalTemplateAhmed,
                    defaultTemplateSara, conditionalTemplateSara
                );
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created message templates.");

                // Create conditions: DEFAULT for default templates, specific operators for conditional ones
                var defaultConditionAhmed = new MessageCondition
                {
                    TemplateId = defaultTemplateAhmed.Id,
                    QueueId = queueAhmed.Id,
                    Operator = "DEFAULT",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionAhmed = new MessageCondition
                {
                    TemplateId = conditionalTemplateAhmed.Id,
                    QueueId = queueAhmed.Id,
                    Operator = "LESS",
                    Value = 4, // Send if current position < 4
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var defaultConditionSara = new MessageCondition
                {
                    TemplateId = defaultTemplateSara.Id,
                    QueueId = queueSara.Id,
                    Operator = "DEFAULT",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionSara = new MessageCondition
                {
                    TemplateId = conditionalTemplateSara.Id,
                    QueueId = queueSara.Id,
                    Operator = "RANGE",
                    MinValue = 2,
                    MaxValue = 5, // Send if position is between 2 and 5
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Set<MessageCondition>().AddRange(
                    defaultConditionAhmed, conditionAhmed,
                    defaultConditionSara, conditionSara
                );
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created message conditions.");
                _logger.LogInformation("Database seeding completed successfully!");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding database");
                throw;
            }
        }
    }
}
