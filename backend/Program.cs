using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Repositories.ExplorationMap;
using Backend.Repositories.TechnoMap;
using Backend.Repositories.Dashboard;
using Backend.Repositories.Dashboard.Interfaces;
using Backend.Models.Dashboard;
using Backend.Services;
using Backend.Services.Interfaces;
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

builder.Services
    .AddOptions<CampaignOptions>()
    .Bind(builder.Configuration.GetSection(CampaignOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Which object to read. Separate from Campaigns because it changes for a
// different reason — and it already has: the Power BI model named a
// VIEW_ prefixed object in a schema that does not exist.
builder.Services
    .AddOptions<SourceTableOptions>()
    .Bind(builder.Configuration.GetSection(SourceTableOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddMemoryCache();
builder.Services.AddScoped<IHoleRepository, HoleRepository>();
builder.Services.AddScoped<IDrillingService, DrillingService>();

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

app.UseResponseCaching();
app.MapControllers();

app.Run();