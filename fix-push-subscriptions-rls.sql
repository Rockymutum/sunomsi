-- Fix RLS policies for push_subscriptions
-- This ensures users can insert and update their own subscriptions

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON push_subscriptions;

-- Create comprehensive policies
CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Verify table structure (optional, just to be safe)
COMMENT ON TABLE push_subscriptions IS 'Stores user push notification subscriptions';
