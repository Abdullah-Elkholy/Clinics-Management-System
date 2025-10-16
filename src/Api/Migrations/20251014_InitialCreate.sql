-- Placeholder for EF Core migration InitialCreate
-- Run `dotnet ef migrations add InitialCreate` locally to generate a proper migration.
-- This file documents the desired DDL; use EF Migrations for maintainability.

-- Create Roles table
CREATE TABLE Roles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL UNIQUE,
    DisplayName NVARCHAR(100) NOT NULL
);

-- Other tables: Users, Queues, Patients, MessageTemplates, Messages, FailedTasks, Quotas, AuditLogs, Sessions, WhatsAppSessions
-- See ARCHITECTURE.md for full CREATE TABLE scripts.
