-- NO-OP MIGRATION
-- This migration was made redundant by 0011_add_advisory_lock_to_exclusion_trigger.sql
-- which already defines check_plan_cycle_mutual_exclusion() with the correct implementation.
--
-- Originally this migration attempted to fix enum comparison issues, but 0011 was updated
-- to include those fixes. This file is kept as a no-op to maintain migration history
-- compatibility with environments where it was already applied.
--
-- The canonical definition of check_plan_cycle_mutual_exclusion() is in migration 0011.
SELECT 1;
