using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

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

                // Create password hasher
                var hasher = new PasswordHasher<User>();

                // Create an admin moderator for testing admin queue operations first
                var adminModerator = new User
                {
                    Username = "admin_mod",
                    FirstName = "مدير",
                    LastName = "الاختبار",
                    Role = "moderator",
                    PasswordHash = hasher.HashPassword(null!, "adminmod123")
                };

                // Add admin moderator first to get its ID
                _db.Users.Add(adminModerator);
                await _db.SaveChangesAsync();

                // Now create admin users with proper passwords, assigning them to admin moderator
                var adminPrimary = new User
                {
                    Username = "admin",
                    FirstName = "أحمد",
                    LastName = "المدير الأول",
                    Role = "primary_admin",
                    PasswordHash = hasher.HashPassword(null!, "admin123"),
                    ModeratorId = adminModerator.Id  // Assign to admin moderator
                };

                var adminSecondary = new User
                {
                    Username = "admin2",
                    FirstName = "سارة",
                    LastName = "المديرة الثانية",
                    Role = "secondary_admin",
                    PasswordHash = hasher.HashPassword(null!, "admin123"),
                    ModeratorId = adminModerator.Id  // Assign to admin moderator
                };

                // Create moderators
                var moderatorAhmed = new User
                {
                    Username = "mod1",
                    FirstName = "د.",
                    LastName = "أحمد",
                    Role = "moderator",
                    PasswordHash = hasher.HashPassword(null!, "mod123")
                };

                var regularUser = new User
                {
                    Username = "user1",
                    FirstName = "مستخدم",
                    LastName = "عادي",
                    Role = "user",
                    PasswordHash = hasher.HashPassword(null!, "user123"),
                    ModeratorId = moderatorAhmed.Id  // Assign to first moderator (mod1)
                };

                // Add a second moderator for testing with multiple moderators
                var moderatorSara = new User
                {
                    Username = "mod2",
                    FirstName = "د.",
                    LastName = "سارة",
                    Role = "moderator",
                    PasswordHash = hasher.HashPassword(null!, "mod123")
                };

                _db.Users.AddRange(adminPrimary, adminSecondary, moderatorAhmed, regularUser, moderatorSara);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created admin and moderator users.");

                // Auto-create quotas for moderators with unlimited messages and queues (-1 = unlimited)
                var quotaAhmed = new Quota
                {
                    ModeratorUserId = moderatorAhmed.Id,
                    MessagesQuota = -1, // -1 = unlimited
                    ConsumedMessages = 0,
                    QueuesQuota = -1, // -1 = unlimited
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                var quotaSara = new Quota
                {
                    ModeratorUserId = moderatorSara.Id,
                    MessagesQuota = -1, // -1 = unlimited
                    ConsumedMessages = 0,
                    QueuesQuota = -1, // -1 = unlimited
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                var quotaAdmin = new Quota
                {
                    ModeratorUserId = adminModerator.Id,
                    MessagesQuota = -1, // -1 = unlimited
                    ConsumedMessages = 0,
                    QueuesQuota = -1, // -1 = unlimited
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Quotas.AddRange(quotaAhmed, quotaSara, quotaAdmin);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created quotas for moderators.");

                // Create queues for each moderator
                var queueAhmed = new Queue
                {
                    DoctorName = "DefaultQueue",
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
                    Title = "Welcome",
                    Content = "مرحباً {PN}، أنت في الموضع {CQP} في العيادة. الوقت المتوقع {ETR} دقيقة.",
                    CreatedBy = moderatorAhmed.Id,
                    ModeratorId = moderatorAhmed.Id,
                    QueueId = queueAhmed.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionalTemplateAhmed = new MessageTemplate
                {
                    Title = "AppointmentReminder",
                    Content = "مرحباً {PN}، أنت ستستدعى قريباً! الموضع: {CQP}",
                    CreatedBy = moderatorAhmed.Id,
                    ModeratorId = moderatorAhmed.Id,
                    QueueId = queueAhmed.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var defaultTemplateSara = new MessageTemplate
                {
                    Title = "رسالة ترحيب سارة",
                    Content = "أهلاً وسهلاً {PN}، رقمك {CQP} في العيادة.",
                    CreatedBy = moderatorSara.Id,
                    ModeratorId = moderatorSara.Id,
                    QueueId = queueSara.Id,
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
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Add templates first (without MessageConditionId)
                _db.MessageTemplates.AddRange(
                    defaultTemplateAhmed, conditionalTemplateAhmed,
                    defaultTemplateSara, conditionalTemplateSara
                );
                await _db.SaveChangesAsync();

                _logger.LogInformation("Created message templates.");

                // Create conditions first: DEFAULT for default templates, specific operators for conditional ones
                var defaultConditionAhmed = new MessageCondition
                {
                    QueueId = queueAhmed.Id,
                    Operator = "DEFAULT",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionAhmed = new MessageCondition
                {
                    QueueId = queueAhmed.Id,
                    Operator = "LESS",
                    Value = 4, // Send if current position < 4
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var defaultConditionSara = new MessageCondition
                {
                    QueueId = queueSara.Id,
                    Operator = "DEFAULT",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var conditionSara = new MessageCondition
                {
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
                await _db.SaveChangesAsync(); // Save to get condition IDs

                // Update templates with MessageConditionId
                defaultTemplateAhmed.MessageConditionId = defaultConditionAhmed.Id;
                conditionalTemplateAhmed.MessageConditionId = conditionAhmed.Id;
                defaultTemplateSara.MessageConditionId = defaultConditionSara.Id;
                conditionalTemplateSara.MessageConditionId = conditionSara.Id;
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

