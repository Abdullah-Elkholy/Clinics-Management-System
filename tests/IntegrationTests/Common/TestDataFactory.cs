using Clinics.Domain;
using System;
using System.Collections.Generic;

namespace IntegrationTests.Common;

/// <summary>
/// Builder factory for test domain entities.
/// Provides deterministic, reusable seeds for Users (all roles), Queues, Templates, Conditions (full operator matrix), and supporting entities.
/// Usage: new TestUserBuilder().WithRole("primary_admin").Build()
/// </summary>
public static class TestDataFactory
{
    // === USERS ===
    public class TestUserBuilder
    {
        private int _id = 1;
        private string _username = "testuser";
        private string _firstName = "Test";
        private string _lastName = "User";
        private string _role = "user";
        private int? _moderatorId;

        public TestUserBuilder WithId(int id) { _id = id; return this; }
        public TestUserBuilder WithUsername(string username) { _username = username; return this; }
        public TestUserBuilder WithName(string first, string last) { _firstName = first; _lastName = last; return this; }
        public TestUserBuilder WithRole(string role) { _role = role; return this; }
        public TestUserBuilder WithModeratorId(int? moderatorId) { _moderatorId = moderatorId; return this; }

        public User Build()
        {
            return new User
            {
                Id = _id,
                Username = _username,
                FirstName = _firstName,
                LastName = _lastName,
                Role = _role,
                ModeratorId = _moderatorId,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestUserBuilder CreateUser() => new();
    public static User CreatePrimaryAdmin(int id = 1) => CreateUser().WithId(id).WithUsername("admin").WithName("Primary", "Admin").WithRole("primary_admin").Build();
    public static User CreateModerator(int id = 2) => CreateUser().WithId(id).WithUsername("moderator1").WithName("Mod", "One").WithRole("moderator").Build();
    public static User CreateRegularUser(int id = 3, int? moderatorId = 2) => CreateUser().WithId(id).WithUsername("user1").WithName("Regular", "User").WithRole("user").WithModeratorId(moderatorId).Build();

    // === QUEUES ===
    public class TestQueueBuilder
    {
        private int _id = 1;
        private string _doctorName = "Dr. Ahmed";
        private int _createdBy = 1;
        private int _moderatorId = 1;
        private int _currentPosition = 1;

        public TestQueueBuilder WithId(int id) { _id = id; return this; }
        public TestQueueBuilder WithDoctorName(string name) { _doctorName = name; return this; }
        public TestQueueBuilder WithCreatedBy(int userId) { _createdBy = userId; return this; }
        public TestQueueBuilder WithModerator(int moderatorId) { _moderatorId = moderatorId; return this; }
        public TestQueueBuilder WithCurrentPosition(int pos) { _currentPosition = pos; return this; }

        public Queue Build()
        {
            return new Queue
            {
                Id = _id,
                DoctorName = _doctorName,
                CreatedBy = _createdBy,
                ModeratorId = _moderatorId,
                CurrentPosition = _currentPosition,
                EstimatedWaitMinutes = 15,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestQueueBuilder CreateQueue() => new();
    public static Queue CreateQueueForDoctor(int queueId = 1, string doctorName = "Dr. Ahmed", int moderatorId = 1)
        => CreateQueue().WithId(queueId).WithDoctorName(doctorName).WithModerator(moderatorId).Build();

    // === MESSAGE TEMPLATES ===
    public class TestTemplateBuilder
    {
        private int _id = 1;
        private string _title = "Welcome Message";
        private string _content = "Hello {{PatientName}}, welcome!";
        private int _createdBy = 1;

        public TestTemplateBuilder WithId(int id) { _id = id; return this; }
        public TestTemplateBuilder WithTitle(string title) { _title = title; return this; }
        public TestTemplateBuilder WithContent(string content) { _content = content; return this; }
        public TestTemplateBuilder WithCreatedBy(int userId) { _createdBy = userId; return this; }

        public MessageTemplate Build()
        {
            return new MessageTemplate
            {
                Id = _id,
                Title = _title,
                Content = _content,
                CreatedBy = _createdBy,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestTemplateBuilder CreateTemplate() => new();
    public static MessageTemplate CreateTemplateWelcome(int id = 1) => CreateTemplate().WithId(id).WithTitle("Welcome").WithContent("Hello!").Build();
    public static MessageTemplate CreateTemplateReminder(int id = 2) => CreateTemplate().WithId(id).WithTitle("AppointmentReminder").WithContent("Your appointment is coming up.").Build();
    public static MessageTemplate CreateTemplateDefault(int id = 3) => CreateTemplate().WithId(id).WithTitle("Default Message").WithContent("Standard message.").Build();

    // === CONDITIONS (OPERATOR MATRIX) ===
    public class TestConditionBuilder
    {
        private int _id = 1;
        private int _templateId = 1;
        private int _queueId = 1;
        private string _operator = "UNCONDITIONED";
        private int? _value;
        private int? _minValue;
        private int? _maxValue;

        public TestConditionBuilder WithId(int id) { _id = id; return this; }
        public TestConditionBuilder WithTemplate(int templateId) { _templateId = templateId; return this; }
        public TestConditionBuilder WithQueue(int queueId) { _queueId = queueId; return this; }
        public TestConditionBuilder WithOperator(string op) { _operator = op; return this; }
        public TestConditionBuilder WithValue(int? val) { _value = val; return this; }
        public TestConditionBuilder WithRange(int? min, int? max) { _minValue = min; _maxValue = max; return this; }

        public MessageCondition Build()
        {
            return new MessageCondition
            {
                Id = _id,
                TemplateId = _templateId,
                QueueId = _queueId,
                Operator = _operator,
                Value = _value,
                MinValue = _minValue,
                MaxValue = _maxValue,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestConditionBuilder CreateCondition() => new();

    // Operator matrix seeds: one per type, plus overlapping/non-overlapping variants
    public static List<MessageCondition> CreateOperatorMatrix(int templateId = 1, int queueId = 1)
    {
        return new List<MessageCondition>
        {
            new TestConditionBuilder().WithId(1).WithTemplate(templateId).WithQueue(queueId).WithOperator("UNCONDITIONED").Build(),
            new TestConditionBuilder().WithId(2).WithTemplate(templateId + 1).WithQueue(queueId).WithOperator("DEFAULT").Build(),
            new TestConditionBuilder().WithId(3).WithTemplate(templateId + 2).WithQueue(queueId).WithOperator("EQUAL").WithValue(5).Build(),
            new TestConditionBuilder().WithId(4).WithTemplate(templateId + 3).WithQueue(queueId).WithOperator("GREATER").WithValue(10).Build(),
            new TestConditionBuilder().WithId(5).WithTemplate(templateId + 4).WithQueue(queueId).WithOperator("LESS").WithValue(3).Build(),
            new TestConditionBuilder().WithId(6).WithTemplate(templateId + 5).WithQueue(queueId).WithOperator("RANGE").WithRange(15, 25).Build(),
        };
    }

    // Non-overlapping RANGE variants for testing overlap detection
    public static MessageCondition CreateRangeCondition(int id, int templateId, int queueId, int minVal, int maxVal)
        => new TestConditionBuilder().WithId(id).WithTemplate(templateId).WithQueue(queueId)
            .WithOperator("RANGE").WithRange(minVal, maxVal).Build();

    // === PATIENTS ===
    public class TestPatientBuilder
    {
        private int _id = 1;
        private int _queueId = 1;
        private string _fullName = "John Doe";
        private string _phoneNumber = "+1234567890";
        private int _position = 1;

        public TestPatientBuilder WithId(int id) { _id = id; return this; }
        public TestPatientBuilder WithQueue(int queueId) { _queueId = queueId; return this; }
        public TestPatientBuilder WithName(string name) { _fullName = name; return this; }
        public TestPatientBuilder WithPhone(string phone) { _phoneNumber = phone; return this; }
        public TestPatientBuilder WithPosition(int pos) { _position = pos; return this; }

        public Patient Build()
        {
            return new Patient
            {
                Id = _id,
                QueueId = _queueId,
                FullName = _fullName,
                PhoneNumber = _phoneNumber,
                Position = _position,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestPatientBuilder CreatePatient() => new();
    public static List<Patient> CreatePatientBatch(int queueId, int count = 5)
    {
        var patients = new List<Patient>();
        for (int i = 1; i <= count; i++)
        {
            patients.Add(new TestPatientBuilder()
                .WithId(i)
                .WithQueue(queueId)
                .WithName($"Patient {i}")
                .WithPhone($"+123456789{i}")
                .WithPosition(i)
                .Build());
        }
        return patients;
    }

    // === MESSAGES ===
    public class TestMessageBuilder
    {
        private int _id = 1;
        private int _templateId = 1;
        private int _patientId = 1;
        private int _queueId = 1;
        private string _status = "pending";

        public TestMessageBuilder WithId(int id) { _id = id; return this; }
        public TestMessageBuilder WithTemplate(int templateId) { _templateId = templateId; return this; }
        public TestMessageBuilder WithPatient(int patientId) { _patientId = patientId; return this; }
        public TestMessageBuilder WithQueue(int queueId) { _queueId = queueId; return this; }
        public TestMessageBuilder WithStatus(string status) { _status = status; return this; }

        public Message Build()
        {
            return new Message
            {
                Id = _id,
                TemplateId = _templateId,
                PatientId = _patientId,
                QueueId = _queueId,
                Status = _status,
                Content = "Test message content",
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
        }
    }

    public static TestMessageBuilder CreateMessage() => new();

    // === QUOTAS ===
    public class TestQuotaBuilder
    {
        private int _id = 1;
        private int _moderatorUserId = 1;
        private int _messagesQuota = 1000;
        private int _consumedMessages = 0;
        private int _queuesQuota = 50;
        private int _consumedQueues = 0;

        public TestQuotaBuilder WithId(int id) { _id = id; return this; }
        public TestQuotaBuilder WithModerator(int moderatorUserId) { _moderatorUserId = moderatorUserId; return this; }
        public TestQuotaBuilder WithMessagesQuota(int limit) { _messagesQuota = limit; return this; }
        public TestQuotaBuilder WithConsumedMessages(int consumed) { _consumedMessages = consumed; return this; }
        public TestQuotaBuilder WithQueuesQuota(int limit) { _queuesQuota = limit; return this; }
        public TestQuotaBuilder WithConsumedQueues(int consumed) { _consumedQueues = consumed; return this; }

        public Quota Build()
        {
            return new Quota
            {
                Id = _id,
                ModeratorUserId = _moderatorUserId,
                MessagesQuota = _messagesQuota,
                ConsumedMessages = _consumedMessages,
                QueuesQuota = _queuesQuota,
                ConsumedQueues = _consumedQueues,
                UpdatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
        }
    }

    public static TestQuotaBuilder CreateQuota() => new();
}
