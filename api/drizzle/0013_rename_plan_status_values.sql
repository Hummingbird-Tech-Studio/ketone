-- Rename plan_status enum values to match cycle_status pattern
-- Changes: 'active' -> 'InProgress', 'completed' -> 'Completed', 'cancelled' -> 'Cancelled'

-- Update the partial unique index first (it references 'active')
DROP INDEX IF EXISTS idx_plans_user_active;

-- Rename enum values
ALTER TYPE plan_status RENAME VALUE 'active' TO 'InProgress';
ALTER TYPE plan_status RENAME VALUE 'completed' TO 'Completed';
ALTER TYPE plan_status RENAME VALUE 'cancelled' TO 'Cancelled';

-- Recreate the partial unique index with new value
CREATE UNIQUE INDEX idx_plans_user_active ON plans (user_id) WHERE status = 'InProgress';

-- Update the trigger function to use the new status values
CREATE OR REPLACE FUNCTION check_plan_cycle_mutual_exclusion()
RETURNS TRIGGER AS $$
BEGIN
  -- Acquire advisory lock to serialize concurrent plan/cycle creation for the same user
  -- This prevents write-skew where both transactions pass the EXISTS check before either commits
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- When inserting/updating a plan to 'InProgress' status
  -- Cast status to text to avoid enum validation at parse time
  IF TG_TABLE_NAME = 'plans' AND NEW.status::text = 'InProgress' THEN
    IF EXISTS (
      SELECT 1
      FROM cycles
      WHERE user_id = NEW.user_id
        AND status = 'InProgress'
    ) THEN
      RAISE EXCEPTION 'Cannot have both an active plan and an active cycle'
        USING ERRCODE = '23P01',
              HINT = 'A user cannot have both an active plan and an active cycle at the same time. Complete or cancel your current cycle before creating a plan.';
    END IF;
  END IF;

  -- When inserting/updating a cycle to 'InProgress' status
  -- Cast status to text to avoid enum validation at parse time
  IF TG_TABLE_NAME = 'cycles' AND NEW.status::text = 'InProgress' THEN
    IF EXISTS (
      SELECT 1
      FROM plans
      WHERE user_id = NEW.user_id
        AND status = 'InProgress'
    ) THEN
      RAISE EXCEPTION 'Cannot have both an active cycle and an active plan'
        USING ERRCODE = '23P01',
              HINT = 'A user cannot have both an active cycle and an active plan at the same time. Complete or cancel your current plan before creating a cycle.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
