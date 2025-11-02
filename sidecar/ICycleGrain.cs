namespace Orleans.Sidecar;

/// <summary>
/// Interface for the Cycle Grain - each instance represents a single cycle
/// Keyed by cycleId (Guid) - one grain per cycle
/// </summary>
public interface ICycleGrain : IGrainWithGuidKey
{
    /// <summary>
    /// Gets the cycle's complete XState snapshot as JSON string
    /// Returns null if cycle doesn't exist
    /// </summary>
    Task<string?> GetStateJson();

    /// <summary>
    /// Saves the complete XState snapshot JSON and persists it
    /// Creates the cycle grain if it doesn't exist
    /// Returns the persisted JSON
    /// </summary>
    Task<string> UpdateStateJson(string snapshotJson);

    /// <summary>
    /// Gets cycle metadata (userId, dates, status) without loading full snapshot
    /// Used for querying and indexing
    /// </summary>
    Task<CycleMetadata?> GetMetadata();

    /// <summary>
    /// Initializes a new cycle with metadata
    /// Should be called once when creating a new cycle
    /// </summary>
    Task Initialize(string userId, DateTime startDate, DateTime endDate);

    /// <summary>
    /// Updates cycle metadata (dates and status)
    /// Called when XState machine transitions or dates are updated
    /// </summary>
    Task UpdateMetadata(DateTime startDate, DateTime endDate, string status);
}
