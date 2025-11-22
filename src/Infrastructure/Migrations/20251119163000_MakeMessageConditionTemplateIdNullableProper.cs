using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Clinics.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20251119163000_MakeMessageConditionTemplateIdNullableProper")]
    public partial class MakeMessageConditionTemplateIdNullableProper : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FK if exists
            migrationBuilder.DropForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions");

            // Drop unique index if exists (will be recreated as non-unique)
            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            // Alter column to nullable
            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // Recreate non-unique index
            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId");

            // Re-add FK with Restrict delete behavior and nullable column
            migrationBuilder.AddForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                principalTable: "MessageTemplates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop FK and index
            migrationBuilder.DropForeignKey(
                name: "FK_MessageConditions_MessageTemplates_TemplateId",
                table: "MessageConditions");
            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            // Make column non-nullable again
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

            // Re-add original FK
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
