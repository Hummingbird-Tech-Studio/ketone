-- Delete existing queries if any
DELETE FROM OrleansQuery;

-- Insert the required queries for Orleans storage
INSERT INTO OrleansQuery(QueryKey, QueryText)
VALUES
(
    'WriteToStorageKey',
    'select * from WriteToStorage(@GrainIdHash, @GrainIdN0, @GrainIdN1, @GrainTypeHash, @GrainTypeString, @GrainIdExtensionString, @ServiceId, @GrainStateVersion, @PayloadBinary);'
);

INSERT INTO OrleansQuery(QueryKey, QueryText)
VALUES
(
    'ReadFromStorageKey',
    'SELECT PayloadBinary, (now() at time zone ''utc''), Version FROM OrleansStorage WHERE GrainIdHash = @GrainIdHash AND GrainTypeHash = @GrainTypeHash AND @GrainTypeHash IS NOT NULL AND GrainIdN0 = @GrainIdN0 AND @GrainIdN0 IS NOT NULL AND GrainIdN1 = @GrainIdN1 AND @GrainIdN1 IS NOT NULL AND GrainTypeString = @GrainTypeString AND GrainTypeString IS NOT NULL AND ((@GrainIdExtensionString IS NOT NULL AND GrainIdExtensionString IS NOT NULL AND GrainIdExtensionString = @GrainIdExtensionString) OR @GrainIdExtensionString IS NULL AND GrainIdExtensionString IS NULL) AND ServiceId = @ServiceId AND @ServiceId IS NOT NULL'
);

INSERT INTO OrleansQuery(QueryKey, QueryText)
VALUES
(
    'ClearStorageKey',
    'UPDATE OrleansStorage SET PayloadBinary = NULL, Version = Version + 1 WHERE GrainIdHash = @GrainIdHash AND @GrainIdHash IS NOT NULL AND GrainTypeHash = @GrainTypeHash AND @GrainTypeHash IS NOT NULL AND GrainIdN0 = @GrainIdN0 AND @GrainIdN0 IS NOT NULL AND GrainIdN1 = @GrainIdN1 AND @GrainIdN1 IS NOT NULL AND GrainTypeString = @GrainTypeString AND @GrainTypeString IS NOT NULL AND ((@GrainIdExtensionString IS NOT NULL AND GrainIdExtensionString IS NOT NULL AND GrainIdExtensionString = @GrainIdExtensionString) OR @GrainIdExtensionString IS NULL AND GrainIdExtensionString IS NULL) AND ServiceId = @ServiceId AND @ServiceId IS NOT NULL AND Version IS NOT NULL AND Version = @GrainStateVersion AND @GrainStateVersion IS NOT NULL Returning Version as NewGrainStateVersion'
);
