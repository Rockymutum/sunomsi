import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SunomsiDB extends DBSchema {
    tasks: {
        key: string;
        value: {
            id: string;
            data: any;
            timestamp: number;
        };
    };
    workers: {
        key: string;
        value: {
            id: string;
            data: any;
            timestamp: number;
        };
    };
    profiles: {
        key: string;
        value: {
            id: string;
            data: any;
            timestamp: number;
        };
    };
    messages: {
        key: string;
        value: {
            id: string;
            data: any;
            timestamp: number;
        };
    };
}

type StoreName = 'tasks' | 'workers' | 'profiles' | 'messages';

const DB_NAME = 'sunomsi-cache';
const DB_VERSION = 1;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class CacheManager {
    private db: IDBPDatabase<SunomsiDB> | null = null;
    private memoryCache: Map<string, { data: any; timestamp: number }> = new Map();

    async init() {
        if (this.db) return this.db;

        try {
            this.db = await openDB<SunomsiDB>(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    // Create object stores
                    if (!db.objectStoreNames.contains('tasks')) {
                        db.createObjectStore('tasks', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('workers')) {
                        db.createObjectStore('workers', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('profiles')) {
                        db.createObjectStore('profiles', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('messages')) {
                        db.createObjectStore('messages', { keyPath: 'id' });
                    }
                },
            });
            return this.db;
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
            return null;
        }
    }

    // Memory cache operations (for hot data)
    setMemory(key: string, data: any) {
        this.memoryCache.set(key, { data, timestamp: Date.now() });
    }

    getMemory(key: string, ttl: number = CACHE_TTL): any | null {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > ttl) {
            this.memoryCache.delete(key);
            return null;
        }

        return cached.data;
    }

    clearMemory() {
        this.memoryCache.clear();
    }

    // IndexedDB operations
    async set(storeName: StoreName, id: string, data: any) {
        await this.init();
        if (!this.db) return;

        try {
            await this.db.put(storeName, {
                id,
                data,
                timestamp: Date.now(),
            });

            // Also cache in memory for instant access
            this.setMemory(`${storeName}:${id}`, data);
        } catch (error) {
            console.error(`Failed to cache ${storeName}:`, error);
        }
    }

    async get(storeName: StoreName, id: string, ttl: number = CACHE_TTL): Promise<any | null> {
        // Check memory cache first
        const memCached = this.getMemory(`${storeName}:${id}`, ttl);
        if (memCached) return memCached;

        await this.init();
        if (!this.db) return null;

        try {
            const cached = await this.db.get(storeName, id);
            if (!cached) return null;

            // Check if expired
            if (Date.now() - cached.timestamp > ttl) {
                await this.db.delete(storeName, id);
                return null;
            }

            // Update memory cache
            this.setMemory(`${storeName}:${id}`, cached.data);
            return cached.data;
        } catch (error) {
            console.error(`Failed to get ${storeName}:`, error);
            return null;
        }
    }

    async getAll(storeName: StoreName, ttl: number = CACHE_TTL): Promise<any[]> {
        await this.init();
        if (!this.db) return [];

        try {
            const all = await this.db.getAll(storeName);
            const valid = all.filter((item) => Date.now() - item.timestamp <= ttl);
            return valid.map((item) => item.data);
        } catch (error) {
            console.error(`Failed to get all ${storeName}:`, error);
            return [];
        }
    }

    async setAll(storeName: StoreName, items: any[], idKey: string = 'id') {
        await this.init();
        if (!this.db) return;

        try {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            await Promise.all(
                items.map((item) =>
                    store.put({
                        id: item[idKey],
                        data: item,
                        timestamp: Date.now(),
                    })
                )
            );

            await tx.done;
        } catch (error) {
            console.error(`Failed to cache all ${storeName}:`, error);
        }
    }

    async delete(storeName: StoreName, id: string) {
        await this.init();
        if (!this.db) return;

        try {
            await this.db.delete(storeName, id);
            this.memoryCache.delete(`${storeName}:${id}`);
        } catch (error) {
            console.error(`Failed to delete ${storeName}:`, error);
        }
    }

    async clear(storeName: StoreName) {
        await this.init();
        if (!this.db) return;

        try {
            await this.db.clear(storeName);

            // Clear related memory cache entries
            for (const key of this.memoryCache.keys()) {
                if (key.startsWith(`${storeName}:`)) {
                    this.memoryCache.delete(key);
                }
            }
        } catch (error) {
            console.error(`Failed to clear ${storeName}:`, error);
        }
    }

    async clearAll() {
        await this.init();
        if (!this.db) return;

        try {
            await Promise.all([
                this.db.clear('tasks'),
                this.db.clear('workers'),
                this.db.clear('profiles'),
                this.db.clear('messages'),
            ]);
            this.clearMemory();
        } catch (error) {
            console.error('Failed to clear all caches:', error);
        }
    }
}

export const cacheManager = new CacheManager();
