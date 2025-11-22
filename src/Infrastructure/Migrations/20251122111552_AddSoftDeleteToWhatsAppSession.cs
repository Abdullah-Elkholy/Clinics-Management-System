using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftDeleteToWhatsAppSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "WhatsAppSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "WhatsAppSessions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestoredAt",
                table: "WhatsAppSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestoredBy",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "WhatsAppSessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "WhatsAppSessions",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "RestoredAt",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "RestoredBy",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "WhatsAppSessions");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "WhatsAppSessions");
        }
    }
}
