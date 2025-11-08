using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateMessageWithNavigationPropertiesAndFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates");

            migrationBuilder.AlterColumn<int>(
                name: "QueueId",
                table: "MessageTemplates",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "ModeratorId",
                table: "MessageTemplates",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "ModeratorId",
                table: "Messages",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "ErrorMessage",
                table: "Messages",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PatientPhone",
                table: "Messages",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Messages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateIndex(
                name: "IX_Messages_QueueId",
                table: "Messages",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_TemplateId",
                table: "Messages",
                column: "TemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_MessageTemplates_TemplateId",
                table: "Messages",
                column: "TemplateId",
                principalTable: "MessageTemplates",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Queues_QueueId",
                table: "Messages",
                column: "QueueId",
                principalTable: "Queues",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates",
                column: "QueueId",
                principalTable: "Queues",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_MessageTemplates_TemplateId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Queues_QueueId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Messages_QueueId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_TemplateId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ErrorMessage",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PatientPhone",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Messages");

            migrationBuilder.AlterColumn<int>(
                name: "QueueId",
                table: "MessageTemplates",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ModeratorId",
                table: "MessageTemplates",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ModeratorId",
                table: "Messages",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageTemplates_Queues_QueueId",
                table: "MessageTemplates",
                column: "QueueId",
                principalTable: "Queues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
