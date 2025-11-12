using Swashbuckle.AspNetCore.SwaggerGen;
using Microsoft.OpenApi.Models;
using Microsoft.OpenApi.Any;

namespace Clinics.Api.Swagger
{
    /// <summary>
    /// Enriches the OpenAPI schema for condition-related DTOs by documenting
    /// allowed operator values and the semantics of value/minValue/maxValue fields.
    /// </summary>
    public sealed class OperatorSchemaFilter : ISchemaFilter
    {
        private static readonly string[] Operators = new[] { "UNCONDITIONED", "DEFAULT", "EQUAL", "GREATER", "LESS", "RANGE" };

        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            var typeName = context.Type.FullName;
            if (typeName == "Clinics.Api.DTOs.CreateConditionRequest" ||
                typeName == "Clinics.Api.DTOs.UpdateConditionRequest" ||
                typeName == "Clinics.Api.DTOs.ConditionDto")
            {
                if (schema.Properties != null && schema.Properties.TryGetValue("operator", out var opProp))
                {
                    opProp.Description =
                        $"Operator controlling template selection. Allowed values: {string.Join(", ", Operators)}\n" +
                        "Sentinels: UNCONDITIONED (no rule), DEFAULT (unique per queue). Active: EQUAL, GREATER, LESS, RANGE.";
                    opProp.Example = new OpenApiString("RANGE");
                }

                if (schema.Properties != null)
                {
                    if (schema.Properties.TryGetValue("value", out var valueProp))
                    {
                        valueProp.Description = "Required for EQUAL, GREATER, LESS. Must be integer ≥ 1.";
                    }
                    if (schema.Properties.TryGetValue("minValue", out var minProp))
                    {
                        minProp.Description = "RANGE lower bound (inclusive). Must be ≥ 1 and < maxValue.";
                    }
                    if (schema.Properties.TryGetValue("maxValue", out var maxProp))
                    {
                        maxProp.Description = "RANGE upper bound (inclusive). Must be ≥ 1 and > minValue.";
                    }
                }
            }
            else if (typeName == "Clinics.Api.DTOs.TemplateDto")
            {
                if (schema.Properties != null && schema.Properties.TryGetValue("condition", out var condProp))
                {
                    condProp.Description = "Associated condition; its operator encodes template state (DEFAULT, UNCONDITIONED or active rule).";
                }
            }
        }
    }
}
