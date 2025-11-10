using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsDefaultAndQuotaUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add IsDefault column to MessageTemplates
            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "MessageTemplates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Add filtered unique index for exactly one default per queue
            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_QueueId_IsDefault",
                table: "MessageTemplates",
                columns: new[] { "QueueId", "IsDefault" },
                unique: true,
                filter: "[QueueId] IS NOT NULL AND [IsDefault] = 1");

            // Convert Quota index to unique
            migrationBuilder.DropIndex(
                name: "IX_Quotas_ModeratorUserId",
                table: "Quotas");

            migrationBuilder.CreateIndex(
                name: "IX_Quotas_ModeratorUserId",
                table: "Quotas",
                column: "ModeratorUserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert unique index on Quotas to non-unique
            migrationBuilder.DropIndex(
                name: "IX_Quotas_ModeratorUserId",
                table: "Quotas");

            migrationBuilder.CreateIndex(
                name: "IX_Quotas_ModeratorUserId",
                table: "Quotas",
                column: "ModeratorUserId");

            // Drop the filtered unique index
            migrationBuilder.DropIndex(
                name: "IX_MessageTemplates_QueueId_IsDefault",
                table: "MessageTemplates");

            // Remove IsDefault column
            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "MessageTemplates");
        }
    }
}
