-- Create tables for SUNOMSI application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('poster', 'worker')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create worker profiles table
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  skills TEXT[] DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0,
  availability TEXT[] DEFAULT '{}',
  location TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure title column exists for existing deployments
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget DECIMAL(10,2),
  location TEXT NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  poster_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'completed')),
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table for chat system
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies

-- Profiles: Users can read all profiles but only update their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove all existing SELECT policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- Add a single, broad SELECT policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Keep existing INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Remove the handle_new_user function and its trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Keep other tables' RLS and functions as they are not directly related to the current issue
-- Messages: Users can only see messages they sent or received
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view messages where they are either sender or receiver
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- Policy to allow users to insert messages where they are the sender
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Policy to allow users to update read status of messages they received
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Notes: Users can only access their own notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own notes" ON notes;
CREATE POLICY "Users can create their own notes"
  ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE USING (auth.uid() = user_id);

-- Worker Profiles: Similar to profiles
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Worker profiles are viewable by everyone" ON worker_profiles;
CREATE POLICY "Worker profiles are viewable by everyone"
  ON worker_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Workers can insert their own profile" ON worker_profiles;
CREATE POLICY "Workers can insert their own profile"
  ON worker_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workers can update their own profile" ON worker_profiles;
CREATE POLICY "Workers can update their own profile"
  ON worker_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Tasks: Everyone can view tasks, only posters can create and update their own tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tasks are viewable by everyone" ON tasks;
CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Posters can create tasks" ON tasks;
CREATE POLICY "Posters can create tasks"
  ON tasks FOR INSERT WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Posters can update their own tasks" ON tasks;
CREATE POLICY "Posters can update their own tasks"
  ON tasks FOR UPDATE USING (auth.uid() = poster_id);

-- Applications: Workers can create applications, posters can view applications for their tasks
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can create applications" ON applications;
CREATE POLICY "Workers can create applications"
  ON applications FOR INSERT WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Workers can view their own applications" ON applications;
CREATE POLICY "Workers can view their own applications"
  ON applications FOR SELECT USING (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Posters can view applications for their tasks" ON applications;
CREATE POLICY "Posters can view applications for their tasks"
  ON applications FOR SELECT USING (
    auth.uid() IN (
      SELECT poster_id FROM tasks WHERE id = applications.task_id
    )
  );

-- Reviews: Everyone can view reviews, only task participants can create reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Task participants can create reviews" ON reviews;
CREATE POLICY "Task participants can create reviews"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    (
      auth.uid() IN (
        SELECT poster_id FROM tasks WHERE id = reviews.task_id
      ) OR
      auth.uid() IN (
        SELECT worker_id FROM applications
        WHERE task_id = reviews.task_id AND status = 'accepted'
      )
    )
  );

-- Messages: Only participants can view their messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications: Users can only view their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

-- Function to create worker profile when a user selects worker role
CREATE OR REPLACE FUNCTION create_worker_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'worker' THEN
    INSERT INTO worker_profiles (user_id)
    VALUES (NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create worker profile
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE create_worker_profile();

-- Function to create notification when application is created
CREATE OR REPLACE FUNCTION create_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  poster_id UUID;
BEGIN
  SELECT title, tasks.poster_id INTO task_title, poster_id
  FROM tasks
  WHERE id = NEW.task_id;
  
  INSERT INTO notifications (user_id, type, content, related_id)
  VALUES (
    poster_id,
    'application',
    'New application received for task: ' || task_title,
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for application notifications
DROP TRIGGER IF EXISTS on_application_created ON applications;
CREATE TRIGGER on_application_created
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE PROCEDURE create_application_notification();

-- Function to create notification when application status changes
CREATE OR REPLACE FUNCTION update_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
BEGIN
  SELECT title INTO task_title
  FROM tasks
  WHERE id = NEW.task_id;
  
  IF NEW.status != OLD.status THEN
    INSERT INTO notifications (user_id, type, content, related_id)
    VALUES (
      NEW.worker_id,
      'application_update',
      'Your application for task: ' || task_title || ' is now ' || NEW.status,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for application status change notifications
DROP TRIGGER IF EXISTS on_application_updated ON applications;
CREATE TRIGGER on_application_updated
  AFTER UPDATE ON applications
  FOR EACH ROW
  EXECUTE PROCEDURE update_application_notification();
-- Create a bucket for task images
INSERT INTO storage.buckets (id, name, public)
VALUES ('task_images', 'task_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow all users to upload files to the 'task_images' bucket
DROP POLICY IF EXISTS "Allow all uploads to task_images" ON storage.objects;
CREATE POLICY "Allow all uploads to task_images"
ON storage.objects FOR INSERT
TO authenticated, service_role
WITH CHECK (bucket_id = 'task_images');

-- Allow all users to view files in the 'task_images' bucket
DROP POLICY IF EXISTS "Allow all views of task_images" ON storage.objects;
CREATE POLICY "Allow all views of task_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'task_images');

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for avatars bucket
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
CREATE POLICY "Authenticated upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Optional: allow authenticated update/delete
DROP POLICY IF EXISTS "Authenticated update avatars" ON storage.objects;
CREATE POLICY "Authenticated update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated delete avatars" ON storage.objects;
CREATE POLICY "Authenticated delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');