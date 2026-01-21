using FluentAssertions;

namespace Clinics.Api.Tests.Unit.Logging;

public class BusinessLogUsageTests
{
    [Fact]
    public void Business_prefix_is_only_used_in_logging_helpers()
    {
        var repoRoot = FindRepoRoot();
        var apiRoot = Path.Combine(repoRoot, "src", "Api");

        Directory.Exists(apiRoot).Should().BeTrue($"Expected API folder at {apiRoot}");

        var allowedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Path.Combine(apiRoot, "Logging", "BusinessLoggingExtensions.cs"),
            Path.Combine(apiRoot, "Program.cs"),
        };

        var offenders = new List<string>();
        foreach (var file in Directory.EnumerateFiles(apiRoot, "*.cs", SearchOption.AllDirectories))
        {
            if (allowedFiles.Contains(file))
            {
                continue;
            }

            var content = File.ReadAllText(file);
            if (content.Contains("\"[Business]", StringComparison.Ordinal))
            {
                offenders.Add(Relativize(repoRoot, file));
            }
        }

        offenders.Should().BeEmpty("Use ILogger.LogBusinessInformation/LogBusinessError instead of writing '[Business]' directly. Offenders: {0}",
            string.Join(", ", offenders));
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "ClinicsManagementSln.sln")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new InvalidOperationException("Could not locate repo root (ClinicsManagementSln.sln not found)");
    }

    private static string Relativize(string root, string path)
    {
        try
        {
            return Path.GetRelativePath(root, path);
        }
        catch
        {
            return path;
        }
    }
}
