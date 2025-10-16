SET NOCOUNT ON;
SELECT Id, Username, LEN(PasswordHash) AS HashLen, FullName, RoleId FROM dbo.Users WHERE Username = 'admin';
