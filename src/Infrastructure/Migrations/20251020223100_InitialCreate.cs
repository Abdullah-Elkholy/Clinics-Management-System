using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Messages",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PatientId = table.Column<int>(type: "int", nullable: true),
                    TemplateId = table.Column<int>(type: "int", nullable: true),
                    QueueId = table.Column<int>(type: "int", nullable: true),
                    SenderUserId = table.Column<int>(type: "int", nullable: true),
                    ProviderMessageId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RecipientPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Messages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MessageTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    Moderator = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsShared = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Queues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DoctorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CurrentPosition = table.Column<int>(type: "int", nullable: false),
                    EstimatedWaitMinutes = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Queues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RefreshToken = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    IpAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ModeratorId = table.Column<int>(type: "int", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Users_ModeratorId",
                        column: x => x.ModeratorId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WhatsAppSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    SessionName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProviderSessionId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhatsAppSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MessageSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QueueId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TotalMessages = table.Column<int>(type: "int", nullable: false),
                    SentMessages = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageSessions_Queues_QueueId",
                        column: x => x.QueueId,
                        principalTable: "Queues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Patients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QueueId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Patients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Patients_Queues_QueueId",
                        column: x => x.QueueId,
                        principalTable: "Queues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Quotas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    MessagesQuota = table.Column<int>(type: "int", nullable: false),
                    ConsumedMessages = table.Column<int>(type: "int", nullable: false),
                    QueuesQuota = table.Column<int>(type: "int", nullable: false),
                    ConsumedQueues = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Quotas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Quotas_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FailedTasks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MessageId = table.Column<long>(type: "bigint", nullable: true),
                    PatientId = table.Column<int>(type: "int", nullable: true),
                    QueueId = table.Column<int>(type: "int", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ProviderResponse = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    LastRetryAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FailedTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FailedTasks_Messages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "Messages",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FailedTasks_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FailedTasks_Queues_QueueId",
                        column: x => x.QueueId,
                        principalTable: "Queues",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_MessageId",
                table: "FailedTasks",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_PatientId",
                table: "FailedTasks",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_QueueId",
                table: "FailedTasks",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_RetryCount",
                table: "FailedTasks",
                column: "RetryCount");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_Status_CreatedAt",
                table: "Messages",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageSessions_QueueId",
                table: "MessageSessions",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageSessions_Status_StartTime",
                table: "MessageSessions",
                columns: new[] { "Status", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_CreatedBy",
                table: "MessageTemplates",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_QueueId_Position",
                table: "Patients",
                columns: new[] { "QueueId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_Queues_DoctorName",
                table: "Queues",
                column: "DoctorName");

            migrationBuilder.CreateIndex(
                name: "IX_Quotas_ModeratorUserId",
                table: "Quotas",
                column: "ModeratorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_ModeratorId",
                table: "Users",
                column: "ModeratorId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.Sql(@"
-- Prototype users (pre-hashed passwords) - using direct Role string values
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) VALUES (N'admin', N'AQAAAAIAAYagAAAAEFis02t8W90rJ6Pkqw6wwD45hx6QI2ArKLqW8tl77SnIidCWW43DLldUP2G1BhxkXw==', N'المدير الأساسي', N'primary_admin');
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin2')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) VALUES (N'admin2', N'AQAAAAIAAYagAAAAEFmtEKOGKA5/ficlHNopu3+fZ1ly0ocuBAvJgl59wxjRQgGSFDlPgKNa+KR2a8vpTA==', N'Admin Two', N'secondary_admin');
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'mod1')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) VALUES (N'mod1', N'AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==', N'Mod One', N'moderator');
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'user1')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) VALUES (N'user1', N'AQAAAAIAAYagAAAAEAl24nxVIY22QRB5OdNaWSlDWAVFL0NJRq5VxIpS2ReFYDg3Vh1KbnJbsNOnQPC/kw==', N'User One', N'user');

-- Default queues
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'DefaultQueue')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'DefaultQueue', N'Default', 1, 1, 15);
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'د. أحمد محمد', N'عيادة الصباح', 1, 1, 15);
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'د. فاطمة علي')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'د. فاطمة علي', N'عيادة الأطفال', 1, 1, 20);

-- Additional prototype data: Patients, Templates, Messages, Quotas, Sessions, FailedTasks
IF NOT EXISTS (SELECT 1 FROM dbo.Patients WHERE FullName = N'اختبار مريض')
    INSERT INTO dbo.Patients (QueueId, FullName, PhoneNumber, Position, Status) VALUES (
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'DefaultQueue'), N'اختبار مريض', N'+966500000003', 3, N'waiting');

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Welcome')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt) VALUES (N'Welcome', N'مرحبا بك في عيادتنا', (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'admin'), 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'AppointmentReminder')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt) VALUES (N'AppointmentReminder', N'تذكير: لديك موعد غداً الساعة 10 صباحاً', (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'mod1'), 0, SYSUTCDATETIME());

