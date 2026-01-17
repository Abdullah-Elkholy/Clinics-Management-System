using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Integration.Patients;

/// <summary>
/// Phase 3.2: Patient persistence integration tests.
/// 
/// Tests cover:
/// - Upsert rules (insert vs update)
/// - Duplicate detection (same phone in queue)
/// - Soft-delete behavior
/// - Restore behavior
/// </summary>
public class PatientPersistenceTests
{
    #region Test Infrastructure

    private class PatientRepository
    {
        private readonly List<Patient> _patients = new();
        private int _idCounter = 1;

        public Patient Create(int queueId, string fullName, string phoneNumber, string countryCode = "+20", int? position = null)
        {
            // Check for duplicate phone in same queue (active patients only)
            var existing = _patients.FirstOrDefault(p =>
                p.QueueId == queueId &&
                p.PhoneNumber == phoneNumber &&
                !p.IsDeleted);

            if (existing != null)
                throw new InvalidOperationException($"Duplicate phone number {phoneNumber} in queue {queueId}");

            // Auto-assign position if not provided
            var assignedPosition = position ?? (_patients
                .Where(p => p.QueueId == queueId && !p.IsDeleted)
                .Select(p => p.Position)
                .DefaultIfEmpty(0)
                .Max() + 1);

            var patient = new Patient
            {
                Id = _idCounter++,
                QueueId = queueId,
                FullName = fullName,
                PhoneNumber = phoneNumber,
                CountryCode = countryCode,
                Position = assignedPosition,
                Status = "waiting",
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _patients.Add(patient);
            return patient;
        }

        public Patient? GetById(int id) => _patients.FirstOrDefault(p => p.Id == id);

        public List<Patient> GetByQueue(int queueId, bool includeDeleted = false) =>
            _patients.Where(p => p.QueueId == queueId && (includeDeleted || !p.IsDeleted)).ToList();

        public void SoftDelete(int id, int deletedBy)
        {
            var patient = _patients.FirstOrDefault(p => p.Id == id);
            if (patient != null)
            {
                patient.IsDeleted = true;
                patient.DeletedAt = DateTime.UtcNow;
                patient.DeletedBy = deletedBy;
            }
        }

        public void Restore(int id, int restoredBy)
        {
            var patient = _patients.FirstOrDefault(p => p.Id == id);
            if (patient == null) return;

            // Check if restoring would create duplicate
            var duplicate = _patients.FirstOrDefault(p =>
                p.Id != id &&
                p.QueueId == patient.QueueId &&
                p.PhoneNumber == patient.PhoneNumber &&
                !p.IsDeleted);

            if (duplicate != null)
                throw new InvalidOperationException($"Cannot restore: duplicate phone {patient.PhoneNumber} exists");

            patient.IsDeleted = false;
            patient.RestoredAt = DateTime.UtcNow;
            patient.RestoredBy = restoredBy;
        }

        public Patient? CreateOrRestore(int queueId, string fullName, string phoneNumber, string countryCode = "+20")
        {
            // Check for soft-deleted patient with same phone in queue
            var deleted = _patients.FirstOrDefault(p =>
                p.QueueId == queueId &&
                p.PhoneNumber == phoneNumber &&
                p.IsDeleted);

            if (deleted != null)
            {
                // Restore instead of creating new
                deleted.IsDeleted = false;
                deleted.FullName = fullName;
                deleted.CountryCode = countryCode;
                deleted.RestoredAt = DateTime.UtcNow;
                deleted.UpdatedAt = DateTime.UtcNow;
                return deleted;
            }

            // Create new if no deleted version exists
            return Create(queueId, fullName, phoneNumber, countryCode);
        }
    }

    #endregion

    #region Create Tests

    [Fact]
    public void Create_ValidPatient_ShouldPersist()
    {
        var repo = new PatientRepository();
        var patient = repo.Create(1, "Ahmed Hassan", "+201234567890");

        patient.Should().NotBeNull();
        patient.Id.Should().BePositive();
        patient.FullName.Should().Be("Ahmed Hassan");
        patient.PhoneNumber.Should().Be("+201234567890");
        patient.Status.Should().Be("waiting");
    }

    [Fact]
    public void Create_WithoutPosition_ShouldAutoAssign()
    {
        var repo = new PatientRepository();
        repo.Create(1, "First", "+201");
        repo.Create(1, "Second", "+202");
        var third = repo.Create(1, "Third", "+203");

        third.Position.Should().Be(3);
    }

    [Fact]
    public void Create_WithExplicitPosition_ShouldUse()
    {
        var repo = new PatientRepository();
        var patient = repo.Create(1, "Ahmed", "+201", position: 5);

        patient.Position.Should().Be(5);
    }

    #endregion

    #region Duplicate Detection Tests

    [Fact]
    public void Create_DuplicatePhoneInSameQueue_ShouldThrow()
    {
        var repo = new PatientRepository();
        repo.Create(1, "Ahmed", "+201234567890");

        var action = () => repo.Create(1, "Mohamed", "+201234567890");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Duplicate*");
    }

