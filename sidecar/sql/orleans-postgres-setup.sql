-- Orleans PostgreSQL Persistence Script
-- =============================================
-- This is the OFFICIAL script from Microsoft Orleans GitHub repository
-- Source: https://github.com/dotnet/orleans/tree/main/src/AdoNet/Orleans.Persistence.AdoNet/PostgreSQL-Persistence.sql
-- 
-- Run this script in your Neon PostgreSQL database to create the required tables and functions
-- for Orleans grain state persistence.
-- =============================================

-- Download and use the official script:
-- curl -s https://raw.githubusercontent.com/dotnet/orleans/main/src/AdoNet/Orleans.Persistence.AdoNet/PostgreSQL-Persistence.sql

-- IMPORTANT: Do NOT use custom table schemas!
-- Orleans expects specific table structure and stored procedures.
-- Always use the official scripts from Microsoft.

-- To apply this script:
-- 1. Connect to your Neon PostgreSQL database
-- 2. Copy and paste the contents of orleans-postgres-persistence-official.sql
-- 3. Execute the complete script

-- Verify the tables were created (run after executing the official script):
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orleansstorage'
ORDER BY ordinal_position;