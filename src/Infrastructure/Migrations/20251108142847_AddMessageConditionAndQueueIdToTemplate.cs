using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageConditionAndQueueIdToTemplate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Users_ModeratorId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Moderator",
                table: "MessageTemplates");

            migrationBuilder.AddColumn<int>(
                name: "ModeratorId",
                table: "Queues",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "MessageTemplates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ModeratorId",
                table: "MessageTemplates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QueueId",
                table: "MessageTemplates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "MessageTemplates",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ModeratorId",
                table: "Messages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MessageConditions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TemplateId = table.Column<int>(type: "int", nullable: true),
                    QueueId = table.Column<int>(type: "int", nullable: false),
                    Operator = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Value = table.Column<int>(type: "int", nullable: true),
                    MinValue = table.Column<int>(type: "int", nullable: true),
                    MaxValue = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageConditions_MessageTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "MessageTemplates",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MessageConditions_Queues_QueueId",
                        column: x => x.QueueId,
                        principalTable: "Queues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModeratorSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModeratorUserId = table.Column<int>(type: "int", nullable: false),
                    WhatsAppPhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModeratorSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModeratorSettings_Users_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Queues_ModeratorId",
                table: "Queues",
                column: "ModeratorId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_ModeratorId",
                table: "MessageTemplates",
                column: "ModeratorId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_QueueId",
                table: "MessageTemplates",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ModeratorId",
                table: "Messages",
                column: "ModeratorId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_QueueId",
                table: "MessageConditions",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_TemplateId",
                table: "MessageConditions",
                column: "TemplateId",
                unique: true,
                filter: "[TemplateId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ModeratorSettings_ModeratorUserId",
                table: "ModeratorSettings",
                column: "ModeratorUserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Users_ModeratorId",
                table: "Messages",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates",
                column: "QueueId",
                principalTable: "Queues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageTemplates_Users_ModeratorId",
                table: "MessageTemplates",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Queues_Users_ModeratorId",
                table: "Queues",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Users_ModeratorId",
                table: "Users",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Users_ModeratorId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageTemplates_Users_ModeratorId",
                table: "MessageTemplates");

            migrationBuilder.DropForeignKey(
                name: "FK_Queues_Users_ModeratorId",
                table: "Queues");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Users_ModeratorId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "MessageConditions");

            migrationBuilder.DropTable(
                name: "ModeratorSettings");

            migrationBuilder.DropIndex(
                name: "IX_Queues_ModeratorId",
                table: "Queues");

            migrationBuilder.DropIndex(
                name: "IX_MessageTemplates_ModeratorId",
                table: "MessageTemplates");

            migrationBuilder.DropIndex(
                name: "IX_MessageTemplates_QueueId",
                table: "MessageTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ModeratorId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ModeratorId",
                table: "Queues");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "ModeratorId",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "QueueId",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "ModeratorId",
                table: "Messages");

            migrationBuilder.AddColumn<string>(
                name: "Moderator",
                table: "MessageTemplates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Users_ModeratorId",
                table: "Users",
                column: "ModeratorId",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
