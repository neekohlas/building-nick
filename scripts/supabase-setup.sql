-- Supabase Setup Script for Building Nick Habit Tracking App
-- Run this in the Supabase SQL Editor to set up the required tables

-- ============================================
-- COMPLETIONS TABLE
-- Stores activity completion records
-- ============================================
CREATE TABLE IF NOT EXISTS public.completions (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  activity_id TEXT NOT NULL,
  time_block TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ============================================
-- SCHEDULES TABLE
-- Stores daily activity schedules
-- ============================================
CREATE TABLE IF NOT EXISTS public.schedules (
  date DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activities JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- ============================================
-- SAVED PLAN CONFIGS TABLE
-- Stores weekly planning configurations
-- ============================================
CREATE TABLE IF NOT EXISTS public.saved_plan_configs (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  selected_activities TEXT[],
  frequencies JSONB,
  heavy_day_schedule JSONB,
  light_day_schedule JSONB,
  start_with_heavy BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ============================================
-- REMINDERS TABLE
-- Stores synced Apple Reminders
-- ============================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id TEXT NOT NULL,                    -- Composite ID: title|dueDate from iOS Shortcuts
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_all_day BOOLEAN DEFAULT false,
  completed_in_app BOOLEAN DEFAULT false,  -- Track if completed within the habit app
  synced_at TIMESTAMPTZ NOT NULL,          -- When this reminder was last synced from iOS
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON public.completions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_user_date ON public.schedules(user_id, date);
CREATE INDEX IF NOT EXISTS idx_completions_updated ON public.completions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_schedules_updated ON public.schedules(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_date ON public.reminders(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_updated ON public.reminders(user_id, updated_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own data
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_plan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users access own completions" ON public.completions;
DROP POLICY IF EXISTS "Users access own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users access own configs" ON public.saved_plan_configs;
DROP POLICY IF EXISTS "Users access own reminders" ON public.reminders;

-- Create policies
CREATE POLICY "Users access own completions" ON public.completions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own schedules" ON public.schedules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own configs" ON public.saved_plan_configs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own reminders" ON public.reminders
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER TO AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_completions_updated_at ON public.completions;
DROP TRIGGER IF EXISTS update_schedules_updated_at ON public.schedules;
DROP TRIGGER IF EXISTS update_saved_plan_configs_updated_at ON public.saved_plan_configs;
DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;

-- Create triggers
CREATE TRIGGER update_completions_updated_at
  BEFORE UPDATE ON public.completions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_plan_configs_updated_at
  BEFORE UPDATE ON public.saved_plan_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERY
-- Run this to verify tables were created
-- ============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('completions', 'schedules', 'saved_plan_configs', 'reminders');
