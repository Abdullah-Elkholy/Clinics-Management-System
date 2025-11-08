using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedMockData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Additional seed data (InitialCreate handles base users, queues, and templates)
-- This migration only adds: mod2 user, additional queue, extended templates, conditions, quotas, and messages

-- Get admin id (guaranteed to exist from InitialCreate)
DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');
DECLARE @mod1Id INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'mod1');

-- Seed mod2 user (additional moderator not in InitialCreate)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'mod2')
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) 
    VALUES (N'mod2', N'AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==', N'سارة أحمد', N'moderator');

-- Re-declare mod2Id after insert
DECLARE @mod2Id INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'mod2');

-- Seed additional queue (third clinic - InitialCreate has DefaultQueue + 2 others)
IF NOT EXISTS (SELECT 1 FROM dbo.Queues WHERE DoctorName = N'د. محمود سالم')
    INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes)
    VALUES (N'د. محمود سالم', N'عيادة المساء', @adminId, 7, 25);

-- Get queue IDs (safe now that we've ensured they exist)
DECLARE @queue1Id INT = (SELECT TOP 1 Id FROM dbo.Queues WHERE DoctorName = N'د. أحمد محمد');
DECLARE @queue2Id INT = (SELECT TOP 1 Id FROM dbo.Queues WHERE DoctorName = N'د. فاطمة علي');
DECLARE @queue3Id INT = (SELECT TOP 1 Id FROM dbo.Queues WHERE DoctorName = N'د. محمود سالم');

-- Seed additional MessageTemplates (beyond Welcome and AppointmentReminder from InitialCreate)
IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Position')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Queue Alert - Position', N'أنت الآن في المركز الخامس', @mod1Id, 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Wait Time')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Queue Alert - Wait Time', N'وقت الانتظار المتوقع 15 دقيقة', @mod1Id, 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Priority Alert')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Priority Alert', N'موعدك ذو أولوية عالية', @mod1Id, 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Appointment Confirmation')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Appointment Confirmation', N'يرجى التأكيد على موعدك', @mod1Id, 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Feedback Request')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Feedback Request', N'هل تقييمك للخدمة؟', @mod1Id, 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 1')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Queue - Default Message 1', N'شكرا لاستخدامك خدماتنا', @adminId, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 2')
    INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
    VALUES (N'Queue - Default Message 2', N'شكرا لاستخدامك خدماتنا', @adminId, 1, SYSUTCDATETIME());

-- Get template IDs after ensuring they exist
DECLARE @template1Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Position');
DECLARE @template2Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Wait Time');
DECLARE @template3Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Priority Alert');
DECLARE @template4Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Appointment Confirmation');
DECLARE @template7Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 1');
DECLARE @template8Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 2');

-- Seed MessageConditions (linking templates to queues with business logic)
IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template1Id AND QueueId = @queue1Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template1Id, @queue1Id, N'EQUAL', 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template7Id AND QueueId = @queue2Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template7Id, @queue2Id, N'EQUAL', 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template8Id AND QueueId = @queue3Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template8Id, @queue3Id, N'EQUAL', 0, SYSUTCDATETIME());

-- Conditional templates
IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template2Id AND QueueId = @queue1Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template2Id, @queue1Id, N'GREATER', 5, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template3Id AND QueueId = @queue1Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template3Id, @queue1Id, N'LESS', 3, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.MessageConditions WHERE TemplateId = @template4Id AND QueueId = @queue1Id)
    INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
    VALUES (@template4Id, @queue1Id, N'EQUAL', 1, SYSUTCDATETIME());

-- Seed Quotas for moderators (InitialCreate has mod1, this adds mod2 and mod1 extended quota)
IF NOT EXISTS (SELECT 1 FROM dbo.Quotas WHERE ModeratorUserId = @mod1Id)
    INSERT INTO dbo.Quotas (ModeratorUserId, MessagesQuota, ConsumedMessages, QueuesQuota, ConsumedQueues, UpdatedAt)
    VALUES (@mod1Id, 1000, 450, 10, 2, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Quotas WHERE ModeratorUserId = @mod2Id)
    INSERT INTO dbo.Quotas (ModeratorUserId, MessagesQuota, ConsumedMessages, QueuesQuota, ConsumedQueues, UpdatedAt)
    VALUES (@mod2Id, 800, 320, 10, 1, SYSUTCDATETIME());

-- Seed additional Messages (for failed tasks retrieval and testing)
IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966501234567' AND Status = N'queued')
    INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
    VALUES (N'+966501234567', N'whatsapp', N'رسالة اختبار 1', N'queued', 0, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966502234567' AND Status = N'queued')
    INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
    VALUES (N'+966502234567', N'whatsapp', N'رسالة اختبار 2', N'queued', 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966503234567' AND Status = N'failed')
    INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
    VALUES (N'+966503234567', N'whatsapp', N'رسالة اختبار 3', N'failed', 3, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Messages WHERE RecipientPhone = N'+966504234567' AND Status = N'failed')
    INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
    VALUES (N'+966504234567', N'whatsapp', N'رسالة اختبار 4', N'failed', 2, SYSUTCDATETIME());
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Rollback by deleting seeded additional data (keep base data from InitialCreate)
DELETE FROM dbo.MessageConditions WHERE TemplateId IN (SELECT Id FROM dbo.MessageTemplates WHERE Title IN (N'Queue Alert - Position', N'Queue Alert - Wait Time', N'Priority Alert', N'Appointment Confirmation', N'Feedback Request', N'Queue - Default Message 1', N'Queue - Default Message 2'));
DELETE FROM dbo.Messages WHERE RecipientPhone IN (N'+966501234567', N'+966502234567', N'+966503234567', N'+966504234567');
DELETE FROM dbo.MessageTemplates WHERE Title IN (N'Queue Alert - Position', N'Queue Alert - Wait Time', N'Priority Alert', N'Appointment Confirmation', N'Feedback Request', N'Queue - Default Message 1', N'Queue - Default Message 2');
DELETE FROM dbo.Quotas WHERE ModeratorUserId = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'mod2');
DELETE FROM dbo.Queues WHERE DoctorName = N'د. محمود سالم';
DELETE FROM dbo.Users WHERE Username = N'mod2';
");
        }
    }
}
