-- Migration: Add mood_entries table for emotion tracking
-- Stores daily mood check-ins from the Health Coach modal

-- ============================================
-- MOOD ENTRIES TABLE
-- One entry per day per user
-- ============================================
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id TEXT NOT NULL,                    -- Format: mood_${date}
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,              -- e.g. 'energized', 'calm', 'stressed', 'down', 'meh'
  emotion TEXT,                        -- e.g. 'hopeful', 'anxious', 'exhausted'
  notes TEXT,                          -- Free-text notes about how user is feeling
  saved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON public.mood_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mood_entries_updated ON public.mood_entries(user_id, updated_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own mood entries" ON public.mood_entries;

CREATE POLICY "Users access own mood entries" ON public.mood_entries
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- AUTO-UPDATE TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS update_mood_entries_updated_at ON public.mood_entries;

CREATE TRIGGER update_mood_entries_updated_at
  BEFORE UPDATE ON public.mood_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
