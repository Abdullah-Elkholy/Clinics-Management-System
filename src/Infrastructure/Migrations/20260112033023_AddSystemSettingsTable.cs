using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices");

            migrationBuilder.CreateTable(
                name: "SystemSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SystemSettings",
                columns: new[] { "Id", "Category", "CreatedAt", "Description", "Key", "UpdatedAt", "UpdatedBy", "Value" },
                values: new object[,]
                {
                    { 1, "RateLimit", new DateTime(2026, 1, 12, 0, 0, 0, 0, DateTimeKind.Utc), "تفعيل تحديد معدل الإرسال بين الرسائل", "RateLimitEnabled", null, null, "true" },
                    { 2, "RateLimit", new DateTime(2026, 1, 12, 0, 0, 0, 0, DateTimeKind.Utc), "الحد الأدنى للتأخير بين الرسائل (بالثواني)", "RateLimitMinSeconds", null, null, "3" },
                    { 3, "RateLimit", new DateTime(2026, 1, 12, 0, 0, 0, 0, DateTimeKind.Utc), "الحد الأقصى للتأخير بين الرسائل (بالثواني)", "RateLimitMaxSeconds", null, null, "7" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices",
                columns: new[] { "ModeratorUserId", "DeviceId" },
                unique: true,
                filter: "[RevokedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SystemSettings_Key",
                table: "SystemSettings",
                column: "Key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices",
                columns: new[] { "ModeratorUserId", "DeviceId" },
                unique: true);
        }
    }
}
