"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import TaskCard from '@/components/tasks/TaskCard';
import { Task } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Toast from '@/components/ui/Toast';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useAppStore } from '@/store/store';
import { cacheManager } from '@/lib/cache';
import { useImagePreloader } from '@/hooks/useImagePreloader';

export default function DiscoveryPage() {
  const supabase = createClientComponentClient();

  // Use Zustand store for caching
  const cachedTasks = useAppStore((state) => state.getCachedTasks());
  const setCachedTasks = useAppStore((state) => state.setCachedTasks);
  const isCacheValid = useAppStore((state) => state.isCacheValid);
  const updateLastFetch = useAppStore((state) => state.updateLastFetch);

  const [tasks, setTasks] = useState<any[]>(cachedTasks);
  const [isInitialLoad, setIsInitialLoad] = useState(cachedTasks.length === 0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);


  // Fetch tasks with caching - instant display from cache
  useEffect(() => {
    const fetchTasks = async () => {
      // If we have valid cached data, use it immediately (no loading state)
      if (isCacheValid('tasks') && cachedTasks.length > 0) {
        setTasks(cachedTasks);
        setIsInitialLoad(false);
        return;
      }

      // Only show loading if we have no cached data at all
      if (cachedTasks.length === 0) {
        setIsInitialLoad(true);
      }

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const tasksData = data || [];

        // Fetch profiles for task posters
        const posterIds = Array.from(new Set(tasksData.map((t: any) => t.poster_id).filter(Boolean)));
        let profilesMap: Record<string, any> = {};

        if (posterIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', posterIds);
          profilesMap = (profiles || []).reduce((acc: any, p: any) => {
            acc[p.user_id] = p;
            return acc;
          }, {} as Record<string, any>);
        }

        const enriched = tasksData.map((t: any) => ({ ...t, poster: profilesMap[t.poster_id] || null }));

        // Update cache
        setTasks(enriched);
        setCachedTasks(enriched);
        updateLastFetch('tasks');

        // Cache in IndexedDB
        await cacheManager.setAll('tasks', enriched);
      } catch (error: any) {
        console.error('Error fetching tasks:', error);
        setFetchError(error.message || 'Failed to load tasks');
      } finally {
        setIsInitialLoad(false);
      }
    };

    fetchTasks();
  }, [supabase, isCacheValid, setCachedTasks, updateLastFetch]);


  // Scroll restoration - restore after tasks are loaded
  useEffect(() => {
    if (!isInitialLoad && tasks.length > 0) {
      // Use requestAnimationFrame for smooth restoration
      requestAnimationFrame(() => {
        const savedPosition = sessionStorage.getItem('discovery-scroll');
        if (savedPosition) {
          const scrollY = parseInt(savedPosition, 10);
          console.log('[Scroll] Restoring position:', scrollY);
          window.scrollTo({
            top: scrollY,
            behavior: 'instant' as ScrollBehavior,
          });
        }
      });
    }
  }, [isInitialLoad, tasks.length]);

  // Save scroll position with throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollY = window.scrollY;
        sessionStorage.setItem('discovery-scroll', scrollY.toString());
        console.log('[Scroll] Saved position:', scrollY);
      }, 150); // Throttle to 150ms
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Realtime sync for tasks
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload: any) => {
        (async () => {
          let poster: any = null;
          if (payload?.new?.poster_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('user_id, full_name, avatar_url')
              .eq('user_id', payload.new.poster_id)
              .maybeSingle();
            poster = prof || null;
          }
          const withPoster = { ...payload.new, poster };
          setTasks((prev) => {
            const next = [withPoster, ...prev.filter((t: any) => t.id !== payload.new.id)];
            next.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Update cache with computed value
            setCachedTasks(next);
            return next;
          });
        })();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload: any) => {
        setTasks((prev) => {
          const updated = prev.map((t: any) => (t.id === payload.new.id ? { ...t, ...payload.new } : t));
          setCachedTasks(updated);
          return updated;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload: any) => {
        setTasks((prev) => {
          const filtered = prev.filter((t: any) => t.id !== payload.old.id);
          setCachedTasks(filtered);
          return filtered;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, setCachedTasks]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setImageFiles(filesArray);
      const previewsArray: string[] = [];
      filesArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          previewsArray.push(reader.result as string);
          if (previewsArray.length === filesArray.length) {
            setImagePreviews(previewsArray);
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      setImageFiles([]);
      setImagePreviews([]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCreateError('Please sign in to post a task.');
        return;
      }

      if (!deadline) {
        setCreateError('Deadline is required.');
        return;
      }

      const imageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const fileName = `${session.user.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('task_images')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('task_images')
          .getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        budget: budget ? parseFloat(budget) : null,
        location: newLocation.trim() || 'Remote',
        category: category || 'Other',
        status: 'open',
        poster_id: session.user.id,
        images: imageUrls,
      };

      if (!payload.title || !payload.description) {
        setCreateError('Title and description are required.');
        return;
      }

      (payload as any).deadline = new Date(deadline).toISOString();

      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        setCreateError(error.message || 'Failed to create task');
      } else if (data) {
        setTitle('');
        setDescription('');
        setBudget('');
        setNewLocation('');
        setCategory('');
        setDeadline('');
        setImageFiles([]);
        setImagePreviews([]);
        setTasks((prev) => [data, ...prev]);
        setShowComposer(false);
        setMessage({ text: 'Task posted successfully!', type: 'success' });
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Network error.');
      setMessage({ text: err?.message || 'Failed to create task. Please try again.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  // Filter UI removed; filtering remains via internal fetch logic

  return (
    <div className="min-h-[100svh] bg-slate-50">
      <Navbar />
      <Toast message={message} onClose={() => setMessage(null)} />

      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            {/* Main content */}
            <div className="flex-1">
              {/* Task composer - collapsed/expanded */}
              {!showComposer ? (
                <div className="mb-6 px-4">
                  <button
                    type="button"
                    onClick={() => setShowComposer(true)}
                    className="btn-primary"
                  >
                    Create Task
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-[28px] shadow-xl border border-slate-200 mb-3 overflow-hidden transition-shadow hover:shadow-2xl">
                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="What's the task?"
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the task in detail..."
                        rows={3}
                        className="input-field resize-none"
                        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="Budget (₹)"
                        className="input-field"
                      />
                      <input
                        type="text"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="Location"
                        className="input-field"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Category"
                        className="input-field"
                      />
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add Images (optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="input-field"
                      />
                      {imagePreviews.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {imagePreviews.map((preview, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={idx} src={preview} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover rounded-md" />
                          ))}
                        </div>
                      )}
                    </div>
                    {createError && (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                        {createError}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowComposer(false);
                          setTitle('');
                          setDescription('');
                          setBudget('');
                          setNewLocation('');
                          setCategory('');
                          setDeadline('');
                          setImageFiles([]);
                          setImagePreviews([]);
                          setCreateError(null);
                        }}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="btn-primary flex-1"
                      >
                        {creating ? 'Posting...' : 'Post Task'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 px-4">Available Tasks</h1>

              {isInitialLoad ? (
                <SkeletonList count={3} type="task" />
              ) : tasks.length > 0 ? (
                <div className="flex flex-col">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : null}
              {tasks.length === 0 && !isInitialLoad && (
                <div className="card text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
                  {fetchError ? (
                    <p className="mt-1 text-sm text-red-600">{fetchError}</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">There are no tasks to display yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}