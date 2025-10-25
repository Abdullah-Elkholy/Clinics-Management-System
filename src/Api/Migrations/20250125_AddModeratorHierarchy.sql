-- Migration: Add Moderator Hierarchy Support
-- Date: 2025-01-25
-- Description: Adds support for moderator-based resource scoping and user hierarchy

-- Step 1: Add ModeratorId columns to existing tables

-- Add ModeratorId to Queues table
ALTER TABLE [Queues] ADD [ModeratorId] INT NOT NULL DEFAULT 0;

-- Add ModeratorId to MessageTemplates table  
ALTER TABLE [MessageTemplates] ADD [ModeratorId] INT NOT NULL DEFAULT 0;
ALTER TABLE [MessageTemplates] ADD [IsActive] BIT NOT NULL DEFAULT 1;

-- Add ModeratorId to Messages table
ALTER TABLE [Messages] ADD [ModeratorId] INT NOT NULL DEFAULT 0;

-- Step 2: Create ModeratorSettings table
CREATE TABLE [ModeratorSettings] (
    [Id] INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    [ModeratorUserId] INT NOT NULL,
    [WhatsAppPhoneNumber] VARCHAR(20) NULL,
    [IsActive] BIT NOT NULL DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_ModeratorSettings_Users_ModeratorUserId] FOREIGN KEY ([ModeratorUserId]) REFERENCES [Users]([Id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_ModeratorSettings_ModeratorUserId] UNIQUE ([ModeratorUserId])
);

-- Step 3: Create indices for performance
CREATE NONCLUSTERED INDEX [IX_Queues_ModeratorId] ON [Queues] ([ModeratorId]);
CREATE NONCLUSTERED INDEX [IX_MessageTemplates_ModeratorId] ON [MessageTemplates] ([ModeratorId]);
CREATE NONCLUSTERED INDEX [IX_Messages_ModeratorId] ON [Messages] ([ModeratorId]);
CREATE NONCLUSTERED INDEX [IX_ModeratorSettings_ModeratorUserId] ON [ModeratorSettings] ([ModeratorUserId]);

-- Step 4: Add foreign key constraints
ALTER TABLE [Queues] 
ADD CONSTRAINT [FK_Queues_Users_ModeratorId] FOREIGN KEY ([ModeratorId]) REFERENCES [Users]([Id]) ON DELETE RESTRICT;

ALTER TABLE [MessageTemplates] 
ADD CONSTRAINT [FK_MessageTemplates_Users_ModeratorId] FOREIGN KEY ([ModeratorId]) REFERENCES [Users]([Id]) ON DELETE RESTRICT;

ALTER TABLE [Messages] 
ADD CONSTRAINT [FK_Messages_Users_ModeratorId] FOREIGN KEY ([ModeratorId]) REFERENCES [Users]([Id]) ON DELETE RESTRICT;

-- Step 5: Populate initial data for existing records
-- For any existing queues/templates/messages, assign them to the primary admin or first moderator
-- This assumes you have at least one user in the system
UPDATE [Queues] SET [ModeratorId] = ISNULL((SELECT MIN(Id) FROM [Users] WHERE Role = 'moderator'), 1) WHERE [ModeratorId] = 0;
UPDATE [MessageTemplates] SET [ModeratorId] = ISNULL((SELECT MIN(Id) FROM [Users] WHERE Role = 'moderator'), 1) WHERE [ModeratorId] = 0;
UPDATE [Messages] SET [ModeratorId] = ISNULL((SELECT MIN(Id) FROM [Users] WHERE Role = 'moderator'), 1) WHERE [ModeratorId] = 0;

-- Step 6: Add ModeratorSettings for existing moderators (optional - run if you have existing moderators)
INSERT INTO [ModeratorSettings] ([ModeratorUserId], [IsActive])
SELECT DISTINCT [Id], 1 
FROM [Users] 
WHERE [Role] = 'moderator' AND [Id] NOT IN (SELECT [ModeratorUserId] FROM [ModeratorSettings])
