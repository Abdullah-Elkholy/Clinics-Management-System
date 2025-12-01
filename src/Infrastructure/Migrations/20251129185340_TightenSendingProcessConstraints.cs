using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TightenSendingProcessConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add composite indexes for improved query performance on Messages table
            migrationBuilder.CreateIndex(
                name: "IX_Messages_SessionId_Status_IsPaused_IsDeleted",
                table: "Messages",
                columns: new[] { "SessionId", "Status", "IsPaused", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ModeratorId_Status_IsPaused",
                table: "Messages",
                columns: new[] { "ModeratorId", "Status", "IsPaused" });

            // Note: CHECK constraint with subquery removed - SQL Server doesn't support EXISTS in CHECK constraints
            // Data integrity for FailedTask-Message relationship enforced at application level instead

            // Add trigger to auto-complete MessageSession when all messages are sent
            migrationBuilder.Sql(@"
                CREATE OR ALTER TRIGGER trg_MessageSession_AutoComplete
                ON Messages
                AFTER INSERT, UPDATE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    
                    -- Get affected session IDs
                    DECLARE @AffectedSessions TABLE (SessionId UNIQUEIDENTIFIER);
                    
                    INSERT INTO @AffectedSessions
                    SELECT DISTINCT CAST(SessionId AS UNIQUEIDENTIFIER)
                    FROM inserted
                    WHERE SessionId IS NOT NULL;
                    
                    -- Update sessions where SentMessages >= TotalMessages
                    UPDATE ms
                    SET 
                        Status = 'completed',
                        EndTime = GETUTCDATE(),
                        LastUpdated = GETUTCDATE()
                    FROM MessageSessions ms
                    INNER JOIN @AffectedSessions a ON ms.Id = a.SessionId
                    WHERE 
                        ms.SentMessages >= ms.TotalMessages
                        AND ms.Status != 'completed'
                        AND ms.Status != 'cancelled';
                END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop trigger
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_MessageSession_AutoComplete;");
            
            // Drop composite indexes
            migrationBuilder.DropIndex(
                name: "IX_Messages_ModeratorId_Status_IsPaused",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SessionId_Status_IsPaused_IsDeleted",
                table: "Messages");
        }
    }
}
