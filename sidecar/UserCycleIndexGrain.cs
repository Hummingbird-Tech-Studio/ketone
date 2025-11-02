namespace Orleans.Sidecar;

/// <summary>
/// UserCycleIndexGrain implementation - coordinates all cycles for a user
/// Keyed by userId (Guid) - enforces "1 active cycle" business rule
/// Uses [KeepAlive] to stay in memory (frequently accessed)
/// </summary>
[KeepAlive]
public class UserCycleIndexGrain(
    [PersistentState("userCycleIndex", "cycleIndexStore")] IPersistentState<UserCycleIndexState> indexState,
    ILogger<UserCycleIndexGrain> logger,
    IGrainFactory grainFactory
) : Grain, IUserCycleIndexGrain
{
    private readonly IPersistentState<UserCycleIndexState> _indexState = indexState ?? throw new ArgumentNullException(nameof(indexState));
    private readonly ILogger<UserCycleIndexGrain> _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    private readonly IGrainFactory _grainFactory = grainFactory ?? throw new ArgumentNullException(nameof(grainFactory));

    private const int MaxCyclesInIndex = 50; // Limit to avoid unbounded growth

    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        var userId = this.GetPrimaryKey();

        _logger.LogInformation("[UserCycleIndexGrain] OnActivateAsync for user {UserId}. RecordExists: {RecordExists}",
            userId, _indexState.RecordExists);

        // Initialize state if doesn't exist
        if (!_indexState.RecordExists || _indexState.State == null)
        {
            _indexState.State = new UserCycleIndexState
            {
                UserId = userId,
                ActiveCycleId = null,
                Cycles = new List<CycleMetadata>(),
                UpdatedAt = DateTime.UtcNow
            };
            _logger.LogInformation("[UserCycleIndexGrain] Initialized NEW index for user {UserId}", userId);
        }
        else
        {
            _logger.LogInformation("[UserCycleIndexGrain] Loaded EXISTING index for user {UserId}. ActiveCycle: {ActiveCycleId}, TotalCycles: {Count}",
                userId, _indexState.State.ActiveCycleId, _indexState.State.Cycles.Count);
        }

        await base.OnActivateAsync(cancellationToken);
    }

    public async Task<bool> TryStartNewCycle(Guid cycleId, DateTime startDate, DateTime endDate)
    {
        var userId = this.GetPrimaryKey();

        _logger.LogInformation("[UserCycleIndexGrain] TryStartNewCycle for user {UserId}. CycleId: {CycleId}",
            userId, cycleId);

        // Check if user already has an active cycle
        if (_indexState.State!.ActiveCycleId.HasValue)
        {
            var activeCycleId = _indexState.State.ActiveCycleId.Value;

            // Verify the active cycle is truly InProgress by checking the grain
            var activeCycle = _grainFactory.GetGrain<ICycleGrain>(activeCycleId);
            var metadata = await activeCycle.GetMetadata();

            if (metadata != null && metadata.Status == "InProgress")
            {
                _logger.LogWarning("[UserCycleIndexGrain] User {UserId} already has active cycle {ActiveCycleId}. Cannot start new cycle {NewCycleId}",
                    userId, activeCycleId, cycleId);
                return false;
            }

            // Active cycle is completed or doesn't exist - clear it
            _logger.LogInformation("[UserCycleIndexGrain] Active cycle {ActiveCycleId} is no longer InProgress. Clearing.",
                activeCycleId);
            _indexState.State.ActiveCycleId = null;
        }

        // Register the new cycle
        var newCycleMetadata = new CycleMetadata
        {
            CycleId = cycleId,
            UserId = userId.ToString(),
            StartDate = startDate,
            EndDate = endDate,
            Status = "InProgress",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Set as active
        _indexState.State.ActiveCycleId = cycleId;

        // Add to cycles list (at the beginning - most recent first)
        _indexState.State.Cycles.Insert(0, newCycleMetadata);

        // Limit to last N cycles
        if (_indexState.State.Cycles.Count > MaxCyclesInIndex)
        {
            _indexState.State.Cycles = _indexState.State.Cycles.Take(MaxCyclesInIndex).ToList();
            _logger.LogInformation("[UserCycleIndexGrain] Trimmed cycles list to {MaxCount} for user {UserId}",
                MaxCyclesInIndex, userId);
        }

        _indexState.State.UpdatedAt = DateTime.UtcNow;

        await _indexState.WriteStateAsync();

        _logger.LogInformation("[UserCycleIndexGrain] Started new cycle {CycleId} for user {UserId}. Total cycles: {Count}",
            cycleId, userId, _indexState.State.Cycles.Count);

        return true;
    }

    public Task<Guid?> GetActiveCycleId()
    {
        var userId = this.GetPrimaryKey();

        _logger.LogInformation("[UserCycleIndexGrain] GetActiveCycleId for user {UserId}. ActiveCycleId: {ActiveCycleId}",
            userId, _indexState.State!.ActiveCycleId);

        return Task.FromResult(_indexState.State.ActiveCycleId);
    }

    public async Task MarkCycleComplete(Guid cycleId)
    {
        var userId = this.GetPrimaryKey();

        _logger.LogInformation("[UserCycleIndexGrain] MarkCycleComplete for user {UserId}. CycleId: {CycleId}",
            userId, cycleId);

        // Clear active cycle if it matches
        if (_indexState.State!.ActiveCycleId == cycleId)
        {
            _indexState.State.ActiveCycleId = null;
            _logger.LogInformation("[UserCycleIndexGrain] Cleared active cycle for user {UserId}", userId);
        }

        // Update cycle status in metadata list
        var cycleMetadata = _indexState.State.Cycles.FirstOrDefault(c => c.CycleId == cycleId);
        if (cycleMetadata != null)
        {
            cycleMetadata.Status = "Completed";
            cycleMetadata.UpdatedAt = DateTime.UtcNow;
            _logger.LogInformation("[UserCycleIndexGrain] Updated cycle {CycleId} status to Completed in index", cycleId);
        }

        _indexState.State.UpdatedAt = DateTime.UtcNow;

        await _indexState.WriteStateAsync();

        _logger.LogInformation("[UserCycleIndexGrain] Cycle {CycleId} marked as completed for user {UserId}", cycleId, userId);
    }

    public Task<List<Guid>> GetRecentCycleIds(int limit)
    {
        var userId = this.GetPrimaryKey();

        var cycleIds = _indexState.State!.Cycles
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .Select(c => c.CycleId)
            .ToList();

        _logger.LogInformation("[UserCycleIndexGrain] GetRecentCycleIds for user {UserId}. Limit: {Limit}, Returned: {Count}",
            userId, limit, cycleIds.Count);

        return Task.FromResult(cycleIds);
    }

    public Task<List<CycleMetadata>> GetAllCycleMetadata()
    {
        var userId = this.GetPrimaryKey();

        var cycles = _indexState.State!.Cycles
            .OrderByDescending(c => c.CreatedAt)
            .ToList();

        _logger.LogInformation("[UserCycleIndexGrain] GetAllCycleMetadata for user {UserId}. Count: {Count}",
            userId, cycles.Count);

        return Task.FromResult(cycles);
    }
}
