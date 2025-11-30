import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';

interface Profile {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    phone: string | null;
    location: string | null;
    updated_at?: string;
}

interface CachedData {
    tasks: any[];
    workers: any[];
    profiles: Record<string, Profile>;
    messages: any[];
    notifications: any[];
    lastFetch: Record<string, number>;
}

interface AppState {
    // Auth state
    user: User | null;
    profile: Profile | null;
    isAuthLoading: boolean;
    isAuthHydrated: boolean;

    // Cached data
    cachedData: CachedData;

    // Actions
    setUser: (user: User | null) => void;
    setProfile: (profile: Profile | null) => void;
    setAuthLoading: (loading: boolean) => void;
    setAuthHydrated: (hydrated: boolean) => void;

    // Cache actions
    setCachedTasks: (tasks: any[]) => void;
    setCachedWorkers: (workers: any[]) => void;
    setCachedProfile: (userId: string, profile: Profile) => void;
    setCachedMessages: (messages: any[]) => void;
    setCachedNotifications: (notifications: any[]) => void;
    updateLastFetch: (key: string) => void;

    // Cache getters
    getCachedTasks: () => any[];
    getCachedWorkers: () => any[];
    getCachedProfile: (userId: string) => Profile | null;
    isCacheValid: (key: string, ttlMs?: number) => boolean;

    // Clear cache
    clearCache: () => void;
    clearAuth: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            profile: null,
            isAuthLoading: true,
            isAuthHydrated: false,

            cachedData: {
                tasks: [],
                workers: [],
                profiles: {},
                messages: [],
                notifications: [],
                lastFetch: {},
            },

            // Auth actions
            setUser: (user) => set({ user }),
            setProfile: (profile) => set({ profile }),
            setAuthLoading: (loading) => set({ isAuthLoading: loading }),
            setAuthHydrated: (hydrated) => set({ isAuthHydrated: hydrated }),

            // Cache actions
            setCachedTasks: (tasks) =>
                set((state) => ({
                    cachedData: { ...state.cachedData, tasks },
                })),

            setCachedWorkers: (workers) =>
                set((state) => ({
                    cachedData: { ...state.cachedData, workers },
                })),

            setCachedProfile: (userId, profile) =>
                set((state) => ({
                    cachedData: {
                        ...state.cachedData,
                        profiles: { ...state.cachedData.profiles, [userId]: profile },
                    },
                })),

            setCachedMessages: (messages) =>
                set((state) => ({
                    cachedData: { ...state.cachedData, messages },
                })),

            setCachedNotifications: (notifications) =>
                set((state) => ({
                    cachedData: { ...state.cachedData, notifications },
                })),

            updateLastFetch: (key) =>
                set((state) => ({
                    cachedData: {
                        ...state.cachedData,
                        lastFetch: { ...state.cachedData.lastFetch, [key]: Date.now() },
                    },
                })),

            // Cache getters
            getCachedTasks: () => get().cachedData.tasks,
            getCachedWorkers: () => get().cachedData.workers,
            getCachedProfile: (userId) => get().cachedData.profiles[userId] || null,

            isCacheValid: (key, ttlMs = CACHE_TTL) => {
                const lastFetch = get().cachedData.lastFetch[key];
                if (!lastFetch) return false;
                return Date.now() - lastFetch < ttlMs;
            },

            // Clear functions
            clearCache: () =>
                set({
                    cachedData: {
                        tasks: [],
                        workers: [],
                        profiles: {},
                        messages: [],
                        notifications: [],
                        lastFetch: {},
                    },
                }),

            clearAuth: () =>
                set({
                    user: null,
                    profile: null,
                    isAuthLoading: false,
                }),
        }),
        {
            name: 'sunomsi-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
                profile: state.profile,
                cachedData: state.cachedData,
            }),
        }
    )
);
