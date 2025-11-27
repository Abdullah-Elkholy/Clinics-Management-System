using Clinics.Domain;
using System;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for resolving template variables in message content.
    /// Variables are resolved BEFORE saving to Message.Content to store actual values.
    /// </summary>
    public interface IContentVariableResolver
    {
        /// <summary>
        /// Resolves all template variables in content string.
        /// </summary>
        /// <param name="templateContent">Template content with variables (e.g., "{PN}", "{CQP}", "{ETR}")</param>
        /// <param name="patient">Patient entity for name and position data</param>
        /// <param name="queue">Queue entity for current position and estimated time</param>
        /// <param name="calculatedPosition">Pre-calculated position offset (Position - CurrentPosition)</param>
        /// <returns>Content with all variables replaced by actual values</returns>
        string ResolveVariables(string templateContent, Patient patient, Queue queue, int calculatedPosition);
    }

    public class ContentVariableResolver : IContentVariableResolver
    {
        /// <summary>
        /// Supported template variables:
        /// {PN} - Patient Name (FullName or fallback to "Patient ID: X")
        /// {PQP} - Patient Queue Position (absolute position from Patient.Position)
        /// {CQP} - Current Queue Position (from Queue.CurrentPosition)
        /// {ETR} - Estimated Time Remaining (calculated as CalculatedPosition * EstimatedWaitMinutes)
        /// {DN} - Doctor/Queue Name (from Queue.DoctorName)
        /// </summary>
        public string ResolveVariables(string templateContent, Patient patient, Queue queue, int calculatedPosition)
        {
            if (string.IsNullOrWhiteSpace(templateContent))
            {
                return string.Empty;
            }

            if (patient == null)
            {
                throw new ArgumentNullException(nameof(patient), "Patient is required for variable resolution");
            }

            if (queue == null)
            {
                throw new ArgumentNullException(nameof(queue), "Queue is required for variable resolution");
            }

            // {PN} - Patient Name
            var patientName = !string.IsNullOrWhiteSpace(patient.FullName) 
                ? patient.FullName 
                : $"Patient ID: {patient.Id}";

            // {PQP} - Patient Queue Position (absolute)
            var patientQueuePosition = patient.Position;

            // {CQP} - Current Queue Position
            var currentQueuePosition = queue.CurrentPosition;

            // {ETR} - Estimated Time Remaining
            var estimatedTimePerSession = queue.EstimatedWaitMinutes > 0 
                ? queue.EstimatedWaitMinutes 
                : 15; // Default 15 minutes if not set or invalid

            var etrMinutes = calculatedPosition * estimatedTimePerSession;
            var etrDisplay = FormatTimeDisplay(etrMinutes);

            // {DN} - Doctor/Queue Name
            var doctorName = queue.DoctorName ?? "غير محدد";

            // Replace all variables
            var resolvedContent = templateContent
                .Replace("{PN}", patientName)
                .Replace("{PQP}", patientQueuePosition.ToString())
                .Replace("{CQP}", currentQueuePosition.ToString())
                .Replace("{ETR}", etrDisplay)
                .Replace("{DN}", doctorName);

            return resolvedContent;
        }

        /// <summary>
        /// Formats time in minutes to a user-friendly Arabic display.
        /// Examples:
        /// - 0-5 minutes: "أقل من 5 دقائق"
        /// - 6-60 minutes: "X دقيقة"
        /// - 61-120 minutes: "ساعة واحدة"
        /// - 121+ minutes: "X ساعات"
        /// </summary>
        private string FormatTimeDisplay(int minutes)
        {
            if (minutes <= 0)
            {
                return "الآن";
            }

            if (minutes <= 5)
            {
                return "أقل من 5 دقائق";
            }

            if (minutes <= 60)
            {
                return $"{minutes} دقيقة";
            }

            if (minutes <= 120)
            {
                return "ساعة واحدة";
            }

            var hours = minutes / 60;
            var remainingMinutes = minutes % 60;

            if (remainingMinutes == 0)
            {
                return $"{hours} ساعات";
            }

            return $"{hours} ساعات و {remainingMinutes} دقيقة";
        }
    }
}
