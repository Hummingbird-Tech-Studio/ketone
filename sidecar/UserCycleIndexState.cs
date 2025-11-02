namespace Orleans.Sidecar;

/// <summary>
/// State for UserCycleIndexGrain - tracks all cycles for a user
/// </summary>
[GenerateSerializer]
public class UserCycleIndexState
{
    /// <summary>
    /// User ID (grain key)
    /// </summary>
    [Id(0)]
    public Guid UserId { get; set; }

    /// <summary>
    /// ID of the currently active cycle (InProgress status)
    /// Null if no active cycle
    /// </summary>
    [Id(1)]
    public Guid? ActiveCycleId { get; set; }

    /// <summary>
    /// List of all cycles for this user (metadata only)
    /// Sorted by CreatedAt descending (most recent first)
    /// Limited to last 50 cycles for performance
    /// </summary>
    [Id(2)]
    public List<CycleMetadata> Cycles { get; set; } = new();

    /// <summary>
    /// Last time this index was updated
    /// </summary>
    [Id(3)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
