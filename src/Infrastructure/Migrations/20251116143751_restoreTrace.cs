using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class restoreTrace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Quotas",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Quotas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Queues",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Queues",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Patients",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Patients",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "MessageTemplates",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "MessageTemplates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "Messages",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "Messages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "MessageConditions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "MessageConditions",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Quotas");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Quotas");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Queues");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Queues");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "MessageConditions");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "MessageConditions");
        }
    }
}
