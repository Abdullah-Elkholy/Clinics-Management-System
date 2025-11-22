using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPauseFieldsToMessagesAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "MessageSessions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Add ModeratorId as nullable first to handle existing data
            migrationBuilder.AddColumn<int>(
                name: "ModeratorId",
                table: "MessageSessions",
                type: "int",
                nullable: true);

            // Update existing MessageSessions: set ModeratorId from UserId
            // If UserId is a moderator, use it directly; otherwise use the user's ModeratorId
            migrationBuilder.Sql(@"
                UPDATE ms
                SET ms.ModeratorId = u.Id
                FROM MessageSessions ms
                INNER JOIN Users u ON ms.UserId = u.Id
                WHERE u.Role = 'moderator' AND ms.ModeratorId IS NULL;
            ");

            // For users who are not moderators, use their assigned ModeratorId
            migrationBuilder.Sql(@"
                UPDATE ms
                SET ms.ModeratorId = u.ModeratorId
                FROM MessageSessions ms
                INNER JOIN Users u ON ms.UserId = u.Id
                WHERE u.ModeratorId IS NOT NULL AND ms.ModeratorId IS NULL;
            ");

            // For any remaining NULL values, set to UserId as fallback
            // (This handles edge cases where user might not have a moderator assigned)
            migrationBuilder.Sql(@"
                UPDATE MessageSessions
                SET ModeratorId = UserId
                WHERE ModeratorId IS NULL;
            ");

            // Now make it required
            migrationBuilder.AlterColumn<int>(
                name: "ModeratorId",
                table: "MessageSessions",
                type: "int",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "PauseReason",
                table: "MessageSessions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "MessageSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PausedBy",
                table: "MessageSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "Messages",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PauseReason",
                table: "Messages",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "Messages",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PausedBy",
                table: "Messages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "Messages",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageSessions_ModeratorId",
                table: "MessageSessions",
                column: "ModeratorId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IsPaused_Status",
                table: "Messages",
                columns: new[] { "IsPaused", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_SessionId",
                table: "Messages",
                column: "SessionId");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageSessions_Users_ModeratorId",
                table: "MessageSessions",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageSessions_Users_ModeratorId",
                table: "MessageSessions");

            migrationBuilder.DropIndex(
                name: "IX_MessageSessions_ModeratorId",
                table: "MessageSessions");

            migrationBuilder.DropIndex(
                name: "IX_Messages_IsPaused_Status",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SessionId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "ModeratorId",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "PauseReason",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "PausedBy",
                table: "MessageSessions");

            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PauseReason",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PausedBy",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "Messages");
        }
    }
}
