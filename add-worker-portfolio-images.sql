-- Migration: Add portfolio images to worker_profiles table
-- This adds portfolio_images column to store up to 4 images of past jobs with titles

-- Add portfolio_images column (stores array of JSON objects with image URL and title)
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS portfolio_images JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN worker_profiles.portfolio_images IS 'Array of portfolio items, each with image URL and job title. Max 4 items. Format: [{"image": "url", "title": "Job Title"}]';

-- Example structure:
-- [
--   {"image": "https://...", "title": "Kitchen Renovation"},
--   {"image": "https://...", "title": "Bathroom Remodel"},
--   {"image": "https://...", "title": "Deck Construction"},
--   {"image": "https://...", "title": "Painting Project"}
-- ]
