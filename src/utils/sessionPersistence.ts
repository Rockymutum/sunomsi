"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export class SessionManager {
  private static instance: SessionManager;
  private supabase = createClientComponentClient();
  private listeners: ((user: any) => void)[] = [];

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async getCurrentUser() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session?.user ?? null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  subscribe(callback: (user: any) => void) {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners(user: any) {
    this.listeners.forEach(listener => listener(user));
  }

  initialize() {
    // Set up auth state listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.notifyListeners(session?.user ?? null);
    });
  }
}

// Initialize the session manager
export const sessionManager = SessionManager.getInstance();