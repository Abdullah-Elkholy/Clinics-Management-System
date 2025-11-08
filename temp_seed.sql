SET QUOTED_IDENTIFIER ON;
SET ARITHABORT ON;

-- Insert mod2
INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role) 
VALUES (N'mod2', N'AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==', N'سارة أحمد', N'moderator');

-- Get IDs
DECLARE @mod1Id INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'mod1');
DECLARE @mod2Id INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'mod2');
DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');

-- Insert templates
INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Queue Alert - Position', N'أنت الآن في المركز الخامس', @mod1Id, 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Queue Alert - Wait Time', N'وقت الانتظار المتوقع 15 دقيقة', @mod1Id, 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Priority Alert', N'موعدك ذو أولوية عالية', @mod1Id, 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Appointment Confirmation', N'يرجى التأكيد على موعدك', @mod1Id, 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Feedback Request', N'هل تقييمك للخدمة؟', @mod1Id, 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Queue - Default Message 1', N'شكرا لاستخدامك خدماتنا', @adminId, 1, SYSUTCDATETIME());

INSERT INTO dbo.MessageTemplates (Title, Content, CreatedBy, IsShared, CreatedAt)
VALUES (N'Queue - Default Message 2', N'شكرا لاستخدامك خدماتنا', @adminId, 1, SYSUTCDATETIME());

-- Get template IDs
DECLARE @template1Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Position');
DECLARE @template2Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue Alert - Wait Time');
DECLARE @template3Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Priority Alert');
DECLARE @template4Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Appointment Confirmation');
DECLARE @template7Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 1');
DECLARE @template8Id INT = (SELECT TOP 1 Id FROM dbo.MessageTemplates WHERE Title = N'Queue - Default Message 2');
DECLARE @queue1Id INT = 2;
DECLARE @queue2Id INT = 3;
DECLARE @queue3Id INT = 1;

-- Insert conditions
INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template1Id, @queue1Id, N'EQUAL', 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template7Id, @queue2Id, N'EQUAL', 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template8Id, @queue3Id, N'EQUAL', 0, SYSUTCDATETIME());

INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template2Id, @queue1Id, N'GREATER', 5, SYSUTCDATETIME());

INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template3Id, @queue1Id, N'LESS', 3, SYSUTCDATETIME());

INSERT INTO dbo.MessageConditions (TemplateId, QueueId, Operator, Value, CreatedAt)
VALUES (@template4Id, @queue1Id, N'EQUAL', 1, SYSUTCDATETIME());

-- Insert quotas
INSERT INTO dbo.Quotas (ModeratorUserId, MessagesQuota, ConsumedMessages, QueuesQuota, ConsumedQueues, UpdatedAt)
VALUES (@mod1Id, 1000, 450, 10, 2, SYSUTCDATETIME());

INSERT INTO dbo.Quotas (ModeratorUserId, MessagesQuota, ConsumedMessages, QueuesQuota, ConsumedQueues, UpdatedAt)
VALUES (@mod2Id, 800, 320, 10, 1, SYSUTCDATETIME());

-- Insert messages
INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
VALUES (N'+966501234567', N'whatsapp', N'رسالة اختبار 1', N'queued', 0, SYSUTCDATETIME());

INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
VALUES (N'+966502234567', N'whatsapp', N'رسالة اختبار 2', N'queued', 1, SYSUTCDATETIME());

INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
VALUES (N'+966503234567', N'whatsapp', N'رسالة اختبار 3', N'failed', 3, SYSUTCDATETIME());

INSERT INTO dbo.Messages (RecipientPhone, Channel, Content, Status, Attempts, CreatedAt)
VALUES (N'+966504234567', N'whatsapp', N'رسالة اختبار 4', N'failed', 2, SYSUTCDATETIME());

SELECT 'Seeding completed successfully!' as Status;
