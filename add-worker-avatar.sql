-- Migration: Add separate avatar for worker profiles
-- This adds avatar_url column to worker_profiles table so workers can have
-- a different photo for their worker profile vs their user profile

ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN worker_profiles.avatar_url IS 'Separate avatar for worker profile, independent from user profile avatar';
