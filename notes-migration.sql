-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Row Level Security for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Users can read and modify only their own notes
CREATE POLICY "Users can view their own notes" 
  ON notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" 
  ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
  ON notes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
  ON notes FOR DELETE USING (auth.uid() = user_id);