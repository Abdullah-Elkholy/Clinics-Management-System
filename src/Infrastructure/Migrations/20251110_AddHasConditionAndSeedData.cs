using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHasConditionAndSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add HasCondition column to MessageTemplates with default false
            migrationBuilder.AddColumn<bool>(
                name: "HasCondition",
                table: "MessageTemplates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Seed admin users (if not already present, check happens at app level)
            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Username", "FirstName", "LastName", "Role", "PasswordHash", "ModeratorId" },
                values: new object[,]
                {
                    {
                        "admin_primary",
                        "أحمد",
                        "المدير الأول",
                        "primary_admin",
                        "AQAAAAIAAYagAAAAEFis02t8W90rJ6Pkqw6wwD45hx6QI2ArKLqW8tl77SnIidCWW43DLldUP2G1BhxkXw==",
                        null
                    },
                    {
                        "admin_secondary",
                        "سارة",
                        "المديرة الثانية",
                        "secondary_admin",
                        "AQAAAAIAAYagAAAAEFmtEKOGKA5/ficlHNopu3+fZ1ly0ocuBAvJgl59wxjRQgGSFDlPgKNa+KR2a8vpTA==",
                        null
                    },
                    {
                        "moderator_ahmed",
                        "د.",
                        "أحمد",
                        "moderator",
                        "AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==",
                        null
                    },
                    {
                        "moderator_sara",
                        "د.",
                        "سارة",
                        "moderator",
                        "AQAAAAIAAYagAAAAEAl24nxVIY22QRB5OdNaWSlDWAVFL0NJRq5VxIpS2ReFYDg3Vh1KbnJbsNOnQPC/kw==",
                        null
                    }
                });

            // Seed quotas for moderators (IDs 3 and 4 from users insert order)
            migrationBuilder.InsertData(
                table: "Quotas",
                columns: new[] { "ModeratorUserId", "MessagesQuota", "ConsumedMessages", "QueuesQuota", "ConsumedQueues", "UpdatedAt" },
                values: new object[,]
                {
                    { 3, 0, 0, 0, 0, DateTime.UtcNow },
                    { 4, 0, 0, 0, 0, DateTime.UtcNow }
                });

            // Seed queues for moderators (2 queues per moderator)
            migrationBuilder.InsertData(
                table: "Queues",
                columns: new[] { "DoctorName", "CreatedBy", "ModeratorId", "CurrentPosition", "EstimatedWaitMinutes" },
                values: new object[,]
                {
                    { "د. أحمد - العيادة الخارجية", 3, 3, 1, 15 },
                    { "د. أحمد - الحجز", 3, 3, 1, 20 },
                    { "د. سارة - العيادة الخارجية", 4, 4, 1, 15 },
                    { "د. سارة - الحجز", 4, 4, 1, 20 }
                });

            // Seed templates and their placeholder conditions for each queue
            // Queue 1 (ID 1): 1 default + 1 conditional template
            migrationBuilder.InsertData(
                table: "MessageTemplates",
                columns: new[] { "Title", "Content", "CreatedBy", "ModeratorId", "QueueId", "IsActive", "IsDefault", "HasCondition", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        "الترحيب الافتراضي",
                        "السلام عليكم ورحمة الله\nأهلا بك في عيادة د. أحمد\nرقمك في الطابور: {PQP}\nموقعك الحالي: {CQP}\nالوقت المتوقع للانتظار: {ETR}",
                        3,
                        3,
                        1,
                        true,
                        true,
                        false,
                        DateTime.UtcNow,
                        null
                    },
                    {
                        "تنبيه المتأخرين",
                        "السلام عليكم ورحمة الله\nلاحظنا عدم حضورك\nيرجى الحضور في الوقت المحدد",
                        3,
                        3,
                        1,
                        true,
                        false,
                        true,
                        DateTime.UtcNow,
                        null
                    }
                });

            // Create placeholder condition for Queue 1, Template 1 (default)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 1, "DEFAULT", null, null, null, DateTime.UtcNow, null }
                });

            // Create active condition for Queue 1, Template 2 (conditional)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 2, 1, "GREATER", 10, null, null, DateTime.UtcNow, null }
                });

            // Queue 2 (ID 2): 1 default + 1 conditional template
            migrationBuilder.InsertData(
                table: "MessageTemplates",
                columns: new[] { "Title", "Content", "CreatedBy", "ModeratorId", "QueueId", "IsActive", "IsDefault", "HasCondition", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        "رسالة الحجز الافتراضية",
                        "تم حجز موعدك بنجاح\nالموعد: {DN}\nرقم الحجز: {PQP}",
                        3,
                        3,
                        2,
                        true,
                        true,
                        false,
                        DateTime.UtcNow,
                        null
                    },
                    {
                        "تأكيد الحضور",
                        "يرجى تأكيد حضورك للموعد المحدد",
                        3,
                        3,
                        2,
                        true,
                        false,
                        false,
                        DateTime.UtcNow,
                        null
                    }
                });

            // Create placeholder condition for Queue 2, Template 3 (default)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 3, 2, "DEFAULT", null, null, null, DateTime.UtcNow, null }
                });

            // Create placeholder condition for Queue 2, Template 4 (no-condition)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 4, 2, "EQUAL", null, null, null, DateTime.UtcNow, null }
                });

            // Queue 3 (ID 3): 1 default + 1 conditional template (for moderator_sara)
            migrationBuilder.InsertData(
                table: "MessageTemplates",
                columns: new[] { "Title", "Content", "CreatedBy", "ModeratorId", "QueueId", "IsActive", "IsDefault", "HasCondition", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        "الترحيب الافتراضي",
                        "السلام عليكم ورحمة الله\nأهلا بك في عيادة د. سارة\nرقمك في الطابور: {PQP}",
                        4,
                        4,
                        3,
                        true,
                        true,
                        false,
                        DateTime.UtcNow,
                        null
                    },
                    {
                        "تنبيه المتأخرين",
                        "يرجى الحضور فوراً",
                        4,
                        4,
                        3,
                        true,
                        false,
                        true,
                        DateTime.UtcNow,
                        null
                    }
                });

            // Create placeholder condition for Queue 3, Template 5 (default)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 5, 3, "DEFAULT", null, null, null, DateTime.UtcNow, null }
                });

            // Create active condition for Queue 3, Template 6 (conditional: RANGE 5-15)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 6, 3, "RANGE", null, 5, 15, DateTime.UtcNow, null }
                });

            // Queue 4 (ID 4): 1 default only (for moderator_sara)
            migrationBuilder.InsertData(
                table: "MessageTemplates",
                columns: new[] { "Title", "Content", "CreatedBy", "ModeratorId", "QueueId", "IsActive", "IsDefault", "HasCondition", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        "رسالة الحجز الافتراضية",
                        "موعدك مع د. سارة: {DN}",
                        4,
                        4,
                        4,
                        true,
                        true,
                        false,
                        DateTime.UtcNow,
                        null
                    }
                });

            // Create placeholder condition for Queue 4, Template 7 (default)
            migrationBuilder.InsertData(
                table: "MessageConditions",
                columns: new[] { "TemplateId", "QueueId", "Operator", "Value", "MinValue", "MaxValue", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    { 7, 4, "DEFAULT", null, null, null, DateTime.UtcNow, null }
                });

            // Seed sample patients for each queue (3-4 per queue)
            migrationBuilder.InsertData(
                table: "Patients",
                columns: new[] { "QueueId", "FullName", "PhoneNumber", "Position", "Status" },
                values: new object[,]
                {
                    // Queue 1
                    { 1, "محمد أحمد", "+201001234567", 2, "waiting" },
                    { 1, "فاطمة علي", "+201012345678", 3, "in_service" },
                    { 1, "سالم محمود", "+201023456789", 4, "waiting" },
                    // Queue 2
                    { 2, "أحمد حسن", "+201034567890", 2, "waiting" },
                    { 2, "ليلى محمد", "+201045678901", 3, "completed" },
                    // Queue 3
                    { 3, "علي محمد", "+201056789012", 2, "waiting" },
                    { 3, "نور سارة", "+201067890123", 3, "waiting" },
                    { 3, "خالد أحمد", "+201078901234", 4, "in_service" },
                    // Queue 4
                    { 4, "هند علي", "+201089012345", 2, "waiting" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Delete seeded data (reverse order of dependencies)
            migrationBuilder.DeleteData("Patients", keyColumn: "QueueId", keyValue: 4);
            migrationBuilder.DeleteData("Patients", keyColumn: "QueueId", keyValue: 3);
            migrationBuilder.DeleteData("Patients", keyColumn: "QueueId", keyValue: 2);
            migrationBuilder.DeleteData("Patients", keyColumn: "QueueId", keyValue: 1);

            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 7);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 6);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 5);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 4);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 3);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 2);
            migrationBuilder.DeleteData("MessageConditions", keyColumn: "TemplateId", keyValue: 1);

            migrationBuilder.DeleteData("MessageTemplates", keyColumn: "QueueId", keyValue: 4);
            migrationBuilder.DeleteData("MessageTemplates", keyColumn: "QueueId", keyValue: 3);
            migrationBuilder.DeleteData("MessageTemplates", keyColumn: "QueueId", keyValue: 2);
            migrationBuilder.DeleteData("MessageTemplates", keyColumn: "QueueId", keyValue: 1);

            migrationBuilder.DeleteData("Queues", keyColumn: "Id", keyValue: 4);
            migrationBuilder.DeleteData("Queues", keyColumn: "Id", keyValue: 3);
            migrationBuilder.DeleteData("Queues", keyColumn: "Id", keyValue: 2);
            migrationBuilder.DeleteData("Queues", keyColumn: "Id", keyValue: 1);

            migrationBuilder.DeleteData("Quotas", keyColumn: "ModeratorUserId", keyValue: 4);
            migrationBuilder.DeleteData("Quotas", keyColumn: "ModeratorUserId", keyValue: 3);

            migrationBuilder.DeleteData("Users", keyColumn: "Username", keyValue: "moderator_sara");
            migrationBuilder.DeleteData("Users", keyColumn: "Username", keyValue: "moderator_ahmed");
            migrationBuilder.DeleteData("Users", keyColumn: "Username", keyValue: "admin_secondary");
            migrationBuilder.DeleteData("Users", keyColumn: "Username", keyValue: "admin_primary");

            // Remove HasCondition column
            migrationBuilder.DropColumn("HasCondition", "MessageTemplates");
        }
    }
}