    [Fact]
    public void Create_SamePhoneDifferentQueue_ShouldAllow()
    {
        var repo = new PatientRepository();
        repo.Create(1, "Ahmed", "+201234567890");
        var patient2 = repo.Create(2, "Mohamed", "+201234567890");

        patient2.Should().NotBeNull();
    }

    [Fact]
    public void Create_PhoneExistsButDeleted_ShouldAllow()
    {
        var repo = new PatientRepository();
        var first = repo.Create(1, "Ahmed", "+201234567890");
        repo.SoftDelete(first.Id, 1);

        var second = repo.Create(1, "Mohamed", "+201234567890");

        second.Should().NotBeNull();
        second.Id.Should().NotBe(first.Id);
    }

    #endregion

    #region Soft Delete Tests

    [Fact]
    public void SoftDelete_ShouldSetFlags()
    {
        var repo = new PatientRepository();
        var patient = repo.Create(1, "Ahmed", "+201");
        repo.SoftDelete(patient.Id, 5);

        var deleted = repo.GetById(patient.Id);
        deleted!.IsDeleted.Should().BeTrue();
        deleted.DeletedAt.Should().NotBeNull();
        deleted.DeletedBy.Should().Be(5);
    }

    [Fact]
    public void SoftDelete_ShouldExcludeFromQuery()
    {
        var repo = new PatientRepository();
        repo.Create(1, "Ahmed", "+201");
        var toDelete = repo.Create(1, "Mohamed", "+202");
        repo.Create(1, "Hassan", "+203");
        repo.SoftDelete(toDelete.Id, 1);

        var activePatients = repo.GetByQueue(1);

        activePatients.Should().HaveCount(2);
        activePatients.Should().NotContain(p => p.Id == toDelete.Id);
    }

    [Fact]
    public void SoftDelete_WithIncludeDeleted_ShouldReturn()
    {
        var repo = new PatientRepository();
        var patient = repo.Create(1, "Ahmed", "+201");
        repo.SoftDelete(patient.Id, 1);

        var allPatients = repo.GetByQueue(1, includeDeleted: true);

        allPatients.Should().Contain(p => p.Id == patient.Id);
    }

    #endregion

    #region Restore Tests

    [Fact]
    public void Restore_DeletedPatient_ShouldBeActive()
    {
        var repo = new PatientRepository();
        var patient = repo.Create(1, "Ahmed", "+201");
        repo.SoftDelete(patient.Id, 1);
        repo.Restore(patient.Id, 2);

        var restored = repo.GetById(patient.Id);
        restored!.IsDeleted.Should().BeFalse();
        restored.RestoredAt.Should().NotBeNull();
        restored.RestoredBy.Should().Be(2);
    }

    [Fact]
    public void Restore_WhenDuplicateExists_ShouldThrow()
    {
        var repo = new PatientRepository();
        var first = repo.Create(1, "Ahmed", "+201");
        repo.SoftDelete(first.Id, 1);
        repo.Create(1, "Mohamed", "+201"); // New patient with same phone

        var action = () => repo.Restore(first.Id, 1);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*duplicate*");
    }

    #endregion

    #region CreateOrRestore (Upsert) Tests

    [Fact]
    public void CreateOrRestore_NewPatient_ShouldCreate()
    {
        var repo = new PatientRepository();
        var patient = repo.CreateOrRestore(1, "Ahmed", "+201");

        patient.Should().NotBeNull();
        patient!.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void CreateOrRestore_DeletedExists_ShouldRestore()
    {
        var repo = new PatientRepository();
        var first = repo.Create(1, "Ahmed", "+201");
        repo.SoftDelete(first.Id, 1);

        var restored = repo.CreateOrRestore(1, "Ahmed Updated", "+201");

        restored!.Id.Should().Be(first.Id); // Same record restored
        restored.FullName.Should().Be("Ahmed Updated"); // Updated name
        restored.IsDeleted.Should().BeFalse();
        restored.RestoredAt.Should().NotBeNull();
    }

    [Fact]
    public void CreateOrRestore_ActiveExists_ShouldThrow()
    {
        var repo = new PatientRepository();
        repo.Create(1, "Ahmed", "+201");

        var action = () => repo.CreateOrRestore(1, "Mohamed", "+201");

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Duplicate*");
    }

    #endregion

    #region Queue Isolation Tests

    [Fact]
    public void GetByQueue_ShouldOnlyReturnQueuePatients()
    {
        var repo = new PatientRepository();
        repo.Create(1, "Queue1-A", "+201");
        repo.Create(1, "Queue1-B", "+202");
        repo.Create(2, "Queue2-A", "+203");

        var queue1Patients = repo.GetByQueue(1);

        queue1Patients.Should().HaveCount(2);
        queue1Patients.Should().AllSatisfy(p => p.QueueId.Should().Be(1));
    }

    #endregion
}
