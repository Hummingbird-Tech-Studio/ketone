namespace Orleans.Sidecar;

/// <summary>
/// Interface for the Actor Grain - manages complete XState snapshot from external server
/// This is SEPARATE from CycleGrain which manages cycle-specific state machine
/// </summary>
public interface IActorGrain : IGrainWithStringKey
{
    /// <summary>
    /// Gets the actor's complete XState snapshot as JSON string
    /// Returns null if actor doesn't exist
    /// </summary>
    Task<string?> GetStateJson();

    /// <summary>
    /// Saves the complete XState snapshot JSON and persists it
    /// Creates the actor if it doesn't exist
    /// Returns the persisted JSON
    /// </summary>
    Task<string> UpdateStateJson(string snapshotJson);
}
