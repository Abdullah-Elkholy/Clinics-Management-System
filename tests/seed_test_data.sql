-- Seed Test Data for Backend API Testing
-- Run this script to populate test data for TasksController and SessionsController

USE ClinicsManagement; -- Change to your database name
GO

-- Variables
DECLARE @QueueId INT;
DECLARE @PatientId1 INT;
DECLARE @PatientId2 INT;
DECLARE @PatientId3 INT;
DECLARE @MessageId1 BIGINT;
DECLARE @MessageId2 BIGINT;
DECLARE @MessageId3 BIGINT;
DECLARE @SessionId UNIQUEIDENTIFIER = NEWID();

-- Clean up existing test data (optional)
-- DELETE FROM FailedTasks WHERE QueueId IN (SELECT Id FROM Queues WHERE DoctorName LIKE 'د. أحمد%');
-- DELETE FROM Messages WHERE QueueId IN (SELECT Id FROM Queues WHERE DoctorName LIKE 'د. أحمد%');
-- DELETE FROM Patients WHERE QueueId IN (SELECT Id FROM Queues WHERE DoctorName LIKE 'د. أحمد%');
-- DELETE FROM MessageSessions WHERE QueueId IN (SELECT Id FROM Queues WHERE DoctorName LIKE 'د. أحمد%');
-- DELETE FROM Queues WHERE DoctorName LIKE 'د. أحمد%';

-- 1. Insert test queue
IF NOT EXISTS (SELECT 1 FROM Queues WHERE DoctorName = 'د. أحمد محمد')
BEGIN
    INSERT INTO Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes)
    VALUES ('د. أحمد محمد', 'عيادة الأسنان - اختبار', 1, 1, 15);
END
SET @QueueId = (SELECT TOP 1 Id FROM Queues WHERE DoctorName = 'د. أحمد محمد');

PRINT 'Queue ID: ' + CAST(@QueueId AS VARCHAR(10));

-- 2. Insert test patients
INSERT INTO Patients (QueueId, FullName, PhoneNumber, Position, Status)
VALUES 
    (@QueueId, 'خالد العمري', '966501234567', 1, 'waiting'),
    (@QueueId, 'محمد الشمري', '966509876543', 2, 'waiting'),
    (@QueueId, 'فاطمة الأحمدي', '966503456789', 3, 'waiting'),
    (@QueueId, 'سارة الدوسري', '966507654321', 4, 'waiting'),
    (@QueueId, 'عبدالله القحطاني', '966508765432', 5, 'waiting');

SET @PatientId1 = (SELECT TOP 1 Id FROM Patients WHERE QueueId = @QueueId AND FullName = 'خالد العمري');
SET @PatientId2 = (SELECT TOP 1 Id FROM Patients WHERE QueueId = @QueueId AND FullName = 'محمد الشمري');
SET @PatientId3 = (SELECT TOP 1 Id FROM Patients WHERE QueueId = @QueueId AND FullName = 'فاطمة الأحمدي');

PRINT 'Patient IDs: ' + CAST(@PatientId1 AS VARCHAR(10)) + ', ' + CAST(@PatientId2 AS VARCHAR(10)) + ', ' + CAST(@PatientId3 AS VARCHAR(10));

-- 3. Insert test messages (some failed)
INSERT INTO Messages (PatientId, QueueId, SenderUserId, RecipientPhone, Content, Status, Attempts, CreatedAt, LastAttemptAt)
VALUES 
    (@PatientId1, @QueueId, 1, '966501234567', 'موعدك القادم يوم الأحد الساعة 10 صباحاً مع د. أحمد محمد', 'failed', 3, DATEADD(HOUR, -2, GETUTCDATE()), DATEADD(HOUR, -1, GETUTCDATE())),
    (@PatientId2, @QueueId, 1, '966509876543', 'تذكير: موعدك غداً الساعة 2 مساءً', 'failed', 2, DATEADD(HOUR, -3, GETUTCDATE()), DATEADD(HOUR, -2, GETUTCDATE())),
    (@PatientId3, @QueueId, 1, '966503456789', 'شكراً لزيارتكم عيادة الأسنان', 'failed', 1, DATEADD(HOUR, -4, GETUTCDATE()), DATEADD(HOUR, -3, GETUTCDATE()));

SET @MessageId1 = (SELECT TOP 1 Id FROM Messages WHERE PatientId = @PatientId1 AND Status = 'failed');
SET @MessageId2 = (SELECT TOP 1 Id FROM Messages WHERE PatientId = @PatientId2 AND Status = 'failed');
SET @MessageId3 = (SELECT TOP 1 Id FROM Messages WHERE PatientId = @PatientId3 AND Status = 'failed');

