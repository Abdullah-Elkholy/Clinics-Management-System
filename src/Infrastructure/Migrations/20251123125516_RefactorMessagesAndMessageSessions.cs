using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RefactorMessagesAndMessageSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove RecipientPhone column from Messages
            migrationBuilder.DropColumn(
                name: "RecipientPhone",
                table: "Messages");

            // Remove RestoredAt and RestoredBy from Messages
            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Messages");

            // Add new columns to Messages (before PatientPhone)
            migrationBuilder.AddColumn<string>(
                name: "CountryCode",
                table: "Messages",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "+20");

            migrationBuilder.AddColumn<int>(
                name: "Position",
                table: "Messages",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CalculatedPosition",
                table: "Messages",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "Messages",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // Add new columns to MessageSessions
            migrationBuilder.AddColumn<int>(
                name: "FailedMessages",
                table: "MessageSessions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OngoingMessages",
                table: "MessageSessions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "MessageSessions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "MessageSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "MessageSessions",
                type: "int",
                nullable: true);

            // Update existing Messages with data from Patients
            migrationBuilder.Sql(@"
                UPDATE m
                SET 
                    m.CountryCode = ISNULL(p.CountryCode, '+20'),
                    m.Position = ISNULL(p.Position, 0),
                    m.CalculatedPosition = ISNULL(p.Position, 0) - ISNULL(q.CurrentPosition, 0),
                    m.FullName = ISNULL(p.FullName, '')
                FROM Messages m
                LEFT JOIN Patients p ON m.PatientId = p.Id
                LEFT JOIN Queues q ON m.QueueId = q.Id
                WHERE m.PatientId IS NOT NULL
            ");

            // Initialize MessageSession counters based on current Message.Status
            migrationBuilder.Sql(@"
                UPDATE ms
                SET 
                    ms.OngoingMessages = (
                        SELECT COUNT(*)
                        FROM Messages m
                        WHERE m.SessionId = CAST(ms.Id AS NVARCHAR(100))
                            AND m.Status IN ('queued', 'sending')
                            AND m.IsDeleted = 0
                    ),
                    ms.FailedMessages = (
                        SELECT COUNT(*)
                        FROM Messages m
                        WHERE m.SessionId = CAST(ms.Id AS NVARCHAR(100))
                            AND m.Status = 'failed'
                            AND m.IsDeleted = 0
                    )
                FROM MessageSessions ms
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Remove new columns from MessageSessions
            migrationBuilder.DropColumn(
                name: "FailedMessages",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "OngoingMessages",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "MessageSessions");

            // Remove new columns from Messages
            migrationBuilder.DropColumn(
                name: "CountryCode",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "CalculatedPosition",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "Messages");

            // Restore removed columns
            migrationBuilder.AddColumn<string>(
                name: "RecipientPhone",
                table: "Messages",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Messages",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Messages",
                type: "int",
                nullable: true);

            // Restore RecipientPhone from PatientPhone
            migrationBuilder.Sql(@"
                UPDATE m
                SET m.RecipientPhone = ISNULL(m.PatientPhone, '')
                FROM Messages m
            ");
        }
    }
}
