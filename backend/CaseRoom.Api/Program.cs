using CaseRoom.Api.Hubs;
using CaseRoom.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5050");

builder.Services.AddHttpClient();
builder.Services.AddSingleton<GameStateStore>();
builder.Services.AddSingleton<DeepSeekAiService>();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("dev", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors("dev");

app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "CaseRoom.Api" }));
app.MapHub<GameHub>("/hubs/game");
app.MapHub<VoiceHub>("/hubs/voice");

app.Run();
