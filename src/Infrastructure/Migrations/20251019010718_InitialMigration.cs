using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                });

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
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
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
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_RetryCount",
                table: "FailedTasks",
                column: "RetryCount");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_Status_CreatedAt",
                table: "Messages",
                columns: new[] { "Status", "CreatedAt" });

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
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.Sql(@"
-- Idempotent seed: Roles
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'primary_admin')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'primary_admin', N'المدير الأساسي');
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'secondary_admin')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'secondary_admin', N'المدير الثانوي');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'moderator')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'moderator', N'المشرف');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'user')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'user', N'المستخدم');

-- Default queues
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'DefaultQueue')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'DefaultQueue', N'Default', 1, 1, 15);
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'د. أحمد محمد', N'عيادة الصباح', 1, 1, 15);
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'د. فاطمة علي')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes) VALUES (N'د. فاطمة علي', N'عيادة الأطفال', 1, 1, 20);

-- Prototype users (pre-hashed passwords)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, RoleId) VALUES (N'admin', N'AQAAAAIAAYagAAAAEFis02t8W90rJ6Pkqw6wwD45hx6QI2ArKLqW8tl77SnIidCWW43DLldUP2G1BhxkXw==', N'المدير الأساسي', (SELECT TOP(1) Id FROM dbo.Roles WHERE Name=N'primary_admin'));
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin2')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, RoleId) VALUES (N'admin2', N'AQAAAAIAAYagAAAAEFmtEKOGKA5/ficlHNopu3+fZ1ly0ocuBAvJgl59wxjRQgGSFDlPgKNa+KR2a8vpTA==', N'Admin Two', (SELECT TOP(1) Id FROM dbo.Roles WHERE Name=N'secondary_admin'));
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'mod1')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, RoleId) VALUES (N'mod1', N'AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==', N'Mod One', (SELECT TOP(1) Id FROM dbo.Roles WHERE Name=N'moderator'));
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'user1')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, RoleId) VALUES (N'user1', N'AQAAAAIAAYagAAAAEAl24nxVIY22QRB5OdNaWSlDWAVFL0NJRq5VxIpS2ReFYDg3Vh1KbnJbsNOnQPC/kw==', N'User One', (SELECT TOP(1) Id FROM dbo.Roles WHERE Name=N'user'));

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
    INSERT INTO dbo.Messages (PatientId, TemplateId, QueueId, SenderUserId, RecipientPhone, Content, Channel, Status, Attempts, CreatedAt) VALUES (
        (SELECT TOP(1) Id FROM dbo.Patients WHERE PhoneNumber = N'+966500000003'),
        (SELECT TOP(1) Id FROM dbo.MessageTemplates WHERE Title = N'Welcome'),
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'DefaultQueue'),
        (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'admin'),
        N'+966500000003', N'مرحبا بك في عيادتنا', N'whatsapp', N'queued', 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966500000001' AND Content LIKE N'%تذكير%')
    INSERT INTO dbo.Messages (PatientId, TemplateId, QueueId, SenderUserId, RecipientPhone, Content, Channel, Status, Attempts, CreatedAt) VALUES (
        (SELECT TOP(1) Id FROM dbo.Patients WHERE PhoneNumber = N'+966500000001'),
        (SELECT TOP(1) Id FROM dbo.MessageTemplates WHERE Title = N'AppointmentReminder'),
        (SELECT TOP(1) Id FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد'),
        (SELECT TOP(1) Id FROM dbo.Users WHERE Username = N'mod1'),
        N'+966500000001', N'تذكير: لديك موعد غداً الساعة 10 صباحاً', N'whatsapp', N'queued', 0, SYSUTCDATETIME());

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
                name: "Messages");

            migrationBuilder.DropTable(
                name: "MessageTemplates");

            migrationBuilder.DropTable(
                name: "Patients");

            migrationBuilder.DropTable(
                name: "Quotas");

            migrationBuilder.DropTable(
                name: "Sessions");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "WhatsAppSessions");

            migrationBuilder.DropTable(
                name: "Queues");

            migrationBuilder.DropTable(
                name: "Roles");

            // Remove seeded users and queues by their known unique keys
            migrationBuilder.Sql(@"
DELETE FROM dbo.Users WHERE Username IN (N'admin', N'admin2', N'mod1', N'user1');
DELETE FROM dbo.Messages WHERE RecipientPhone IN (N'+966500000001', N'+966500000002');
DELETE FROM dbo.MessageTemplates WHERE Title IN (N'Welcome', N'AppointmentReminder');
DELETE FROM dbo.Patients WHERE FullName IN (N'أحمد محمد', N'فاطمة علي', N'اختبار مريض');
DELETE FROM dbo.Quotas WHERE ModeratorUserId IN (SELECT Id FROM dbo.Users WHERE Username IN (N'mod1'));
DELETE FROM dbo.Queues WHERE DoctorName IN (N'DefaultQueue', N'د. أحمد محمد', N'د. فاطمة علي');
DELETE FROM dbo.Roles WHERE Name IN (N'primary_admin', N'secondary_admin', N'moderator', N'user');
");
        }
    }
}
