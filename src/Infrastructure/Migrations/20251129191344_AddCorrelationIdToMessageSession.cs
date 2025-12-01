using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCorrelationIdToMessageSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CorrelationId",
                table: "MessageSessions",
                type: "uniqueidentifier",
                nullable: true);
            
            // Note: Indexes IX_Messages_ModeratorId_Status_IsPaused and IX_Messages_SessionId_Status_IsPaused_IsDeleted
            // are already created by TightenSendingProcessConstraints migration
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CorrelationId",
                table: "MessageSessions");
            
            // Note: Don't drop indexes here as they belong to TightenSendingProcessConstraints migration
        }
    }
}
