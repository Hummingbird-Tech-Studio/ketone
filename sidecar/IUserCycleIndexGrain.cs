namespace Orleans.Sidecar;

/// <summary>
/// Interface for UserCycleIndexGrain - coordinates all cycles for a single user
/// Keyed by userId (Guid) - one grain per user
/// Enforces "only 1 active cycle" business rule
/// </summary>
public interface IUserCycleIndexGrain : IGrainWithGuidKey
{
    /// <summary>
    /// Attempts to start a new cycle for this user
    /// Returns false if user already has an active cycle (InProgress status)
    /// Returns true if cycle was registered successfully
    /// </summary>
    Task<bool> TryStartNewCycle(Guid cycleId, DateTime startDate, DateTime endDate);

    /// <summary>
    /// Gets the ID of the user's currently active cycle (InProgress status)
    /// Returns null if no active cycle exists
    /// </summary>
    Task<Guid?> GetActiveCycleId();

    /// <summary>
    /// Marks a cycle as completed
    /// Clears the active cycle ID if it matches
    /// </summary>
    Task MarkCycleComplete(Guid cycleId);

    /// <summary>
    /// Gets the most recent N cycle IDs for this user (sorted by createdAt DESC)
    /// </summary>
    Task<List<Guid>> GetRecentCycleIds(int limit);

    /// <summary>
    /// Gets all cycle metadata for this user (sorted by createdAt DESC)
    /// Limited to last 50 cycles for performance
    /// </summary>
    Task<List<CycleMetadata>> GetAllCycleMetadata();
}
