-- Create OrleansQuery table if it doesn't exist
CREATE TABLE IF NOT EXISTS OrleansQuery
(
    QueryKey VARCHAR(64) NOT NULL,
    QueryText VARCHAR(8000) NOT NULL,
    CONSTRAINT OrleansQuery_Key PRIMARY KEY(QueryKey)
);
