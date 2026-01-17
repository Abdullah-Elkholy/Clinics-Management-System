-- Fix for duplicate key error when re-pairing revoked extension devices
-- This migration changes the unique constraint on ExtensionDevices to only apply
-- to active (non-revoked) devices, allowing the same device to be re-paired after revocation

USE ClinicsDb;
GO

-- Drop the existing unique index
DROP INDEX IF EXISTS IX_ExtensionDevices_ModeratorUserId_DeviceId ON ExtensionDevices;
GO

-- Create new filtered unique index (only for active/non-revoked devices)
CREATE UNIQUE INDEX IX_ExtensionDevices_ModeratorUserId_DeviceId
ON ExtensionDevices (ModeratorUserId, DeviceId)
WHERE RevokedAtUtc IS NULL;
GO

PRINT 'Successfully updated ExtensionDevices unique index with filter for active devices only';
GO
