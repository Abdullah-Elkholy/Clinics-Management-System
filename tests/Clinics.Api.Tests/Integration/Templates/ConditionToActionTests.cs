using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Integration.Templates;

/// <summary>
/// Phase 2.2: Integration tests for condition-to-action flow.
/// 
/// Tests the complete flow from:
/// - Template selection based on patient position
/// - Message content resolution with variables
/// - Message creation with correct properties
/// </summary>
public class ConditionToActionTests
{
    #region Test Infrastructure

    private class MessageGenerationSimulator
    {
        private readonly List<MessageTemplate> _templates = new();
        private readonly List<MessageCondition> _conditions = new();
        private readonly List<Message> _generatedMessages = new();
        private int _queueId = 1;
        private int _patientIdCounter = 1;

        // Simple patient data holder for testing
        private readonly Dictionary<int, (string Name, string Phone, int Position)> _patients = new();

        public int CreateQueue()
        {
            return _queueId++;
        }

        public int CreateTemplate(int queueId, string content, string conditionOperator = "UNCONDITIONED",
            int? value = null, int? minValue = null, int? maxValue = null)
        {
            var template = new MessageTemplate
            {
                Id = _templates.Count + 1,
                QueueId = queueId,
                Content = content,
                CreatedAt = DateTime.UtcNow
            };
            _templates.Add(template);

            var condition = new MessageCondition
            {
                Id = _conditions.Count + 1,
                QueueId = queueId,
                TemplateId = template.Id,
                Operator = conditionOperator,
                Value = value,
                MinValue = minValue,
                MaxValue = maxValue,
                CreatedAt = DateTime.UtcNow
            };
            _conditions.Add(condition);

            template.MessageConditionId = condition.Id;
            return template.Id;
        }

        public int CreatePatient(string name, string phone, int position = 1)
        {
            var patientId = _patientIdCounter++;
            _patients[patientId] = (name, phone, position);
            return patientId;
        }

        public void MarkConditionDeleted(int conditionId)
        {
            var condition = _conditions.FirstOrDefault(c => c.Id == conditionId);
            if (condition != null) condition.IsDeleted = true;
        }

        /// <summary>
        /// Simulates Send flow: select template, resolve content, create message
        /// </summary>
        public Message? GenerateMessage(int queueId, int patientId, int moderatorId = 1)
        {
            if (!_patients.TryGetValue(patientId, out var patientData))
                return null;

            var (name, phone, position) = patientData;

            // Get all conditions for this queue
            var queueConditions = _conditions.Where(c => c.QueueId == queueId && !c.IsDeleted).ToList();

            // Select best matching condition based on patient position
            var matchedCondition = SelectBestMatch(queueConditions, position);
            if (matchedCondition == null) return null;

            // Get template for this condition
            var template = _templates.FirstOrDefault(t => t.Id == matchedCondition.TemplateId);
            if (template == null) return null;

            // Resolve content variables
            var resolvedContent = ResolveVariables(template.Content, name, position, phone);

            // Create message
            var message = new Message
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                PatientId = patientId,
                QueueId = queueId,
                TemplateId = template.Id,
                FullName = name,
                PatientPhone = phone,
                CountryCode = "+20",
                Content = resolvedContent,
                Status = "queued",
                Position = position,
                CalculatedPosition = _generatedMessages.Count,
                CreatedAt = DateTime.UtcNow,
                IsPaused = false,
                IsDeleted = false
            };

            _generatedMessages.Add(message);
            return message;
        }

        private MessageCondition? SelectBestMatch(List<MessageCondition> conditions, int position)
        {
            var specificMatches = conditions.Where(c =>
            {
                return c.Operator switch
                {
                    "EQUAL" => c.Value.HasValue && position == c.Value.Value,
                    "GREATER" => c.Value.HasValue && position > c.Value.Value,
                    "LESS" => c.Value.HasValue && position < c.Value.Value,
                    "RANGE" => c.MinValue.HasValue && c.MaxValue.HasValue &&
                               position >= c.MinValue.Value && position <= c.MaxValue.Value,
                    "UNCONDITIONED" => true,
                    _ => false
                };
            }).ToList();

            if (specificMatches.Any())
            {
                return specificMatches
                    .OrderByDescending(c => GetPriority(c.Operator))
                    .ThenBy(c => c.Id)
                    .First();
            }

            return conditions.FirstOrDefault(c => c.Operator == "DEFAULT");
        }

