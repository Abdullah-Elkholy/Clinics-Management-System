using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPauseFieldsAndChangeMessageIdToGuid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Add WhatsAppSession pause fields (NEW)
            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "WhatsAppSessions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PauseReason",
                table: "WhatsAppSessions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "WhatsAppSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PausedBy",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);

            // Step 2: Handle Message.Id conversion from bigint to uniqueidentifier
            // This is a breaking change - existing Message data will get new GUIDs
            
            // Create temporary column for new Guid IDs
            migrationBuilder.AddColumn<Guid>(
                name: "NewId",
                table: "Messages",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            // Create temporary column in FailedTasks for new MessageId
            migrationBuilder.AddColumn<Guid>(
                name: "NewMessageId",
                table: "FailedTasks",
                type: "uniqueidentifier",
                nullable: true);

            // Drop foreign key constraint from FailedTasks to Messages
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_FailedTasks_Messages_MessageId')
                BEGIN
                    ALTER TABLE [FailedTasks] DROP CONSTRAINT [FK_FailedTasks_Messages_MessageId];
                END");

            // Drop index on FailedTasks.MessageId
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FailedTasks_MessageId')
                BEGIN
                    DROP INDEX [IX_FailedTasks_MessageId] ON [FailedTasks];
                END");

            // Migrate data: Map old bigint IDs to new Guid IDs in FailedTasks
            migrationBuilder.Sql(@"
                UPDATE ft
                SET ft.NewMessageId = m.NewId
                FROM [FailedTasks] ft
                INNER JOIN [Messages] m ON ft.MessageId = m.Id");

            // Drop primary key from Messages
            migrationBuilder.DropPrimaryKey(
                name: "PK_Messages",
                table: "Messages");

            // Drop old Id column from Messages
            migrationBuilder.DropColumn(
                name: "Id",
                table: "Messages");

            // Drop old MessageId column from FailedTasks
            migrationBuilder.DropColumn(
                name: "MessageId",
                table: "FailedTasks");

            // Rename NewId to Id in Messages
            migrationBuilder.RenameColumn(
                name: "NewId",
                table: "Messages",
                newName: "Id");

            // Rename NewMessageId to MessageId in FailedTasks
            migrationBuilder.RenameColumn(
                name: "NewMessageId",
                table: "FailedTasks",
                newName: "MessageId");

            // Add primary key constraint back to Messages.Id
            migrationBuilder.AddPrimaryKey(
                name: "PK_Messages",
                table: "Messages",
                column: "Id");

            // Recreate index on FailedTasks.MessageId
            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_MessageId",
                table: "FailedTasks",
                column: "MessageId");

            // Recreate foreign key from FailedTasks to Messages
            migrationBuilder.AddForeignKey(
                name: "FK_FailedTasks_Messages_MessageId",
                table: "FailedTasks",
                column: "MessageId",
                principalTable: "Messages",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // WARNING: This rollback will cause data loss for Message IDs
            // The Guid->bigint conversion cannot preserve exact ID values

            // Drop foreign key from FailedTasks to Messages
            migrationBuilder.DropForeignKey(
                name: "FK_FailedTasks_Messages_MessageId",
                table: "FailedTasks");

            migrationBuilder.DropIndex(
                name: "IX_FailedTasks_MessageId",
                table: "FailedTasks");

            // Drop primary key from Messages
            migrationBuilder.DropPrimaryKey(
                name: "PK_Messages",
                table: "Messages");

            // Create temporary bigint columns
            migrationBuilder.AddColumn<long>(
                name: "OldId",
                table: "Messages",
                type: "bigint",
                nullable: false)
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddColumn<long>(
                name: "OldMessageId",
                table: "FailedTasks",
                type: "bigint",
                nullable: true);

            // Cannot migrate Guid back to sequential bigint meaningfully
            // This is a destructive operation - data relationships will be lost

            // Drop Guid columns
            migrationBuilder.DropColumn(
                name: "Id",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "MessageId",
                table: "FailedTasks");

            // Rename temporary columns back
            migrationBuilder.RenameColumn(
                name: "OldId",
                table: "Messages",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "OldMessageId",
                table: "FailedTasks",
                newName: "MessageId");

            // Add primary key back
            migrationBuilder.AddPrimaryKey(
                name: "PK_Messages",
                table: "Messages",
                column: "Id");

            // Recreate index
            migrationBuilder.CreateIndex(
                name: "IX_FailedTasks_MessageId",
                table: "FailedTasks",
                column: "MessageId");

            // Recreate foreign key
            migrationBuilder.AddForeignKey(
                name: "FK_FailedTasks_Messages_MessageId",
                table: "FailedTasks",
                column: "MessageId",
                principalTable: "Messages",
                principalColumn: "Id");

            // Drop WhatsAppSession pause fields
            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "PauseReason",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "PausedBy",
                table: "WhatsAppSessions");
        }
    }
}
