using Backend.Repositories.ExplorationMap;
using Backend.Repositories.TechnoMap;
using Backend.Repositories.Dashboard;
using Backend.Models.Dashboard;
using Backend.Services;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

DefaultTypeMap.MatchNamesWithUnderscores = true;

builder.Services.AddControllers();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<ExplorationMapRepository>();
builder.Services.AddScoped<TechnoMapRepository>();

builder.Services
    .AddOptions<CampaignOptions>()
    .Bind(builder.Configuration.GetSection(CampaignOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Which table to read. Kept apart from Campaigns because it changes for other reasons.
builder.Services
    .AddOptions<SourceTableOptions>()
    .Bind(builder.Configuration.GetSection(SourceTableOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddMemoryCache();
builder.Services.AddScoped<HoleRepository>();
builder.Services.AddScoped<DrillingService>();

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