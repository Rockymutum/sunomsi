import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Global memory - persists across component mounts for 30 minutes
let sessionMemory: {
  session: any;
  timestamp: number;
} | null = null;

let isCheckingSession = false;
const SESSION_MEMORY_DURATION = 30 * 60 * 1000; // 30 minutes

export function useSessionRecovery() {
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    // If we have recent session memory (within 30 minutes), use it immediately
    if (sessionMemory && (Date.now() - sessionMemory.timestamp) < SESSION_MEMORY_DURATION) {
      console.log('Using session from memory (30 min cache)');
      setNeedsRefresh(false);
      return;
    }

    // If memory is expired, clear it
    if (sessionMemory && (Date.now() - sessionMemory.timestamp) >= SESSION_MEMORY_DURATION) {
      console.log('Session memory expired, clearing cache');
      sessionMemory = null;
    }

    // Prevent multiple simultaneous checks
    if (isCheckingSession) return;
    isCheckingSession = true;

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error && (error.message?.includes('JWT expired') || error.code === 'PGRST303')) {
          console.log('Session expired, needs refresh');
          setNeedsRefresh(true);
          sessionMemory = null;
        } else if (session) {
          // Store session in memory for 30 minutes
          sessionMemory = {
            session,
            timestamp: Date.now()
          };
          setNeedsRefresh(false);
          console.log('Session stored in memory for 30 minutes');
        } else {
          sessionMemory = null;
          setNeedsRefresh(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        sessionMemory = null;
      } finally {
        isCheckingSession = false;
      }
    };

    checkSession();

    // Only listen for critical auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        // Only handle these critical events
        if (event === 'TOKEN_REFRESHED' && session) {
          sessionMemory = {
            session,
            timestamp: Date.now()
          };
          setNeedsRefresh(false);
          console.log('Token refreshed, memory updated for 30 minutes');
        } else if (event === 'SIGNED_IN' && session) {
          sessionMemory = {
            session,
            timestamp: Date.now()
          };
          setNeedsRefresh(false);
          console.log('Signed in, memory set for 30 minutes');
        } else if (event === 'SIGNED_OUT') {
          sessionMemory = null;
          setNeedsRefresh(false);
          console.log('Signed out, memory cleared');
        }
        // Ignore INITIAL_SESSION, USER_UPDATED
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const refreshSession = async () => {
    try {
      console.log('Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      // Update memory for another 30 minutes
      sessionMemory = {
        session,
        timestamp: Date.now()
      };
      setNeedsRefresh(false);
      console.log('Session refreshed successfully, memory extended for 30 minutes');
      return session;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      sessionMemory = null;
      setNeedsRefresh(false);
      throw error;
    }
  };

  return { needsRefresh, refreshSession };
}