namespace Orleans.Sidecar;

/// <summary>
/// State for CycleGrain - stores XState snapshot + metadata for a single cycle
/// </summary>
[GenerateSerializer]
public class CycleState
{
    /// <summary>
    /// Cycle ID (grain key as Guid)
    /// </summary>
    [Id(0)]
    public Guid CycleId { get; set; }

    /// <summary>
    /// User ID who owns this cycle
    /// </summary>
    [Id(1)]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Complete XState snapshot stored as JSON string
    /// Contains value, context, status, output, historyValue, etc.
    /// </summary>
    [Id(2)]
    public string SnapshotJson { get; set; } = string.Empty;

    /// <summary>
    /// Cycle start date (denormalized from snapshot for querying)
    /// </summary>
    [Id(3)]
    public DateTime StartDate { get; set; }

    /// <summary>
    /// Cycle end date (denormalized from snapshot for querying)
    /// </summary>
    [Id(4)]
    public DateTime EndDate { get; set; }

    /// <summary>
    /// Cycle status: "InProgress" or "Completed" (denormalized for querying)
    /// </summary>
    [Id(5)]
    public string Status { get; set; } = "InProgress";

    /// <summary>
    /// When this cycle was created
    /// </summary>
    [Id(6)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last time the cycle state was updated
    /// </summary>
    [Id(7)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Lightweight metadata for cycle (used for indexing and queries)
/// </summary>
[GenerateSerializer]
public class CycleMetadata
{
    [Id(0)]
    public Guid CycleId { get; set; }

    [Id(1)]
    public string UserId { get; set; } = string.Empty;

    [Id(2)]
    public DateTime StartDate { get; set; }

    [Id(3)]
    public DateTime EndDate { get; set; }

    [Id(4)]
    public string Status { get; set; } = string.Empty;

    [Id(5)]
    public DateTime CreatedAt { get; set; }

    [Id(6)]
    public DateTime UpdatedAt { get; set; }
}