-- Queue a couple of messages for the new patient and existing patients
IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966500000003' AND Content LIKE N'%مرحبا بك%')
    INSERT INTO dbo.Messages (PatientId, TemplateId, QueueId, SenderUserId, RecipientPhone, Channel, Content, Status, Attempts, CreatedAt) VALUES (
        (SELECT TOP(1) Id FROM dbo.Patients WHERE PhoneNumber = N'+966500000003'),
        (SELECT TOP(1) Id FROM dbo.MessageTemplates WHERE Title = N'Welcome'),
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'DefaultQueue'),
        (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'admin'),
        N'+966500000003', N'whatsapp', N'مرحبا بك في عيادتنا', N'queued', 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966500000001' AND Content LIKE N'%تذكير%')
    INSERT INTO dbo.Messages (PatientId, TemplateId, QueueId, SenderUserId, RecipientPhone, Channel, Content, Status, Attempts, CreatedAt) VALUES (
        (SELECT TOP(1) Id FROM dbo.Patients WHERE PhoneNumber = N'+966500000001'),
        (SELECT TOP(1) Id FROM dbo.MessageTemplates WHERE Title = N'AppointmentReminder'),
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد'),
        (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'mod1'),
        N'+966500000001', N'whatsapp', N'تذكير: لديك موعد غداً الساعة 10 صباحاً', N'queued', 0, SYSUTCDATETIME());

-- Quota for moderator
IF NOT EXISTS (SELECT 1 FROM dbo.Quotas WHERE ModeratorUserId = (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'mod1'))
    INSERT INTO dbo.Quotas (ModeratorUserId, MessagesQuota, ConsumedMessages, QueuesQuota, ConsumedQueues, UpdatedAt) VALUES ((SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'mod1'), 1000, 2, 10, 1, SYSUTCDATETIME());

-- A sample failed task for testing retry logic
IF NOT EXISTS (SELECT 1 FROM dbo.FailedTasks WHERE Reason LIKE N'%simulate failure%')
    INSERT INTO dbo.FailedTasks (MessageId, PatientId, QueueId, Reason, ProviderResponse, CreatedAt, LastRetryAt, RetryCount) VALUES (
        (SELECT TOP(1) Id FROM dbo.Messages WHERE RecipientPhone = N'+966500000001'),
        (SELECT TOP(1) Id FROM dbo.Patients WHERE PhoneNumber = N'+966500000001'),
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد'),
        N'simulate failure for testing', N'provider-unreachable', SYSUTCDATETIME(), NULL, 0);

-- Session for admin (refresh token placeholder)
IF NOT EXISTS (SELECT 1 FROM dbo.Sessions WHERE UserId = (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'admin'))
    INSERT INTO dbo.Sessions (Id, UserId, RefreshToken, ExpiresAt, CreatedAt, IpAddress, UserAgent) VALUES (NEWID(), (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'admin'), N'seed-refresh-token', DATEADD(day,30,SYSUTCDATETIME()), SYSUTCDATETIME(), N'127.0.0.1', N'SeedScript');

");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FailedTasks");

            migrationBuilder.DropTable(
                name: "MessageSessions");

            migrationBuilder.DropTable(
                name: "MessageTemplates");

            migrationBuilder.DropTable(
                name: "Quotas");

            migrationBuilder.DropTable(
                name: "Sessions");

            migrationBuilder.DropTable(
                name: "WhatsAppSessions");

            migrationBuilder.DropTable(
                name: "Messages");

            migrationBuilder.DropTable(
                name: "Patients");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Queues");

                            // Remove seeded users and queues by their known unique keys
            migrationBuilder.Sql(@"
DELETE FROM dbo.Users WHERE Username IN (N'admin', N'admin2', N'mod1', N'user1');
DELETE FROM dbo.Messages WHERE RecipientPhone IN (N'+966500000001', N'+966500000002');
DELETE FROM dbo.MessageTemplates WHERE Title IN (N'Welcome', N'AppointmentReminder');
DELETE FROM dbo.Patients WHERE FullName IN (N'أحمد محمد', N'فاطمة علي', N'اختبار مريض');
DELETE FROM dbo.Quotas WHERE ModeratorUserId IN (SELECT Id FROM dbo.Users WHERE Username IN (N'mod1'));
DELETE FROM dbo.Queues WHERE DoctorName IN (N'DefaultQueue', N'د. أحمد محمد', N'د. فاطمة علي')
");
        }
    }
}
