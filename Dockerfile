# =============================================================================
# API Dockerfile - Multi-stage build for .NET 8 API
# =============================================================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files first for layer caching
COPY src/Domain/Domain.csproj src/Domain/
COPY src/Application/Application.csproj src/Application/
COPY src/Infrastructure/Infrastructure.csproj src/Infrastructure/
COPY src/Api/Clinics.Api.csproj src/Api/

# Restore dependencies
RUN dotnet restore src/Api/Clinics.Api.csproj

# Copy all source code
COPY src/ src/

# Build and publish
WORKDIR /src/src/Api
RUN dotnet publish Clinics.Api.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Create logs directory
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# Copy published app
COPY --from=build /app/publish .

# Create directory for DataProtection keys and set permissions
# Create directory for DataProtection keys and set permissions
RUN mkdir -p /app/DataProtection-Keys && chown -R appuser:appgroup /app/DataProtection-Keys

# Set environment variables
ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DATABASE_PROVIDER=PostgreSQL

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Switch to non-root user
USER appuser

# Entry point
ENTRYPOINT ["dotnet", "Clinics.Api.dll"]
