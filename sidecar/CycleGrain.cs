using System.Text.Json;

namespace Orleans.Sidecar;

/// <summary>
/// CycleGrain implementation - each instance represents a single cycle
/// Keyed by cycleId (Guid) - supports N cycles per user
/// </summary>
public class CycleGrain(
    [PersistentState("cycleState", "cycleStore")] IPersistentState<CycleState> cycleState,
    ILogger<CycleGrain> logger
) : Grain, ICycleGrain
{
    private readonly IPersistentState<CycleState> _cycleState = cycleState ?? throw new ArgumentNullException(nameof(cycleState));
    private readonly ILogger<CycleGrain> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        var cycleId = this.GetPrimaryKey();

        _logger.LogInformation("[CycleGrain] OnActivateAsync for {CycleId}. RecordExists: {RecordExists}",
            cycleId, _cycleState.RecordExists);

        // Do NOT auto-create state - let Initialize() handle creation
        if (_cycleState.RecordExists && _cycleState.State != null)
        {
            _logger.LogInformation("[CycleGrain] Loaded EXISTING cycle {CycleId} for user {UserId}. Status: {Status}, UpdatedAt: {UpdatedAt}",
                cycleId, _cycleState.State.UserId, _cycleState.State.Status, _cycleState.State.UpdatedAt);
        }
        else
        {
            _logger.LogInformation("[CycleGrain] No existing state found for cycle {CycleId}. Waiting for Initialize().", cycleId);
        }

        await base.OnActivateAsync(cancellationToken);
    }

    public Task<string?> GetStateJson()
    {
        var cycleId = this.GetPrimaryKey();
        _logger.LogInformation("[CycleGrain] GetStateJson called for {CycleId}. RecordExists: {RecordExists}",
            cycleId, _cycleState.RecordExists);

        // Return null if cycle doesn't exist
        if (!_cycleState.RecordExists || _cycleState.State == null || string.IsNullOrEmpty(_cycleState.State.SnapshotJson))
        {
            _logger.LogInformation("[CycleGrain] No state found for cycle {CycleId}", cycleId);
            return Task.FromResult<string?>(null);
        }

        return Task.FromResult<string?>(_cycleState.State.SnapshotJson);
    }

    public async Task<string> UpdateStateJson(string snapshotJson)
    {
        var cycleId = this.GetPrimaryKey();
        _logger.LogInformation("[CycleGrain] UpdateStateJson called for {CycleId}. RecordExists: {RecordExists}",
            cycleId, _cycleState.RecordExists);

        if (!_cycleState.RecordExists || _cycleState.State == null)
        {
            _logger.LogError("[CycleGrain] Cannot update snapshot for uninitialized cycle {CycleId}. Call Initialize() first.", cycleId);
            throw new InvalidOperationException($"Cycle {cycleId} must be initialized before updating snapshot");
        }

        // Update snapshot
        _cycleState.State.SnapshotJson = snapshotJson ?? string.Empty;
        _cycleState.State.UpdatedAt = DateTime.UtcNow;

        _logger.LogInformation("[CycleGrain] Updating snapshot for cycle {CycleId} (user: {UserId})",
            cycleId, _cycleState.State.UserId);

        // Persist to Orleans storage
        await _cycleState.WriteStateAsync();

        _logger.LogInformation("[CycleGrain] Snapshot persisted successfully for cycle {CycleId}", cycleId);

        return _cycleState.State.SnapshotJson;
    }

    public Task<CycleMetadata?> GetMetadata()
    {
        var cycleId = this.GetPrimaryKey();

        if (!_cycleState.RecordExists || _cycleState.State == null)
        {
            _logger.LogInformation("[CycleGrain] No metadata found for cycle {CycleId}", cycleId);
            return Task.FromResult<CycleMetadata?>(null);
        }

        var metadata = new CycleMetadata
        {
            CycleId = _cycleState.State.CycleId,
            UserId = _cycleState.State.UserId,
            StartDate = _cycleState.State.StartDate,
            EndDate = _cycleState.State.EndDate,
            Status = _cycleState.State.Status,
            CreatedAt = _cycleState.State.CreatedAt,
            UpdatedAt = _cycleState.State.UpdatedAt
        };

        _logger.LogInformation("[CycleGrain] Returning metadata for cycle {CycleId}: Status={Status}, UserId={UserId}",
            cycleId, metadata.Status, metadata.UserId);

        return Task.FromResult<CycleMetadata?>(metadata);
    }

    public async Task Initialize(string userId, DateTime startDate, DateTime endDate)
    {
        var cycleId = this.GetPrimaryKey();

        if (_cycleState.RecordExists && _cycleState.State != null)
        {
            _logger.LogWarning("[CycleGrain] Cycle {CycleId} already initialized. Skipping.", cycleId);
            return;
        }

        _logger.LogInformation("[CycleGrain] Initializing NEW cycle {CycleId} for user {UserId}. Dates: {StartDate} - {EndDate}",
            cycleId, userId, startDate, endDate);

        _cycleState.State = new CycleState
        {
            CycleId = cycleId,
            UserId = userId,
            SnapshotJson = string.Empty, // Will be set by UpdateStateJson
            StartDate = startDate,
            EndDate = endDate,
            Status = "InProgress",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _cycleState.WriteStateAsync();

        _logger.LogInformation("[CycleGrain] Cycle {CycleId} initialized successfully", cycleId);
    }

    public async Task UpdateMetadata(DateTime startDate, DateTime endDate, string status)
    {
        var cycleId = this.GetPrimaryKey();

        if (!_cycleState.RecordExists || _cycleState.State == null)
        {
            _logger.LogError("[CycleGrain] Cannot update metadata for uninitialized cycle {CycleId}", cycleId);
            throw new InvalidOperationException($"Cycle {cycleId} must be initialized before updating metadata");
        }

        _logger.LogInformation("[CycleGrain] Updating metadata for cycle {CycleId}. Status: {OldStatus} → {NewStatus}",
            cycleId, _cycleState.State.Status, status);

        _cycleState.State.StartDate = startDate;
        _cycleState.State.EndDate = endDate;
        _cycleState.State.Status = status;
        _cycleState.State.UpdatedAt = DateTime.UtcNow;

        await _cycleState.WriteStateAsync();

        _logger.LogInformation("[CycleGrain] Metadata updated successfully for cycle {CycleId}", cycleId);
    }
}
