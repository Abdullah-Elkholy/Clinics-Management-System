using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppSessionAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastActivityAt",
                table: "WhatsAppSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastActivityUserId",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "LastActivityAt",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "LastActivityUserId",
                table: "WhatsAppSessions");

            migrationBuilder.AlterColumn<int>(
                name: "TemplateId",
                table: "MessageConditions",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                unique: true);
        }
    }
}
