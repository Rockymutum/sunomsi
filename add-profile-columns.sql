-- Migration: Add missing columns to profiles table
-- This adds phone, email, bio, and skills columns to support the profile page functionality

-- Add phone column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add email column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Add bio column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add skills column (array of text)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Update existing profiles to populate email from auth.users if needed
-- This is a one-time update for existing records
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.user_id = auth.users.id
  AND profiles.email IS NULL;
