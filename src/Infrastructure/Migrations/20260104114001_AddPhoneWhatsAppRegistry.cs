using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPhoneWhatsAppRegistry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhoneWhatsAppRegistry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    HasWhatsApp = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CheckedByUserId = table.Column<int>(type: "int", nullable: true),
                    ValidationCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhoneWhatsAppRegistry", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhoneWhatsAppRegistry_ExpiresAt",
                table: "PhoneWhatsAppRegistry",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_PhoneWhatsAppRegistry_PhoneNumber",
                table: "PhoneWhatsAppRegistry",
                column: "PhoneNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhoneWhatsAppRegistry");
        }
    }
}
