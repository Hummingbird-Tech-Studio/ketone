using System.Text.Json;

namespace Orleans.Sidecar;

/// <summary>
/// Actor Grain implementation - stores complete XState machine snapshot from external server
/// This is SEPARATE from CycleGrain which manages cycle-specific workflows
/// </summary>
public class ActorGrain(
    [PersistentState("externalActorState", "actorState")] IPersistentState<ExternalActorState> actorState,
    ILogger<ActorGrain> logger
) : Grain, IActorGrain
{
    private readonly IPersistentState<ExternalActorState> _actorState = actorState ?? throw new ArgumentNullException(nameof(actorState));
    private readonly ILogger<ActorGrain> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    public override async Task OnActivateAsync(CancellationToken cancellationToken)
    {
        var actorId = this.GetPrimaryKeyString();

        _logger.LogInformation("[ActorGrain] OnActivateAsync for {ActorId}. RecordExists: {RecordExists}",
            actorId, _actorState.RecordExists);

        // Do NOT auto-create state - let the POST endpoint handle creation
        if (_actorState.RecordExists && _actorState.State != null)
        {
            _logger.LogInformation("[ActorGrain] Loaded EXISTING state for {ActorId}. UpdatedAt: {UpdatedAt}",
                actorId, _actorState.State.UpdatedAt);
        }
        else
        {
            _logger.LogInformation("[ActorGrain] No existing state found for {ActorId}. Waiting for POST to create.", actorId);
        }

        await base.OnActivateAsync(cancellationToken);
    }

    public Task<string?> GetStateJson()
    {
        var actorId = this.GetPrimaryKeyString();
        _logger.LogInformation("[ActorGrain] GetStateJson called for {ActorId}. RecordExists: {RecordExists}",
            actorId, _actorState.RecordExists);

        // Return null if actor doesn't exist - endpoint will handle 404
        if (!_actorState.RecordExists || _actorState.State == null || string.IsNullOrEmpty(_actorState.State.SnapshotJson))
        {
            _logger.LogInformation("[ActorGrain] No state found for {ActorId}", actorId);
            return Task.FromResult<string?>(null);
        }

        return Task.FromResult<string?>(_actorState.State.SnapshotJson);
    }

    public async Task<string> UpdateStateJson(string snapshotJson)
    {
        var actorId = this.GetPrimaryKeyString();
        _logger.LogInformation("[ActorGrain] UpdateStateJson called for {ActorId}. RecordExists: {RecordExists}",
            actorId, _actorState.RecordExists);
        _logger.LogInformation("[ActorGrain] Received snapshot JSON - ActorId: {ActorId}, Length: {Length}, Content: {Json}",
            actorId, snapshotJson?.Length ?? 0, snapshotJson ?? "null");

        // Create state if it doesn't exist (first POST creates the actor)
        if (!_actorState.RecordExists || _actorState.State == null)
        {
            _actorState.State = new ExternalActorState
            {
                ActorId = actorId,
                SnapshotJson = snapshotJson ?? string.Empty,
                UpdatedAt = DateTime.UtcNow
            };
            _logger.LogInformation("[ActorGrain] Creating NEW actor state for {ActorId}", actorId);
            _logger.LogInformation("[ActorGrain] State object created: ActorId={ActorId}, SnapshotJson.Length={Length}, UpdatedAt={UpdatedAt}",
                _actorState.State.ActorId, _actorState.State.SnapshotJson?.Length ?? 0, _actorState.State.UpdatedAt);
        }
        else
        {
            // Update existing state
            _actorState.State.SnapshotJson = snapshotJson ?? string.Empty;
            _actorState.State.UpdatedAt = DateTime.UtcNow;
            _logger.LogInformation("[ActorGrain] Updating EXISTING actor state for {ActorId}", actorId);
        }

        _logger.LogInformation("[ActorGrain] About to call WriteStateAsync for {ActorId}. State.RecordExists: {RecordExists}",
            actorId, _actorState.RecordExists);

        // Persist to Orleans storage
        await _actorState.WriteStateAsync();

        _logger.LogInformation("[ActorGrain] WriteStateAsync completed for {ActorId}. RecordExists: {RecordExists}",
            actorId, _actorState.RecordExists);
        _logger.LogInformation("[ActorGrain] State persisted successfully for {ActorId}", actorId);

        return _actorState.State?.SnapshotJson ?? string.Empty;
    }
}
