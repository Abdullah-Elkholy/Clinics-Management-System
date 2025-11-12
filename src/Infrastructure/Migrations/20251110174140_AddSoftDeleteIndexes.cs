using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftDeleteIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add composite indexes (IsDeleted, DeletedAt) for efficient TTL queries on trash/archived
            migrationBuilder.CreateIndex(
                name: "IX_Users_IsDeleted_DeletedAt",
                table: "Users",
                columns: new[] { "IsDeleted", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Queues_IsDeleted_DeletedAt",
                table: "Queues",
                columns: new[] { "IsDeleted", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Patients_IsDeleted_DeletedAt",
                table: "Patients",
                columns: new[] { "IsDeleted", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_IsDeleted_DeletedAt",
                table: "MessageTemplates",
                columns: new[] { "IsDeleted", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_IsDeleted_DeletedAt",
                table: "MessageConditions",
                columns: new[] { "IsDeleted", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IsDeleted_DeletedAt",
                table: "Messages",
                columns: new[] { "IsDeleted", "DeletedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_IsDeleted_DeletedAt",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Queues_IsDeleted_DeletedAt",
                table: "Queues");

            migrationBuilder.DropIndex(
                name: "IX_Patients_IsDeleted_DeletedAt",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_MessageTemplates_IsDeleted_DeletedAt",
                table: "MessageTemplates");

            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_IsDeleted_DeletedAt",
                table: "MessageConditions");

            migrationBuilder.DropIndex(
                name: "IX_Messages_IsDeleted_DeletedAt",
                table: "Messages");
        }
    }
}
