using System;
using System.Collections.Generic;

namespace Clinics.Tests.Common
{
    /// <summary>
    /// Test entity builders for deterministic data seeding.
    /// Use builders in tests to create consistent test data without coupling to database schema.
    /// </summary>

    /// <summary>
    /// Builder for creating test Clinic DTOs (for API requests).
    /// </summary>
    public class ClinicDtoBuilder
    {
        private string _name = "Test Clinic";
        private string _location = "Test Location";
        private bool _isActive = true;
        private DateTime? _createdAt = DateTime.UtcNow;

        public ClinicDtoBuilder WithName(string name)
        {
            _name = name;
            return this;
        }

        public ClinicDtoBuilder WithLocation(string location)
        {
            _location = location;
            return this;
        }

        public ClinicDtoBuilder IsActive(bool active)
        {
            _isActive = active;
            return this;
        }

        public ClinicDtoBuilder WithCreatedAt(DateTime createdAt)
        {
            _createdAt = createdAt;
            return this;
        }

        public dynamic Build()
        {
            return new
            {
                name = _name,
                location = _location,
                isActive = _isActive,
                createdAt = _createdAt
            };
        }
    }

    /// <summary>
    /// Builder for creating test Patient DTOs (for API requests).
    /// </summary>
    public class PatientDtoBuilder
    {
        private string _fullName = "Test Patient";
        private string _phoneNumber = "+201234567890";
        private int _clinicId = 1;
        private int? _position = null;
        private string _status = "waiting";

        public PatientDtoBuilder WithName(string name)
        {
            _fullName = name;
            return this;
        }

        public PatientDtoBuilder WithPhone(string phone)
        {
            _phoneNumber = phone;
            return this;
        }

        public PatientDtoBuilder WithClinicId(int clinicId)
        {
            _clinicId = clinicId;
            return this;
        }

        public PatientDtoBuilder WithPosition(int? position)
        {
            _position = position;
            return this;
        }

        public PatientDtoBuilder WithStatus(string status)
        {
            _status = status;
            return this;
        }

        public dynamic Build()
        {
            var obj = new Dictionary<string, object>
            {
                { "fullName", _fullName },
                { "phoneNumber", _phoneNumber },
                { "clinicId", _clinicId },
                { "status", _status }
            };

            if (_position.HasValue)
            {
                obj["position"] = _position.Value;
            }

            return obj;
        }
    }

    /// <summary>
    /// Builder for creating test Appointment DTOs (for API requests).
    /// </summary>
    public class AppointmentDtoBuilder
    {
        private int _patientId = 1;
        private int _clinicId = 1;
        private DateTime _appointmentTime = DateTime.UtcNow.AddHours(1);
        private TimeSpan _duration = TimeSpan.FromMinutes(30);
        private string _notes = "";
        private string? _resourceId = null;

        public AppointmentDtoBuilder WithPatientId(int patientId)
        {
            _patientId = patientId;
            return this;
        }

        public AppointmentDtoBuilder WithClinicId(int clinicId)
        {
            _clinicId = clinicId;
            return this;
        }

        public AppointmentDtoBuilder WithTime(DateTime appointmentTime)
        {
            _appointmentTime = appointmentTime;
            return this;
        }

        public AppointmentDtoBuilder WithDuration(TimeSpan duration)
        {
            _duration = duration;
            return this;
        }

        public AppointmentDtoBuilder WithNotes(string notes)
        {
            _notes = notes;
            return this;
        }

        public AppointmentDtoBuilder WithResourceId(string? resourceId)
        {
            _resourceId = resourceId;
            return this;
        }

        public dynamic Build()
        {
            return new
            {
                patientId = _patientId,
                clinicId = _clinicId,
                appointmentTime = _appointmentTime,
                duration = _duration.TotalMinutes,
                notes = _notes,
                resourceId = _resourceId
            };
        }
    }

    /// <summary>
    /// Builder for creating test Condition DTOs (for API requests).
    /// </summary>
    public class ConditionDtoBuilder
    {
        private string _code = "COND001";
        private string _name = "Test Condition";
        private string _category = "Medical";
        private List<string> _conflictsWith = new();

        public ConditionDtoBuilder WithCode(string code)
        {
            _code = code;
            return this;
        }

        public ConditionDtoBuilder WithName(string name)
        {
            _name = name;
            return this;
        }

        public ConditionDtoBuilder WithCategory(string category)
        {
            _category = category;
            return this;
        }

        public ConditionDtoBuilder ConflictsWith(string conditionCode)
        {
            _conflictsWith.Add(conditionCode);
            return this;
        }

        public ConditionDtoBuilder ConflictsWith(params string[] conditionCodes)
        {
            _conflictsWith.AddRange(conditionCodes);
            return this;
        }

        public dynamic Build()
        {
            return new
            {
                code = _code,
                name = _name,
                category = _category,
                conflictsWith = _conflictsWith
            };
        }
    }

    /// <summary>
    /// Builder for creating test Login Request DTOs.
    /// </summary>
    public class LoginRequestBuilder
    {
        private string _username = "admin";
        private string _password = "admin123";

        public LoginRequestBuilder WithUsername(string username)
        {
            _username = username;
            return this;
        }

        public LoginRequestBuilder WithPassword(string password)
        {
            _password = password;
            return this;
        }

        public dynamic Build()
        {
            return new
            {
                username = _username,
                password = _password
            };
        }
    }

    /// <summary>
    /// Test data factory for commonly-used entity sets.
    /// </summary>
    public static class TestDataFactory
    {
        /// <summary>
        /// Creates a valid clinic DTO.
        /// </summary>
        public static dynamic CreateValidClinic(string? name = null)
        {
            return new ClinicDtoBuilder()
                .WithName(name ?? $"Test Clinic {Guid.NewGuid().ToString().Substring(0, 8)}")
                .Build();
        }

        /// <summary>
        /// Creates a valid patient DTO with normalized phone.
        /// </summary>
        public static dynamic CreateValidPatient(int clinicId = 1, string? phone = null)
        {
            return new PatientDtoBuilder()
                .WithClinicId(clinicId)
                .WithPhone(phone ?? "+201234567890")
                .WithName($"Patient {Guid.NewGuid().ToString().Substring(0, 8)}")
                .Build();
        }

        /// <summary>
        /// Creates a valid appointment DTO.
        /// </summary>
        public static dynamic CreateValidAppointment(int patientId = 1, int clinicId = 1)
        {
            return new AppointmentDtoBuilder()
                .WithPatientId(patientId)
                .WithClinicId(clinicId)
                .WithTime(DateTime.UtcNow.AddHours(1))
                .Build();
        }

        /// <summary>
        /// Creates a valid login request.
        /// </summary>
        public static dynamic CreateValidLoginRequest(string username = "admin", string password = "admin123")
        {
            return new LoginRequestBuilder()
                .WithUsername(username)
                .WithPassword(password)
                .Build();
        }

        /// <summary>
        /// Creates a phone number with different country code for testing variations.
        /// </summary>
        public static string CreatePhoneNumber(string countryCode = "+20", string number = "1234567890")
        {
            return $"{countryCode}{number}";
        }
    }
}
