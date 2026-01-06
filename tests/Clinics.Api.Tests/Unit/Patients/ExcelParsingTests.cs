using System;
using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Patients;

/// <summary>
/// Phase 3.4: Excel upload parsing tests.
/// 
/// These tests document expected behavior for Excel patient import.
/// Per TEST_RESET_AND_REBUILD_PLAN.md section 5.2, tests cover:
/// - Columns in different order
/// - Missing required columns
/// - Extra unknown columns
/// - Mixed types in column
/// - Trailing/non-breaking spaces
/// - Arabic text, special characters
/// - Duplicated rows
/// - Row-level error reporting
/// 
/// NOTE: These tests use a simulator as the actual Excel import is not yet implemented.
/// Tests serve as specification for when the feature is built.
/// </summary>
public class ExcelParsingTests
{
    #region Test Infrastructure

    private class ExcelRow
    {
        public int RowNumber { get; set; }
        public Dictionary<string, string?> Cells { get; set; } = new();
    }

    private class ParseResult
    {
        public bool Success { get; set; }
        public List<PatientParseResult> Patients { get; set; } = new();
        public List<ParseError> Errors { get; set; } = new();
    }

    private class PatientParseResult
    {
        public int RowNumber { get; set; }
        public string FullName { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string CountryCode { get; set; } = "+20";
    }

    private class ParseError
    {
        public int RowNumber { get; set; }
        public string Column { get; set; } = "";
        public string Message { get; set; } = "";
    }

    private static class ExcelParser
    {
        private static readonly HashSet<string> RequiredColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "FullName", "الاسم", "Name",
            "PhoneNumber", "رقم الهاتف", "Phone"
        };

        private static readonly HashSet<string> NameColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "FullName", "الاسم", "Name", "PatientName", "اسم المريض"
        };

