using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIsDefaultAndHasCondition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop default constraints
            migrationBuilder.Sql(@"
                DECLARE @ConstraintName NVARCHAR(MAX);
                SELECT @ConstraintName = name FROM sys.default_constraints 
                WHERE parent_object_id = OBJECT_ID('MessageTemplates') AND parent_column_id = (
                    SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('MessageTemplates') AND name = 'IsDefault'
                );
                IF @ConstraintName IS NOT NULL
                BEGIN
                    EXEC('ALTER TABLE MessageTemplates DROP CONSTRAINT ' + @ConstraintName);
                END
            ");

            migrationBuilder.Sql(@"
                DECLARE @ConstraintName NVARCHAR(MAX);
                SELECT @ConstraintName = name FROM sys.default_constraints 
                WHERE parent_object_id = OBJECT_ID('MessageTemplates') AND parent_column_id = (
                    SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('MessageTemplates') AND name = 'HasCondition'
                );
                IF @ConstraintName IS NOT NULL
                BEGIN
                    EXEC('ALTER TABLE MessageTemplates DROP CONSTRAINT ' + @ConstraintName);
                END
            ");

            // Conditionally drop old indexes if they exist
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageTemplates_QueueId_IsDefault')
                BEGIN
                    DROP INDEX IX_MessageTemplates_QueueId_IsDefault ON MessageTemplates;
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageConditions_QueueId')
                BEGIN
                    DROP INDEX IX_MessageConditions_QueueId ON MessageConditions;
                END
            ");

            // Drop columns if they exist
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='MessageTemplates' AND COLUMN_NAME='HasCondition')
                BEGIN
                    ALTER TABLE MessageTemplates DROP COLUMN HasCondition;
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='MessageTemplates' AND COLUMN_NAME='IsDefault')
                BEGIN
                    ALTER TABLE MessageTemplates DROP COLUMN IsDefault;
                END
            ");

            // Create new indexes (if they don't exist)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageTemplates_QueueId' AND object_id = OBJECT_ID('MessageTemplates'))
                BEGIN
                    CREATE INDEX IX_MessageTemplates_QueueId ON MessageTemplates(QueueId);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageConditions_QueueId_Operator' AND object_id = OBJECT_ID('MessageConditions'))
                BEGIN
                    CREATE UNIQUE INDEX IX_MessageConditions_QueueId_Operator ON MessageConditions(QueueId, Operator) WHERE [Operator] = 'DEFAULT';
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop new indexes
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageTemplates_QueueId')
                BEGIN
                    DROP INDEX IX_MessageTemplates_QueueId ON MessageTemplates;
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_MessageConditions_QueueId_Operator')
                BEGIN
                    DROP INDEX IX_MessageConditions_QueueId_Operator ON MessageConditions;
                END
            ");

            // Re-add columns
            migrationBuilder.AddColumn<bool>(
                name: "HasCondition",
                table: "MessageTemplates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "MessageTemplates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Re-create old indexes
            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_QueueId_IsDefault",
                table: "MessageTemplates",
                columns: new[] { "QueueId", "IsDefault" },
                unique: true,
                filter: "[QueueId] IS NOT NULL AND [IsDefault] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_MessageConditions_QueueId",
                table: "MessageConditions",
                column: "QueueId");
        }
    }
}
