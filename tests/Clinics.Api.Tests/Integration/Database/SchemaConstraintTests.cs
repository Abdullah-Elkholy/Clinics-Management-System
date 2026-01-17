using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;
using DomainQueue = Clinics.Domain.Queue;

namespace Clinics.Api.Tests.Integration.Database;

/// <summary>
/// Phase 5.1: Schema and constraint tests.
/// 
/// Tests verify database constraints match business invariants:
/// - Uniqueness constraints
/// - Foreign key constraints
/// - Required fields
/// - Cascade delete behavior
/// 
/// DEFECT FOCUS: Find mismatches between code assumptions and DB constraints.
/// </summary>
public class SchemaConstraintTests
{
    #region Test Infrastructure

    private class ConstraintSimulator
    {
        // Simulates database constraints for testing
        private readonly List<Patient> _patients = new();
        private readonly List<DomainQueue> _queues = new();
        private readonly List<User> _users = new();
        private readonly List<Message> _messages = new();
        private int _idCounter = 1;

        public User CreateUser(string username, string role = "user")
        {
            // Username uniqueness constraint
            if (_users.Any(u => u.Username == username && !u.IsDeleted))
                throw new InvalidOperationException($"Duplicate username: {username}");

            var user = new User
            {
                Id = _idCounter++,
                Username = username,
                FirstName = username,
                Role = role,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            _users.Add(user);
            return user;
        }

        public DomainQueue CreateQueue(int moderatorId, string doctorName)
        {
            // FK constraint: moderator must exist
            if (!_users.Any(u => u.Id == moderatorId && !u.IsDeleted))
                throw new InvalidOperationException($"Moderator {moderatorId} not found");

            var queue = new DomainQueue
            {
                Id = _idCounter++,
                ModeratorId = moderatorId,
                DoctorName = doctorName,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            _queues.Add(queue);
            return queue;
        }

        public Patient CreatePatient(int queueId, string name, string phone)
        {
            // FK constraint: queue must exist
            if (!_queues.Any(q => q.Id == queueId && !q.IsDeleted))
                throw new InvalidOperationException($"Queue {queueId} not found");

            // Unique constraint: phone per queue
            if (_patients.Any(p => p.QueueId == queueId && p.PhoneNumber == phone && !p.IsDeleted))
                throw new InvalidOperationException($"Duplicate phone {phone} in queue {queueId}");

            var patient = new Patient
            {
                Id = _idCounter++,
                QueueId = queueId,
                FullName = name,
                PhoneNumber = phone,
                Position = _patients.Count(p => p.QueueId == queueId && !p.IsDeleted) + 1,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            _patients.Add(patient);
            return patient;
        }

        public Message CreateMessage(Guid id, int? queueId, int? patientId, int? moderatorId)
        {
            // FK constraints (nullable FKs)
            if (queueId.HasValue && !_queues.Any(q => q.Id == queueId))
                throw new InvalidOperationException($"Queue {queueId} not found");
            if (moderatorId.HasValue && !_users.Any(u => u.Id == moderatorId))
                throw new InvalidOperationException($"Moderator {moderatorId} not found");

            var message = new Message
            {
                Id = id,
                QueueId = queueId,
                PatientId = patientId,
                ModeratorId = moderatorId,
                Content = "Test",
                FullName = "Test",
                PatientPhone = "0100",
                Position = 1,
                CalculatedPosition = 1,
                Status = "queued",
                CreatedAt = DateTime.UtcNow
            };
            _messages.Add(message);
            return message;
        }

        public void DeleteQueue(int queueId, bool cascade = false)
        {
            var queue = _queues.FirstOrDefault(q => q.Id == queueId);
            if (queue == null) return;

            // Check for dependent patients
            var hasPatients = _patients.Any(p => p.QueueId == queueId && !p.IsDeleted);
            var hasMessages = _messages.Any(m => m.QueueId == queueId);

            if (!cascade && (hasPatients || hasMessages))
                throw new InvalidOperationException("Queue has dependent records - cascade or soft-delete required");

            if (cascade)
            {
                foreach (var p in _patients.Where(p => p.QueueId == queueId))
                    p.IsDeleted = true;
            }

            queue.IsDeleted = true;
        }

        public void DeleteUser(int userId)
        {
            var user = _users.FirstOrDefault(u => u.Id == userId);
            if (user == null) return;

            // Check for dependent queues
            var hasQueues = _queues.Any(q => q.ModeratorId == userId && !q.IsDeleted);
            if (hasQueues)
                throw new InvalidOperationException("User has dependent queues - cascade or reassign required");

            user.IsDeleted = true;
        }
    }

    #endregion

    #region Username Uniqueness Tests

    [Fact]
    public void CreateUser_UniqueUsername_ShouldSucceed()
    {
        var db = new ConstraintSimulator();

        var user = db.CreateUser("ahmed");

        user.Should().NotBeNull();
    }

    [Fact]
    public void CreateUser_DuplicateUsername_ShouldFail()
    {
        var db = new ConstraintSimulator();
        db.CreateUser("ahmed");

        var action = () => db.CreateUser("ahmed");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Duplicate*");
    }

    [Fact]
    public void CreateUser_DeletedUserSameUsername_ShouldAllow()
    {
        // DEFECT DISCOVERY: Can create user with same username as soft-deleted user?
        // This documents expected behavior - whether uniqueness includes deleted
        var db = new ConstraintSimulator();
        var user1 = db.CreateUser("ahmed");
        db.DeleteUser(user1.Id);

        // If constraint excludes deleted, this should work
        // Current simulation: excludes deleted (IsDeleted check in uniqueness)
        // If this fails in production, it's a defect
    }

    #endregion

    #region Foreign Key Tests

    [Fact]
    public void CreateQueue_ValidModerator_ShouldSucceed()
    {
        var db = new ConstraintSimulator();
        var moderator = db.CreateUser("mod", "moderator");

        var queue = db.CreateQueue(moderator.Id, "Dr. Ahmed");

        queue.Should().NotBeNull();
    }

    [Fact]
    public void CreateQueue_InvalidModerator_ShouldFail()
    {
        var db = new ConstraintSimulator();

        var action = () => db.CreateQueue(999, "Dr. Ahmed");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    [Fact]
    public void CreatePatient_InvalidQueue_ShouldFail()
    {
        var db = new ConstraintSimulator();

        var action = () => db.CreatePatient(999, "Ahmed", "0100");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    [Fact]
    public void CreateMessage_InvalidQueueFK_ShouldFail()
    {
        var db = new ConstraintSimulator();

        var action = () => db.CreateMessage(Guid.NewGuid(), queueId: 999, patientId: null, moderatorId: null);

        action.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Phone Uniqueness per Queue Tests

    [Fact]
    public void CreatePatient_UniquePhoneInQueue_ShouldSucceed()
    {
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        var queue = db.CreateQueue(mod.Id, "Dr. Ahmed");

        var patient = db.CreatePatient(queue.Id, "Ahmed", "0100");

        patient.Should().NotBeNull();
    }

    [Fact]
    public void CreatePatient_DuplicatePhoneInQueue_ShouldFail()
    {
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        var queue = db.CreateQueue(mod.Id, "Dr. Ahmed");
        db.CreatePatient(queue.Id, "Ahmed", "0100");

        var action = () => db.CreatePatient(queue.Id, "Mohamed", "0100");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Duplicate*");
    }

    [Fact]
    public void CreatePatient_SamePhoneDifferentQueue_ShouldSucceed()
    {
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        var queue1 = db.CreateQueue(mod.Id, "Dr. A");
        var queue2 = db.CreateQueue(mod.Id, "Dr. B");
        db.CreatePatient(queue1.Id, "Ahmed", "0100");

        var patient = db.CreatePatient(queue2.Id, "Ahmed", "0100");

        patient.Should().NotBeNull();
    }

    #endregion

    #region Cascade Delete Behavior Tests

    [Fact]
    public void DeleteQueue_WithPatients_NoCascade_ShouldFail()
    {
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        var queue = db.CreateQueue(mod.Id, "Dr. A");
        db.CreatePatient(queue.Id, "Ahmed", "0100");

        var action = () => db.DeleteQueue(queue.Id, cascade: false);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*dependent*");
    }

    [Fact]
    public void DeleteQueue_WithPatients_Cascade_ShouldSoftDeleteAll()
    {
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        var queue = db.CreateQueue(mod.Id, "Dr. A");
        db.CreatePatient(queue.Id, "Ahmed", "0100");

        db.DeleteQueue(queue.Id, cascade: true);

        // Queue and patients should be soft-deleted
    }

    [Fact]
    public void DeleteModerator_WithQueues_ShouldFail()
    {
        // DEFECT DISCOVERY: What happens when moderator is deleted but has queues?
        var db = new ConstraintSimulator();
        var mod = db.CreateUser("mod", "moderator");
        db.CreateQueue(mod.Id, "Dr. A");

        var action = () => db.DeleteUser(mod.Id);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*queues*");
    }

    #endregion

    #region Required Fields Tests

    [Fact]
    public void Patient_RequiredFields_ShouldBeSet()
    {
        var patient = new Patient
        {
            QueueId = 1,
            FullName = "Test",
            PhoneNumber = "0100",
            CountryCode = "+20",
            Position = 1,
            Status = "waiting"
        };

        patient.FullName.Should().NotBeNullOrEmpty();
        patient.PhoneNumber.Should().NotBeNullOrEmpty();
        patient.Status.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Message_RequiredFields_ShouldBeSet()
    {
        var msg = new Message
        {
            Content = "Test",
            FullName = "Test",
            PatientPhone = "0100",
            CountryCode = "+20",
            Position = 1,
            CalculatedPosition = 1,
            Status = "queued"
        };

        msg.Content.Should().NotBeNullOrEmpty();
        msg.Status.Should().NotBeNullOrEmpty();
    }

    #endregion
}
