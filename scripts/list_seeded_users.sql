SET NOCOUNT ON;
SELECT u.Username, r.Name AS RoleName FROM dbo.Users u JOIN dbo.Roles r ON u.RoleId = r.Id WHERE u.Username IN ('admin','admin2','mod1','user1') ORDER BY u.Username;
