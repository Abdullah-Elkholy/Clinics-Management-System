using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixTriggerRaceCondition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // GAP FIX 2.1: Add UPDLOCK hint to prevent race conditions in auto-completion trigger
            // This ensures that when multiple messages complete concurrently, only one thread
            // can read and update the session status, preventing duplicate completions
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
                    -- WITH (UPDLOCK) prevents race conditions during concurrent message completions
                    UPDATE ms
                    SET 
                        Status = 'completed',
                        EndTime = GETUTCDATE(),
                        LastUpdated = GETUTCDATE()
                    FROM MessageSessions ms WITH (UPDLOCK)
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
            // Revert to original trigger without UPDLOCK
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
    }
}
