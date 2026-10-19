using Backend.Repositories.ExplorationMap;
using Backend.Repositories.TechnoMap;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

DefaultTypeMap.MatchNamesWithUnderscores = true;

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<
    IExplorationMapRepository,
    ExplorationMapRepository>();

builder.Services.AddScoped<
    ITechnoMapRepository,
    TechnoMapRepository>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint(
            "/swagger/v1/swagger.json",
            "Drilling Maps API v1");

        options.DocumentTitle = "Drilling Maps API";
    });
}
app.UseCors("ReactFrontend");

// Liveness probe for the frontend's Online/Offline indicator. Deliberately
// does not touch the database: it answers "is the API up?".
app.MapGet("/api/health", () => Results.Ok());

app.MapControllers();

app.Run();