using Orleans.Sidecar;
using Orleans.Sidecar.Extensions;
using DotNetEnv;
using System.Text.Json;

// Load .env file in development - check current directory and parent directory
var currentDir = Directory.GetCurrentDirectory();
var envPath = Path.Combine(currentDir, ".env");
var parentEnvPath = Path.Combine(Directory.GetParent(currentDir)?.FullName ?? currentDir, ".env");

if (File.Exists(envPath))
{
    Env.Load(envPath);
}
else if (File.Exists(parentEnvPath))
{
    Env.Load(parentEnvPath);
}

var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();

// Configure Orleans with PostgreSQL persistence
builder.Host.AddOrleansServices(builder.Configuration);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// ============================================================================
// ACTOR ENDPOINTS (External Actor State Management)
// ============================================================================

// GET /actors/{actorId} - Get complete XState snapshot
app.MapGet("/actors/{actorId}", async (string actorId, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.ActorEndpoint");
    logger.LogInformation("[GET /actors/{ActorId}] Incoming request to get actor snapshot", actorId);

    var grain = grainFactory.GetGrain<IActorGrain>(actorId);
    logger.LogInformation("[GET /actors/{ActorId}] Actor grain created/retrieved", actorId);

    try
    {
        var snapshotJson = await grain.GetStateJson();

        if (snapshotJson == null)
        {
            logger.LogInformation("[GET /actors/{ActorId}] Actor not found", actorId);
            return Results.NotFound(new { message = "Actor not found", actorId });
        }

        logger.LogInformation("[GET /actors/{ActorId}] Returning complete snapshot", actorId);
        // Return the JSON directly - ASP.NET will pass it through as-is
        return Results.Content(snapshotJson, "application/json");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[GET /actors/{ActorId}] Error getting actor snapshot", actorId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("GetActorState");

// POST /actors/{actorId} - Save complete XState snapshot
app.MapPost("/actors/{actorId}", async (string actorId, HttpContext context, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.ActorEndpoint");
    logger.LogInformation("[POST /actors/{ActorId}] Incoming request to save actor snapshot", actorId);
    logger.LogInformation("[POST /actors/{ActorId}] Content-Type: {ContentType}", actorId, context.Request.ContentType);
    logger.LogInformation("[POST /actors/{ActorId}] Content-Length: {ContentLength}", actorId, context.Request.ContentLength);

    var grain = grainFactory.GetGrain<IActorGrain>(actorId);

    try
    {
        // Read the raw JSON body as string
        using var reader = new StreamReader(context.Request.Body);
        var snapshotJson = await reader.ReadToEndAsync();

        logger.LogInformation("[POST /actors/{ActorId}] Received JSON body (length: {Length}): {Json}",
            actorId, snapshotJson.Length, snapshotJson);

        // Validate it's valid JSON
        var jsonDoc = JsonDocument.Parse(snapshotJson); // Will throw if invalid
        logger.LogInformation("[POST /actors/{ActorId}] JSON is valid. Root element type: {ElementType}",
            actorId, jsonDoc.RootElement.ValueKind);

        logger.LogInformation("[POST /actors/{ActorId}] Calling grain.UpdateStateJson...", actorId);
        var savedJson = await grain.UpdateStateJson(snapshotJson);
        logger.LogInformation("[POST /actors/{ActorId}] Grain returned saved JSON (length: {Length})",
            actorId, savedJson.Length);

        logger.LogInformation("[POST /actors/{ActorId}] Snapshot saved successfully", actorId);
        // Return the JSON directly - ASP.NET will pass it through as-is
        return Results.Content(savedJson, "application/json");
    }
    catch (JsonException ex)
    {
        logger.LogError(ex, "[POST /actors/{ActorId}] Invalid JSON in request body", actorId);
        return Results.BadRequest(new { error = "Invalid JSON in request body" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /actors/{ActorId}] Error saving actor snapshot", actorId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("UpdateActorState");

// ============================================================================
// USER AUTH ENDPOINTS (Password Change Tracking)
// ============================================================================

// GET /user-auth/{userId}/password-changed-at
app.MapGet("/user-auth/{userId}/password-changed-at", async (string userId, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.UserAuthEndpoint");
    logger.LogInformation("[GET /user-auth/{UserId}/password-changed-at] Incoming request", userId);

    var grain = grainFactory.GetGrain<IUserAuthGrain>(userId);

    try
    {
        var timestamp = await grain.GetPasswordChangedAt();
        logger.LogInformation("[GET /user-auth/{UserId}/password-changed-at] Timestamp: {Timestamp}", userId, timestamp);

        return Results.Ok(new { userId, passwordChangedAt = timestamp });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[GET /user-auth/{UserId}/password-changed-at] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("GetPasswordChangedAt");

// POST /user-auth/{userId}/password-changed-at
app.MapPost("/user-auth/{userId}/password-changed-at", async (string userId, long timestamp, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.UserAuthEndpoint");
    logger.LogInformation("[POST /user-auth/{UserId}/password-changed-at] Incoming request with timestamp: {Timestamp}", userId, timestamp);

    var grain = grainFactory.GetGrain<IUserAuthGrain>(userId);

    try
    {
        var savedTimestamp = await grain.SetPasswordChangedAt(timestamp);
        logger.LogInformation("[POST /user-auth/{UserId}/password-changed-at] Timestamp saved: {Timestamp}", userId, savedTimestamp);

        return Results.Ok(new { userId, passwordChangedAt = savedTimestamp });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /user-auth/{UserId}/password-changed-at] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("SetPasswordChangedAt");

// POST /user-auth/{userId}/validate-token
app.MapPost("/user-auth/{userId}/validate-token", async (string userId, long tokenIssuedAt, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.UserAuthEndpoint");
    logger.LogInformation("[POST /user-auth/{UserId}/validate-token] Incoming request with iat: {TokenIssuedAt}", userId, tokenIssuedAt);

    var grain = grainFactory.GetGrain<IUserAuthGrain>(userId);

    try
    {
        var isValid = await grain.IsTokenValid(tokenIssuedAt);
        logger.LogInformation("[POST /user-auth/{UserId}/validate-token] Token is valid: {IsValid}", userId, isValid);

        return Results.Ok(new { userId, tokenIssuedAt, isValid });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /user-auth/{UserId}/validate-token] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("ValidateToken");

// ============================================================================
// CYCLE GRAIN ENDPOINTS (Multi-Cycle Architecture)
// ============================================================================

// POST /users/{userId}/cycles/start - Try to start a new cycle
app.MapPost("/users/{userId}/cycles/start", async (
    string userId,
    HttpContext context,
    IGrainFactory grainFactory,
    ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[POST /users/{UserId}/cycles/start] Incoming request", userId);

    try
    {
        // Parse request body
        var request = await context.Request.ReadFromJsonAsync<StartCycleRequest>();
        if (request == null)
        {
            return Results.BadRequest(new { error = "Invalid request body" });
        }

        // Get index grain and try to start new cycle
        var indexGrain = grainFactory.GetGrain<IUserCycleIndexGrain>(Guid.Parse(userId));
        var canStart = await indexGrain.TryStartNewCycle(request.CycleId, request.StartDate, request.EndDate);

        if (!canStart)
        {
            logger.LogWarning("[POST /users/{UserId}/cycles/start] User already has active cycle", userId);
            return Results.Conflict(new { error = "User already has an active cycle", userId });
        }

        // Initialize the cycle grain
        var cycleGrain = grainFactory.GetGrain<ICycleGrain>(request.CycleId);
        await cycleGrain.Initialize(userId, request.StartDate, request.EndDate);

        logger.LogInformation("[POST /users/{UserId}/cycles/start] Cycle {CycleId} started successfully", userId, request.CycleId);
        return Results.Ok(new { cycleId = request.CycleId, userId, status = "started" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /users/{UserId}/cycles/start] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("StartCycle");

// GET /users/{userId}/cycles/active - Get active cycle ID
app.MapGet("/users/{userId}/cycles/active", async (string userId, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[GET /users/{UserId}/cycles/active] Incoming request", userId);

    try
    {
        var indexGrain = grainFactory.GetGrain<IUserCycleIndexGrain>(Guid.Parse(userId));
        var activeCycleId = await indexGrain.GetActiveCycleId();

        if (!activeCycleId.HasValue)
        {
            logger.LogInformation("[GET /users/{UserId}/cycles/active] No active cycle found", userId);
            return Results.NotFound(new { message = "No active cycle", userId });
        }

        logger.LogInformation("[GET /users/{UserId}/cycles/active] Active cycle: {CycleId}", userId, activeCycleId.Value);
        return Results.Ok(new { cycleId = activeCycleId.Value, userId });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[GET /users/{UserId}/cycles/active] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("GetActiveCycle");

// GET /cycles/{cycleId} - Get cycle snapshot
app.MapGet("/cycles/{cycleId}", async (string cycleId, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[GET /cycles/{CycleId}] Incoming request", cycleId);

    try
    {
        var cycleGrain = grainFactory.GetGrain<ICycleGrain>(Guid.Parse(cycleId));
        var snapshotJson = await cycleGrain.GetStateJson();

        if (snapshotJson == null)
        {
            logger.LogInformation("[GET /cycles/{CycleId}] Cycle not found", cycleId);
            return Results.NotFound(new { message = "Cycle not found", cycleId });
        }

        logger.LogInformation("[GET /cycles/{CycleId}] Returning cycle snapshot", cycleId);
        return Results.Content(snapshotJson, "application/json");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[GET /cycles/{CycleId}] Error", cycleId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("GetCycleSnapshot");

// POST /cycles/{cycleId} - Update cycle snapshot
app.MapPost("/cycles/{cycleId}", async (string cycleId, HttpContext context, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[POST /cycles/{CycleId}] Incoming request to update snapshot", cycleId);

    try
    {
        // Read raw JSON body
        using var reader = new StreamReader(context.Request.Body);
        var snapshotJson = await reader.ReadToEndAsync();

        logger.LogInformation("[POST /cycles/{CycleId}] Received snapshot (length: {Length})", cycleId, snapshotJson.Length);

        // Validate JSON
        var jsonDoc = JsonDocument.Parse(snapshotJson);
        logger.LogInformation("[POST /cycles/{CycleId}] JSON is valid", cycleId);

        // Update grain
        var cycleGrain = grainFactory.GetGrain<ICycleGrain>(Guid.Parse(cycleId));
        var savedJson = await cycleGrain.UpdateStateJson(snapshotJson);

        logger.LogInformation("[POST /cycles/{CycleId}] Snapshot updated successfully", cycleId);
        return Results.Content(savedJson, "application/json");
    }
    catch (JsonException ex)
    {
        logger.LogError(ex, "[POST /cycles/{CycleId}] Invalid JSON", cycleId);
        return Results.BadRequest(new { error = "Invalid JSON in request body" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /cycles/{CycleId}] Error", cycleId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("UpdateCycleSnapshot");

// PATCH /cycles/{cycleId}/metadata - Update cycle metadata
app.MapPatch("/cycles/{cycleId}/metadata", async (
    string cycleId,
    HttpContext context,
    IGrainFactory grainFactory,
    ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[PATCH /cycles/{CycleId}/metadata] Incoming request", cycleId);

    try
    {
        var request = await context.Request.ReadFromJsonAsync<UpdateMetadataRequest>();
        if (request == null)
        {
            return Results.BadRequest(new { error = "Invalid request body" });
        }

        var cycleGrain = grainFactory.GetGrain<ICycleGrain>(Guid.Parse(cycleId));
        await cycleGrain.UpdateMetadata(request.StartDate, request.EndDate, request.Status);

        logger.LogInformation("[PATCH /cycles/{CycleId}/metadata] Metadata updated", cycleId);
        return Results.Ok(new { cycleId, status = "updated" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[PATCH /cycles/{CycleId}/metadata] Error", cycleId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("UpdateCycleMetadata");

// POST /cycles/{cycleId}/complete - Mark cycle as completed
app.MapPost("/cycles/{cycleId}/complete", async (string cycleId, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[POST /cycles/{CycleId}/complete] Incoming request", cycleId);

    try
    {
        var cycleGrain = grainFactory.GetGrain<ICycleGrain>(Guid.Parse(cycleId));
        var metadata = await cycleGrain.GetMetadata();

        if (metadata == null)
        {
            return Results.NotFound(new { message = "Cycle not found", cycleId });
        }

        // Update cycle status to Completed
        await cycleGrain.UpdateMetadata(metadata.StartDate, metadata.EndDate, "Completed");

        // Update index grain
        var indexGrain = grainFactory.GetGrain<IUserCycleIndexGrain>(Guid.Parse(metadata.UserId));
        await indexGrain.MarkCycleComplete(Guid.Parse(cycleId));

        logger.LogInformation("[POST /cycles/{CycleId}/complete] Cycle marked as completed", cycleId);
        return Results.Ok(new { cycleId, status = "completed" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[POST /cycles/{CycleId}/complete] Error", cycleId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("CompleteCycle");

// GET /users/{userId}/cycles/recent - Get recent cycle IDs
app.MapGet("/users/{userId}/cycles/recent", async (string userId, int? limit, IGrainFactory grainFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Orleans.Sidecar.CycleEndpoint");
    logger.LogInformation("[GET /users/{UserId}/cycles/recent] Incoming request. Limit: {Limit}", userId, limit);

    try
    {
        var indexGrain = grainFactory.GetGrain<IUserCycleIndexGrain>(Guid.Parse(userId));
        var cycleIds = await indexGrain.GetRecentCycleIds(limit ?? 10);

        logger.LogInformation("[GET /users/{UserId}/cycles/recent] Returning {Count} cycle IDs", userId, cycleIds.Count);
        return Results.Ok(new { userId, cycles = cycleIds });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[GET /users/{UserId}/cycles/recent] Error", userId);
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("GetRecentCycles");

app.Run();

// Request/Response DTOs
public record StartCycleRequest(Guid CycleId, DateTime StartDate, DateTime EndDate);
public record UpdateMetadataRequest(DateTime StartDate, DateTime EndDate, string Status);

