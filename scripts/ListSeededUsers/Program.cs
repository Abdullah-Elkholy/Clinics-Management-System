using System;
using Microsoft.Data.SqlClient;

var cs = "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;";
using var cn = new SqlConnection(cs);
try
{
    cn.Open();
    using var cmd = cn.CreateCommand();
    cmd.CommandText = "SELECT Id, Username, FullName, RoleId, PasswordHash, Email, PhoneNumber FROM dbo.Users ORDER BY Username;";
    using var rdr = cmd.ExecuteReader();
    while (rdr.Read())
    {
        var id = rdr.IsDBNull(0) ? "<null>" : rdr.GetValue(0).ToString();
        var username = rdr.IsDBNull(1) ? "<null>" : rdr.GetString(1);
        var fullname = rdr.IsDBNull(2) ? "<null>" : rdr.GetString(2);
        var roleId = rdr.IsDBNull(3) ? "<null>" : rdr.GetValue(3).ToString();
        var pwd = rdr.IsDBNull(4) ? "<null>" : (rdr.GetValue(4) ?? "<null>").ToString();
        var email = rdr.IsDBNull(5) ? "<null>" : rdr.GetString(5);
        var phone = rdr.IsDBNull(6) ? "<null>" : rdr.GetString(6);
    Console.WriteLine($"{id}|{username}|{fullname}|RoleId={roleId}|PwdLen={(pwd=="<null>"?0:pwd.Length)}|Email={email}|Phone={phone}");
    }
}
catch (Exception ex)
{
    Console.WriteLine("ERROR: " + ex.Message);
}