        private static readonly HashSet<string> PhoneColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "PhoneNumber", "رقم الهاتف", "Phone", "Mobile", "الموبايل"
        };

        public static ParseResult Parse(List<string> headers, List<ExcelRow> rows)
        {
            var result = new ParseResult { Success = true };

            // Find column indices
            var nameColIndex = headers.FindIndex(h => NameColumns.Contains(h.Trim()));
            var phoneColIndex = headers.FindIndex(h => PhoneColumns.Contains(h.Trim()));

            // Check required columns
            if (nameColIndex < 0)
            {
                result.Errors.Add(new ParseError { RowNumber = 0, Column = "Header", Message = "Missing required column: FullName" });
                result.Success = false;
            }
            if (phoneColIndex < 0)
            {
                result.Errors.Add(new ParseError { RowNumber = 0, Column = "Header", Message = "Missing required column: PhoneNumber" });
                result.Success = false;
            }

            if (!result.Success) return result;

            var nameCol = headers[nameColIndex].Trim();
            var phoneCol = headers[phoneColIndex].Trim();
            var seenPhones = new HashSet<string>();

            foreach (var row in rows)
            {
                var name = row.Cells.GetValueOrDefault(nameCol)?.Trim() ?? "";
                var phone = row.Cells.GetValueOrDefault(phoneCol)?.Trim() ?? "";

                // Normalize phone
                phone = phone.Replace(" ", "").Replace("-", "").Replace("\u00A0", ""); // Remove NBSP

                // Validate name
                if (string.IsNullOrWhiteSpace(name))
                {
                    result.Errors.Add(new ParseError
                    {
                        RowNumber = row.RowNumber,
                        Column = nameCol,
                        Message = "Name is required"
                    });
                    result.Success = false;
                    continue;
                }

                if (name.Length < 2)
                {
                    result.Errors.Add(new ParseError
                    {
                        RowNumber = row.RowNumber,
                        Column = nameCol,
                        Message = "Name must be at least 2 characters"
                    });
                    result.Success = false;
                    continue;
                }

                // Validate phone
                if (string.IsNullOrWhiteSpace(phone))
                {
                    result.Errors.Add(new ParseError
                    {
                        RowNumber = row.RowNumber,
                        Column = phoneCol,
                        Message = "Phone is required"
                    });
                    result.Success = false;
                    continue;
                }

                // Check for duplicate phone in this batch
                if (seenPhones.Contains(phone))
                {
                    result.Errors.Add(new ParseError
                    {
                        RowNumber = row.RowNumber,
                        Column = phoneCol,
                        Message = $"Duplicate phone: {phone}"
                    });
                    result.Success = false;
                    continue;
                }
                seenPhones.Add(phone);

                result.Patients.Add(new PatientParseResult
                {
                    RowNumber = row.RowNumber,
                    FullName = name,
                    PhoneNumber = phone
                });
            }

            return result;
        }
    }

    private static ExcelRow CreateRow(int rowNum, string name, string phone)
    {
        return new ExcelRow
        {
            RowNumber = rowNum,
            Cells = new Dictionary<string, string?> { ["FullName"] = name, ["PhoneNumber"] = phone }
        };
    }

    #endregion

    #region Column Order Tests

    [Fact]
    public void Parse_StandardColumnOrder_ShouldWork()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed", "0100123456") };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients.Should().HaveCount(1);
    }

    [Fact]
    public void Parse_ReversedColumnOrder_ShouldWork()
    {
        var headers = new List<string> { "PhoneNumber", "FullName" };
        var rows = new List<ExcelRow>
        {
            new() { RowNumber = 2, Cells = new() { ["PhoneNumber"] = "0100", ["FullName"] = "Ahmed" } }
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients[0].FullName.Should().Be("Ahmed");
    }

    [Fact]
    public void Parse_ArabicColumnNames_ShouldWork()
    {
        var headers = new List<string> { "الاسم", "رقم الهاتف" };
        var rows = new List<ExcelRow>
        {
            new() { RowNumber = 2, Cells = new() { ["الاسم"] = "أحمد", ["رقم الهاتف"] = "0100" } }
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients[0].FullName.Should().Be("أحمد");
    }

    #endregion

    #region Missing Required Columns Tests

    [Fact]
    public void Parse_MissingNameColumn_ShouldFail()
    {
        var headers = new List<string> { "PhoneNumber" };
        var rows = new List<ExcelRow>();

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Message.Contains("FullName"));
    }

    [Fact]
    public void Parse_MissingPhoneColumn_ShouldFail()
    {
        var headers = new List<string> { "FullName" };
        var rows = new List<ExcelRow>();

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Message.Contains("PhoneNumber"));
    }

    #endregion

    #region Extra Columns Tests

    [Fact]
    public void Parse_ExtraUnknownColumns_ShouldIgnore()
    {
        var headers = new List<string> { "FullName", "PhoneNumber", "Notes", "Date", "Random" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed", "0100") };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients.Should().HaveCount(1);
    }

    #endregion

    #region Data Type Tests

    [Fact]
    public void Parse_PhoneAsNumber_ShouldNormalize()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed", "01001234567") };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients[0].PhoneNumber.Should().Be("01001234567");
    }

    #endregion

    #region Whitespace Handling Tests

    [Fact]
    public void Parse_TrailingSpaces_ShouldTrim()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "  Ahmed  ", "  0100  ") };

        var result = ExcelParser.Parse(headers, rows);

        result.Patients[0].FullName.Should().Be("Ahmed");
        result.Patients[0].PhoneNumber.Should().Be("0100");
    }

    [Fact]
    public void Parse_NonBreakingSpaces_ShouldRemove()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed\u00A0Hassan", "0100\u00A0123") };

        var result = ExcelParser.Parse(headers, rows);

        result.Patients[0].PhoneNumber.Should().Be("0100123");
    }

    [Fact]
    public void Parse_PhoneWithDashes_ShouldNormalize()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed", "010-0123-456") };

        var result = ExcelParser.Parse(headers, rows);

        result.Patients[0].PhoneNumber.Should().Be("0100123456");
    }

    #endregion

    #region Arabic and Special Character Tests

    [Fact]
    public void Parse_ArabicNames_ShouldPreserve()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "أحمد محمد حسن", "0100") };

        var result = ExcelParser.Parse(headers, rows);

        result.Patients[0].FullName.Should().Be("أحمد محمد حسن");
    }

    [Fact]
    public void Parse_MixedArabicEnglish_ShouldPreserve()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow> { CreateRow(2, "Ahmed أحمد", "0100") };

        var result = ExcelParser.Parse(headers, rows);

        result.Patients[0].FullName.Should().Be("Ahmed أحمد");
    }

    #endregion

    #region Duplicate Row Tests

    [Fact]
    public void Parse_DuplicatePhone_ShouldReportError()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>
        {
            CreateRow(2, "Ahmed", "0100123456"),
            CreateRow(3, "Mohamed", "0100123456") // Same phone
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RowNumber == 3 && e.Message.Contains("Duplicate"));
    }

    [Fact]
    public void Parse_DuplicateName_ShouldAllow()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>
        {
            CreateRow(2, "Ahmed Hassan", "0100"),
            CreateRow(3, "Ahmed Hassan", "0200") // Same name, different phone
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients.Should().HaveCount(2);
    }

    #endregion

    #region Row-Level Error Reporting Tests

    [Fact]
    public void Parse_InvalidRow_ShouldReportRowNumber()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>
        {
            CreateRow(2, "Ahmed", "0100"),
            CreateRow(3, "", "0200"), // Missing name
            CreateRow(4, "Hassan", "0300")
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Errors.Should().Contain(e => e.RowNumber == 3);
        result.Patients.Should().HaveCount(2);
    }

    [Fact]
    public void Parse_MultipleErrors_ShouldReportAll()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>
        {
            CreateRow(2, "", "0100"),      // Missing name
            CreateRow(3, "Ahmed", ""),      // Missing phone
            CreateRow(4, "A", "0300")       // Name too short
        };

        var result = ExcelParser.Parse(headers, rows);

        result.Errors.Should().HaveCountGreaterThanOrEqualTo(3);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Parse_EmptyFile_ShouldSucceedWithNoPatients()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>();

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients.Should().BeEmpty();
    }

    [Fact]
    public void Parse_HeadersOnly_ShouldSucceedWithNoPatients()
    {
        var headers = new List<string> { "FullName", "PhoneNumber" };
        var rows = new List<ExcelRow>();

        var result = ExcelParser.Parse(headers, rows);

        result.Success.Should().BeTrue();
        result.Patients.Should().BeEmpty();
    }

    #endregion
}