PRINT 'Message IDs: ' + CAST(@MessageId1 AS VARCHAR(10)) + ', ' + CAST(@MessageId2 AS VARCHAR(10)) + ', ' + CAST(@MessageId3 AS VARCHAR(10));

-- 4. Insert failed tasks with Arabic error messages
INSERT INTO FailedTasks (MessageId, PatientId, QueueId, Reason, ProviderResponse, CreatedAt, RetryCount, LastRetryAt)
VALUES 
    (@MessageId1, @PatientId1, @QueueId, 
     'فشل الاتصال بخدمة الواتساب', 
     'Connection timeout after 30 seconds. Error code: ETIMEDOUT', 
     DATEADD(HOUR, -2, GETUTCDATE()), 
     2,
     DATEADD(HOUR, -1, GETUTCDATE())),
    
    (@MessageId2, @PatientId2, @QueueId, 
     'رقم الهاتف غير صحيح', 
     'Invalid phone number format. Expected: 966XXXXXXXXX', 
     DATEADD(HOUR, -3, GETUTCDATE()), 
     1,
     DATEADD(HOUR, -2, GETUTCDATE())),
    
    (@MessageId3, @PatientId3, @QueueId, 
     'تجاوز حد الإرسال اليومي', 
     'Rate limit exceeded: 1000 messages per day. Retry after 24h', 
     DATEADD(HOUR, -4, GETUTCDATE()), 
     0,
     NULL);

PRINT 'Failed tasks inserted successfully';

-- 5. Insert more sent messages for the active session
INSERT INTO Messages (PatientId, QueueId, SenderUserId, RecipientPhone, Content, Status, Attempts, CreatedAt, SentAt)
SELECT 
    p.Id,
    @QueueId,
    1,
    p.PhoneNumber,
    'رسالة اختبار من نظام إدارة العيادات',
    'sent',
    1,
    DATEADD(MINUTE, -ROW_NUMBER() OVER (ORDER BY p.Id), GETUTCDATE()),
    DATEADD(MINUTE, -ROW_NUMBER() OVER (ORDER BY p.Id), GETUTCDATE())
FROM Patients p
WHERE p.QueueId = @QueueId AND p.Id NOT IN (@PatientId1, @PatientId2, @PatientId3);

-- 6. Insert active message session
INSERT INTO MessageSessions (Id, QueueId, UserId, Status, TotalMessages, SentMessages, StartTime, LastUpdated)
VALUES 
    (@SessionId, @QueueId, 1, 'active', 50, 23, DATEADD(HOUR, -1, GETUTCDATE()), GETUTCDATE());

PRINT 'Message session created with ID: ' + CAST(@SessionId AS VARCHAR(50));

-- 7. Verification queries
PRINT '';
PRINT '=== VERIFICATION ===';
PRINT 'Failed Tasks Count: ' + CAST((SELECT COUNT(*) FROM FailedTasks WHERE QueueId = @QueueId) AS VARCHAR(10));
PRINT 'Active Sessions Count: ' + CAST((SELECT COUNT(*) FROM MessageSessions WHERE Status IN ('active', 'paused')) AS VARCHAR(10));
PRINT 'Total Messages: ' + CAST((SELECT COUNT(*) FROM Messages WHERE QueueId = @QueueId) AS VARCHAR(10));
PRINT 'Total Patients: ' + CAST((SELECT COUNT(*) FROM Patients WHERE QueueId = @QueueId) AS VARCHAR(10));

-- Display test data summary
SELECT 'Failed Tasks' AS DataType, COUNT(*) AS Count FROM FailedTasks WHERE QueueId = @QueueId
UNION ALL
SELECT 'Messages (Failed)', COUNT(*) FROM Messages WHERE QueueId = @QueueId AND Status = 'failed'
UNION ALL
SELECT 'Messages (Sent)', COUNT(*) FROM Messages WHERE QueueId = @QueueId AND Status = 'sent'
UNION ALL
SELECT 'Active Sessions', COUNT(*) FROM MessageSessions WHERE QueueId = @QueueId AND Status = 'active'
UNION ALL
SELECT 'Patients', COUNT(*) FROM Patients WHERE QueueId = @QueueId;

PRINT '';
PRINT '✅ Test data seeded successfully!';
PRINT 'You can now test the APIs with:';
PRINT '  - GET /api/Tasks/failed';
PRINT '  - POST /api/Tasks/retry';
PRINT '  - DELETE /api/Tasks/failed';
PRINT '  - GET /api/Sessions/ongoing';
PRINT '  - POST /api/Sessions/' + CAST(@SessionId AS VARCHAR(50)) + '/pause';
PRINT '  - POST /api/Sessions/' + CAST(@SessionId AS VARCHAR(50)) + '/resume';
PRINT '  - DELETE /api/Sessions/' + CAST(@SessionId AS VARCHAR(50));
