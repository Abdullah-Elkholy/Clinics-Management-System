using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQueueProcessingImprovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "InFlightCommandId",
                table: "Messages",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptAt",
                table: "Messages",
                type: "datetime2",
                nullable: true);

            // P0.3: Add filtered unique index to prevent duplicate active commands per message
            // This ensures at most one ExtensionCommand can be in pending/sent/acked state per MessageId
            migrationBuilder.Sql(@"
                CREATE UNIQUE NONCLUSTERED INDEX [IX_ExtensionCommands_MessageId_Active]
                ON [ExtensionCommands] ([MessageId])
                WHERE [Status] IN ('pending', 'sent', 'acked') AND [MessageId] IS NOT NULL
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the filtered unique index
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS [IX_ExtensionCommands_MessageId_Active] ON [ExtensionCommands]
            ");

            migrationBuilder.DropColumn(
                name: "InFlightCommandId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "NextAttemptAt",
                table: "Messages");
        }
    }
}
