EF Core migrations should be created with the dotnet-ef tool when developing locally.

Example commands:

# install tools
dotnet tool install --global dotnet-ef

# create migration
dotnet ef migrations add InitialCreate --project src/Api --startup-project src/Api

# apply migration
dotnet ef database update --project src/Api --startup-project src/Api
