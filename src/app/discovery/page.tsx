"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import TaskCard from '@/components/tasks/TaskCard';
import AdPlaceholder from '@/components/ads/AdPlaceholder';
import PageShell from '@/components/ui/PageShell';

export default function DiscoveryPage() {
  const supabase = createClientComponentClient();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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


  useEffect(() => {
    (async () => {
      await supabase.auth.getSession();
      fetchTasks();
    })();
  }, []);
  
  const fetchTasks = async () => {
    setLoading(true);
    setFetchError(null);
    const run = async () => {
      return await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
    };
    let { data, error } = await run();
    if (error && (error.message?.toLowerCase().includes('jwt') || error.message?.toLowerCase().includes('token'))) {
      try {
        await supabase.auth.refreshSession();
        ({ data, error } = await run());
      } catch (_e) {
        // ignore and fall through to existing error handling
      }
    }

    if (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
      setFetchError(error.message || 'Failed to load tasks');
    } else {
      const tasksData = data || [];
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
      setTasks(enriched);
    }

    setLoading(false);
  };

  // Refetch when the page regains focus or becomes visible (handles back navigation)
  useEffect(() => {
    const onFocus = () => fetchTasks();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchTasks();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
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
            return next;
          });
        })();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload: any) => {
        setTasks((prev) => prev.map((t: any) => (t.id === payload.new.id ? { ...t, ...payload.new } : t)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload: any) => {
        setTasks((prev) => prev.filter((t: any) => t.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Refetch on auth state changes (handles JWT refresh/sign-in/sign-out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchTasks();
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

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
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Network error.');
    } finally {
      setCreating(false);
    }
  };

  // Filter UI removed; filtering remains via internal fetch logic

  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top banner ad */}
        <div className="mb-6">
          <AdPlaceholder type="banner" height="90px" />
        </div>
        
        <div className="flex flex-col gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Task composer - collapsed/expanded */}
            {!showComposer ? (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowComposer(true)}
                  className="btn-primary"
                >
                  Create Task
                </button>
              </div>
            ) : (
              <div className="card mb-5">
                <form onSubmit={handleCreateTask} className="space-y-3">
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
                      placeholder="Describe the task..."
                      rows={3}
                      className="input-field"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Budget (optional)"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Location (optional)"
                      className="input-field"
                    />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select category (optional)</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Handyman">Handyman</option>
                      <option value="Moving">Moving</option>
                      <option value="Technology">Technology</option>
                      <option value="Design">Design</option>
                      <option value="Writing">Writing</option>
                      <option value="Cooking">Cooking</option>
                      <option value="Gardening">Gardening</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="input-field"
                      placeholder="Deadline"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                    />
                    {imagePreviews.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {imagePreviews.map((preview, idx) => (
                          <div key={idx} className="tile h-32">
                            <img src={preview} alt={`Task preview ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {createError && (
                    <div className="text-sm text-red-600">{createError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowComposer(false);
                        setCreateError(null);
                      }}
                      className="btn-secondary-compact"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={creating}>
                      {creating ? 'Posting...' : 'Post Task'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Available Tasks</h1>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : tasks.length > 0 ? (
              <>
                <div className="max-w-2xl mx-auto flex flex-col gap-5">
                  {tasks.slice(0, 3).map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
                
                {/* Inline ad after first 3 tasks */}
                {tasks.length > 3 && (
                  <div className="my-5 max-w-2xl mx-auto">
                    <AdPlaceholder type="inline" height="250px" />
                  </div>
                )}
                
                {tasks.length > 3 && (
                  <div className="max-w-2xl mx-auto flex flex-col gap-5">
                    {tasks.slice(3).map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </>
            ) : (
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
  );
}