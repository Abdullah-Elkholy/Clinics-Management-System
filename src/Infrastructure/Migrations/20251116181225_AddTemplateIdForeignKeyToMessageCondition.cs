using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTemplateIdForeignKeyToMessageCondition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Add TemplateId column as nullable first
            migrationBuilder.AddColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: true);

            // Step 2: Populate TemplateId from existing MessageTemplate.MessageConditionId relationships
            // This ensures existing data is properly migrated
            migrationBuilder.Sql(@"
                UPDATE MessageConditions
                SET TemplateId = (
                    SELECT TOP 1 Id 
                    FROM MessageTemplates 
                    WHERE MessageTemplates.MessageConditionId = MessageConditions.Id
                )
                WHERE TemplateId IS NULL
            ");

            // Step 3: Make TemplateId non-nullable after populating it
            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: false);

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                principalTable: "MessageTemplates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions");

            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            migrationBuilder.DropColumn(
                name: "TemplateId",
                table: "MessageConditions");
        }
    }
}
