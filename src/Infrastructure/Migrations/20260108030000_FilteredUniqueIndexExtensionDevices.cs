using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clinics.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FilteredUniqueIndexExtensionDevices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the existing unique index without filter
            migrationBuilder.DropIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices");

            // Create new filtered unique index (only for active/non-revoked devices)
            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices",
                columns: new[] { "ModeratorUserId", "DeviceId" },
                unique: true,
                filter: "[RevokedAtUtc] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the filtered index
            migrationBuilder.DropIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices");

            // Recreate the original unfiltered unique index
            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices",
                columns: new[] { "ModeratorUserId", "DeviceId" },
                unique: true);
        }
    }
}
