using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExtensionDevicePairingCodeRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExtensionPairingCodes_UsedByDeviceId",
                table: "ExtensionPairingCodes");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionPairingCodes_UsedByDeviceId",
                table: "ExtensionPairingCodes",
                column: "UsedByDeviceId",
                unique: true,
                filter: "[UsedByDeviceId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExtensionPairingCodes_UsedByDeviceId",
                table: "ExtensionPairingCodes");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionPairingCodes_UsedByDeviceId",
                table: "ExtensionPairingCodes",
                column: "UsedByDeviceId");
        }
    }
}
