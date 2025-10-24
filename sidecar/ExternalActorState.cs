using System.Text.Json;

namespace Orleans.Sidecar;

/// <summary>
/// Actor state for external actor management
/// Stores the complete XState machine snapshot as JSON
/// This is DIFFERENT from CycleGrain's ActorState
/// </summary>
[GenerateSerializer]
public class ExternalActorState
{
    /// <summary>
    /// Actor ID (grain key)
    /// </summary>
    [Id(0)]
    public string ActorId { get; set; } = string.Empty;

    /// <summary>
    /// Complete XState snapshot stored as JSON string
    /// Contains value, context, status, output, historyValue, etc.
    /// </summary>
    [Id(1)]
    public string SnapshotJson { get; set; } = string.Empty;

    /// <summary>
    /// Last time the actor state was updated
    /// </summary>
    [Id(2)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
