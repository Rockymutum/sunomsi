import { createClient } from '@supabase/supabase-js';

// These environment variables need to be set in a .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'poster' | 'worker';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  location: string;
  deadline: string;
  poster_id: string;
  created_at: string;
  status: 'open' | 'assigned' | 'completed';
  images?: string[];
  poster?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  skills: string[];
  rating: number;
  availability: string[];
  location: string;
  bio: string;
  title?: string;
}

export interface Application {
  id: string;
  task_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
}

export async function getNotes(userId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
  
  return data || [];
}

export async function createNote(userId: string, title: string, content: string) {
  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, content, user_id: userId }])
    .select();
    
  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }
  
  return data?.[0];
}

export async function updateNote(noteId: string, title: string, content: string) {
  const { data, error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', noteId)
    .select();
    
  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }
  
  return data?.[0];
}

export async function deleteNote(noteId: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);
    
  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
  
  return true;
}

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
  created_at: string;
}