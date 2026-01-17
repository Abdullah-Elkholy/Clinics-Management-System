using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExtensionRunnerEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExtensionCommands",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    CommandType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MessageId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AckedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResultJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResultStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    Priority = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionCommands", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionCommands_Messages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "Messages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ExtensionCommands_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExtensionDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    DeviceId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DeviceName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ExtensionVersion = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TokenExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    LastSeenAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedReason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionDevices_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExtensionPairingCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsedByDeviceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionPairingCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionPairingCodes_ExtensionDevices_UsedByDeviceId",
                        column: x => x.UsedByDeviceId,
                        principalTable: "ExtensionDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ExtensionPairingCodes_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExtensionSessionLeases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeaseTokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    AcquiredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastHeartbeatAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    RevokedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedReason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CurrentUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    WhatsAppStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionSessionLeases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionSessionLeases_ExtensionDevices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "ExtensionDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExtensionSessionLeases_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionCommands_MessageId",
                table: "ExtensionCommands",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionCommands_ModeratorUserId_Status_Priority_CreatedAtUtc",
                table: "ExtensionCommands",
                columns: new[] { "ModeratorUserId", "Status", "Priority", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionCommands_Status_ExpiresAtUtc",
                table: "ExtensionCommands",
                columns: new[] { "Status", "ExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId",
                table: "ExtensionDevices",
                column: "ModeratorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionDevices_ModeratorUserId_DeviceId",
                table: "ExtensionDevices",
                columns: new[] { "ModeratorUserId", "DeviceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionPairingCodes_Code",
                table: "ExtensionPairingCodes",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionPairingCodes_ModeratorUserId",
                table: "ExtensionPairingCodes",
                column: "ModeratorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionPairingCodes_UsedByDeviceId",
                table: "ExtensionPairingCodes",
                column: "UsedByDeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionSessionLeases_DeviceId",
                table: "ExtensionSessionLeases",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionSessionLeases_ModeratorUserId",
                table: "ExtensionSessionLeases",
                column: "ModeratorUserId",
                unique: true,
                filter: "[RevokedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionSessionLeases_ModeratorUserId_RevokedAtUtc",
                table: "ExtensionSessionLeases",
                columns: new[] { "ModeratorUserId", "RevokedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExtensionCommands");

            migrationBuilder.DropTable(
                name: "ExtensionPairingCodes");

            migrationBuilder.DropTable(
                name: "ExtensionSessionLeases");

            migrationBuilder.DropTable(
                name: "ExtensionDevices");
        }
    }
}
