using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeMessageConditionTemplateIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop existing FK and unique index on TemplateId
            migrationBuilder.DropForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions");

            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            // Make TemplateId nullable
            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // Recreate non-unique index for lookups
            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId");

            // Re-add FK with TemplateId nullable
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
            // Drop FK and index
            migrationBuilder.DropForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions");

            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            // Make TemplateId non-nullable again
            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // Recreate unique index
            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                unique: true);

            // Re-add FK as required
            migrationBuilder.AddForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                principalTable: "MessageTemplates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
