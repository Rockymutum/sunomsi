-- Migration: Add missing display columns to profiles table
-- This adds place, title, and contact columns that are used by the profile view page

-- Add place column (location/city)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS place TEXT;

-- Add title column (professional title)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- Add contact column (contact information, can include social links)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.place IS 'User location or city';
COMMENT ON COLUMN profiles.title IS 'Professional title or role';
COMMENT ON COLUMN profiles.contact IS 'Contact information including social media links';
