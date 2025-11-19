using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeMessagesQuotaToBigInt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Convert int.MaxValue (2147483647) to -1 (unlimited) before changing column type
            migrationBuilder.Sql(@"
                UPDATE Quotas 
                SET MessagesQuota = -1 
                WHERE MessagesQuota = 2147483647
            ");

            migrationBuilder.AlterColumn<long>(
                name: "MessagesQuota",
                table: "Quotas",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<long>(
                name: "ConsumedMessages",
                table: "Quotas",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "MessagesQuota",
                table: "Quotas",
                type: "int",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<int>(
                name: "ConsumedMessages",
                table: "Quotas",
                type: "int",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");
        }
    }
}
