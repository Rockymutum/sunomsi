-- =====================================================
-- SUPABASE PROFILE AUTO-CREATION TRIGGER
-- =====================================================
-- This script creates a database trigger that automatically
-- creates a profile entry whenever a new user signs up.
-- 
-- HOW TO USE:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the function that will create a profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new profile for the newly created user
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    created_at,
    updated_at,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW(),
    COALESCE(NEW.raw_user_meta_data->>'role', 'poster')
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger that runs after a new user is inserted
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- After running the above, you can verify the trigger
-- was created successfully by running:
-- 
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- =====================================================

-- =====================================================
-- OPTIONAL: Create profiles for existing users
-- =====================================================
-- If you have existing users without profiles, uncomment
-- and run this to create profiles for them:
--
-- INSERT INTO public.profiles (user_id, email, full_name, created_at, updated_at)
-- SELECT 
--   id,
--   email,
--   COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
--   created_at,
--   NOW()
-- FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.profiles);
-- =====================================================