        private static int GetPriority(string op) => op switch
        {
            "EQUAL" => 100,
            "RANGE" => 80,
            "GREATER" => 60,
            "LESS" => 60,
            "UNCONDITIONED" => 10,
            _ => 0
        };

        private static string ResolveVariables(string content, string name, int position, string phone)
        {
            return content
                .Replace("{PN}", name)
                .Replace("{CQP}", position.ToString())
                .Replace("{PHONE}", phone);
        }

        public IReadOnlyList<Message> GetGeneratedMessages() => _generatedMessages.AsReadOnly();
    }

    #endregion

    #region Template Selection Tests

    [Fact]
    public void Generate_WithUnconditionedTemplate_ShouldAlwaysSelect()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Default message", conditionOperator: "UNCONDITIONED");
        var patientId = sim.CreatePatient("Ahmed", "+201000000001", position: 5);

        var message = sim.GenerateMessage(queueId, patientId);

        message.Should().NotBeNull();
        message!.Content.Should().Be("Default message");
    }

    [Fact]
    public void Generate_WithEqualCondition_ShouldSelectWhenMatched()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "First position message", "EQUAL", value: 1);
        sim.CreateTemplate(queueId, "Default message", "DEFAULT");

        var patient1 = sim.CreatePatient("Ahmed", "+201000000001", position: 1);
        var patient2 = sim.CreatePatient("Mohamed", "+201000000002", position: 2);

        var msg1 = sim.GenerateMessage(queueId, patient1);
        var msg2 = sim.GenerateMessage(queueId, patient2);

        msg1!.Content.Should().Be("First position message");
        msg2!.Content.Should().Be("Default message");
    }

    [Fact]
    public void Generate_WithRangeCondition_ShouldSelectForPositionsInRange()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "VIP patients (1-10)", "RANGE", minValue: 1, maxValue: 10);
        sim.CreateTemplate(queueId, "Regular patients", "DEFAULT");

        var vipPatient = sim.CreatePatient("VIP", "+201000000001", position: 5);
        var regularPatient = sim.CreatePatient("Regular", "+201000000002", position: 15);

        var vipMsg = sim.GenerateMessage(queueId, vipPatient);
        var regularMsg = sim.GenerateMessage(queueId, regularPatient);

        vipMsg!.Content.Should().Contain("VIP");
        regularMsg!.Content.Should().Contain("Regular");
    }

    [Fact]
    public void Generate_WithGreaterCondition_ShouldSelectForHighPositions()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Long wait message", "GREATER", value: 20);
        sim.CreateTemplate(queueId, "Normal wait", "DEFAULT");

        var longWait = sim.CreatePatient("Ahmed", "+201000000001", position: 25);
        var normalWait = sim.CreatePatient("Mohamed", "+201000000002", position: 10);

        var longMsg = sim.GenerateMessage(queueId, longWait);
        var normalMsg = sim.GenerateMessage(queueId, normalWait);

        longMsg!.Content.Should().Contain("Long wait");
        normalMsg!.Content.Should().Contain("Normal");
    }

    [Fact]
    public void Generate_WithLessCondition_ShouldSelectForLowPositions()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Almost ready!", "LESS", value: 5);
        sim.CreateTemplate(queueId, "Please wait", "DEFAULT");

        var almostReady = sim.CreatePatient("Ahmed", "+201000000001", position: 3);
        var waiting = sim.CreatePatient("Mohamed", "+201000000002", position: 10);

        var readyMsg = sim.GenerateMessage(queueId, almostReady);
        var waitMsg = sim.GenerateMessage(queueId, waiting);

        readyMsg!.Content.Should().Contain("Almost ready");
        waitMsg!.Content.Should().Contain("wait");
    }

    #endregion

    #region Variable Resolution Tests

    [Fact]
    public void Generate_WithPatientNameVariable_ShouldResolve()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello {PN}, welcome!");
        var patientId = sim.CreatePatient("Ahmed Hassan", "+201000000001");

        var message = sim.GenerateMessage(queueId, patientId);

        message!.Content.Should().Be("Hello Ahmed Hassan, welcome!");
    }

    [Fact]
    public void Generate_WithPositionVariable_ShouldResolve()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Your position is {CQP}");
        var patientId = sim.CreatePatient("Ahmed", "+201000000001", position: 15);

        var message = sim.GenerateMessage(queueId, patientId);

        message!.Content.Should().Be("Your position is 15");
    }

    [Fact]
    public void Generate_WithMultipleVariables_ShouldResolveAll()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello {PN}, position {CQP}. Call {PHONE}.");
        var patientId = sim.CreatePatient("Ahmed", "+201234567890", position: 5);

        var message = sim.GenerateMessage(queueId, patientId);

        message!.Content.Should().Be("Hello Ahmed, position 5. Call +201234567890.");
    }

    #endregion

    #region Message Properties Tests

    [Fact]
    public void Generate_ShouldSetCorrectPatientInfo()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello!");
        var patientId = sim.CreatePatient("Ahmed Hassan", "+201234567890", position: 10);

        var message = sim.GenerateMessage(queueId, patientId);

        message!.FullName.Should().Be("Ahmed Hassan");
        message.PatientPhone.Should().Be("+201234567890");
        message.PatientId.Should().Be(patientId);
        message.Position.Should().Be(10);
    }

    [Fact]
    public void Generate_ShouldSetCorrectQueueAndTemplate()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        var templateId = sim.CreateTemplate(queueId, "Hello!");
        var patientId = sim.CreatePatient("Ahmed", "+201000000001");

        var message = sim.GenerateMessage(queueId, patientId);

        message!.QueueId.Should().Be(queueId);
        message.TemplateId.Should().Be(templateId);
    }

    [Fact]
    public void Generate_ShouldSetInitialStatus()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello!");
        var patientId = sim.CreatePatient("Ahmed", "+201000000001");

        var message = sim.GenerateMessage(queueId, patientId);

        message!.Status.Should().Be("queued");
        message.IsPaused.Should().BeFalse();
        message.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Generate_ShouldSetModerator()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello!");
        var patientId = sim.CreatePatient("Ahmed", "+201000000001");

        var message = sim.GenerateMessage(queueId, patientId, moderatorId: 5);

        message!.ModeratorId.Should().Be(5);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Generate_WithNoTemplates_ShouldReturnNull()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        var patientId = sim.CreatePatient("Ahmed", "+201000000001");

        var message = sim.GenerateMessage(queueId, patientId);

        message.Should().BeNull();
    }

    [Fact]
    public void Generate_WithInvalidPatient_ShouldReturnNull()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello!");

        var message = sim.GenerateMessage(queueId, patientId: 999);

        message.Should().BeNull();
    }

    [Fact]
    public void Generate_WithMultiplePatients_ShouldGenerateCorrectMessages()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Hello {PN} (position {CQP})!");
        var p1 = sim.CreatePatient("Ahmed", "+201", position: 1);
        var p2 = sim.CreatePatient("Mohamed", "+202", position: 2);
        var p3 = sim.CreatePatient("Hassan", "+203", position: 3);

        var msg1 = sim.GenerateMessage(queueId, p1);
        var msg2 = sim.GenerateMessage(queueId, p2);
        var msg3 = sim.GenerateMessage(queueId, p3);

        msg1!.Content.Should().Be("Hello Ahmed (position 1)!");
        msg2!.Content.Should().Be("Hello Mohamed (position 2)!");
        msg3!.Content.Should().Be("Hello Hassan (position 3)!");
    }

    [Fact]
    public void Generate_OrderingByCalculatedPosition_ShouldIncrement()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Message");
        var p1 = sim.CreatePatient("A", "+201", position: 5);
        var p2 = sim.CreatePatient("B", "+202", position: 3);
        var p3 = sim.CreatePatient("C", "+203", position: 7);

        sim.GenerateMessage(queueId, p1);
        sim.GenerateMessage(queueId, p2);
        sim.GenerateMessage(queueId, p3);

        var messages = sim.GetGeneratedMessages().ToList();
        messages[0].CalculatedPosition.Should().Be(0);
        messages[1].CalculatedPosition.Should().Be(1);
        messages[2].CalculatedPosition.Should().Be(2);
    }

    #endregion

    #region Soft-Delete and Disabled Template Tests

    [Fact]
    public void Generate_WithDeletedCondition_ShouldSkipToFallback()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Deleted template message", "EQUAL", value: 1);
        sim.CreateTemplate(queueId, "Default fallback", "DEFAULT");
        sim.MarkConditionDeleted(1); // Mark first condition as deleted

        var patient = sim.CreatePatient("Ahmed", "+201000000001", position: 1);
        var message = sim.GenerateMessage(queueId, patient);

        message!.Content.Should().Be("Default fallback");
    }

    [Fact]
    public void Generate_WithAllConditionsDeleted_ShouldReturnNull()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Template 1", "EQUAL", value: 1);
        sim.MarkConditionDeleted(1);

        var patient = sim.CreatePatient("Ahmed", "+201000000001", position: 1);
        var message = sim.GenerateMessage(queueId, patient);

        message.Should().BeNull();
    }

    [Fact]
    public void Generate_WithMixedDeletedConditions_ShouldSelectActiveOnly()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();
        sim.CreateTemplate(queueId, "Deleted VIP (1-5)", "RANGE", minValue: 1, maxValue: 5);
        sim.CreateTemplate(queueId, "Active VIP (1-10)", "RANGE", minValue: 1, maxValue: 10);
        sim.MarkConditionDeleted(1); // Delete first range

        var patient = sim.CreatePatient("Ahmed", "+201000000001", position: 3);
        var message = sim.GenerateMessage(queueId, patient);

        message!.Content.Should().Contain("Active VIP");
    }

    #endregion

    #region Complex Scenario

    [Fact]
    public void Generate_ComplexConditions_ShouldSelectCorrectTemplate()
    {
        var sim = new MessageGenerationSimulator();
        var queueId = sim.CreateQueue();

        sim.CreateTemplate(queueId, "You're next! Please proceed.", "EQUAL", value: 1);
        sim.CreateTemplate(queueId, "Almost ready! Position: {CQP}", "RANGE", minValue: 2, maxValue: 5);
        sim.CreateTemplate(queueId, "Please wait. Position: {CQP}", "RANGE", minValue: 6, maxValue: 10);
        sim.CreateTemplate(queueId, "Long wait expected. Position: {CQP}", "GREATER", value: 10);
        sim.CreateTemplate(queueId, "Thank you for your patience.", "DEFAULT");

        var next = sim.CreatePatient("Next", "+201", position: 1);
        var almost = sim.CreatePatient("Almost", "+202", position: 3);
        var moderate = sim.CreatePatient("Moderate", "+203", position: 8);
        var longWait = sim.CreatePatient("Long", "+204", position: 15);
        var zeroPos = sim.CreatePatient("Zero", "+205", position: 0);

        var msgNext = sim.GenerateMessage(queueId, next);
        var msgAlmost = sim.GenerateMessage(queueId, almost);
        var msgModerate = sim.GenerateMessage(queueId, moderate);
        var msgLong = sim.GenerateMessage(queueId, longWait);
        var msgZero = sim.GenerateMessage(queueId, zeroPos);

        msgNext!.Content.Should().Contain("You're next");
        msgAlmost!.Content.Should().Contain("Almost ready");
        msgModerate!.Content.Should().Contain("Please wait");
        msgLong!.Content.Should().Contain("Long wait");
        msgZero!.Content.Should().Contain("patience");
    }

    #endregion
}
