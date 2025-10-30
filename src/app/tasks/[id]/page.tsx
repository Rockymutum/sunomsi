"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import { formatDistanceToNow } from '@/utils/dateUtils';
import { FiArrowLeft, FiClock, FiMapPin, FiTag, FiDollarSign } from 'react-icons/fi';

interface TaskParams {
  params: {
    id: string;
  };
}

export default function TaskDetailsPage({ params }: TaskParams) {
  const { id } = params;
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applicationNote, setApplicationNote] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [isTaskPoster, setIsTaskPoster] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Check authentication status
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      setUserId(currentUserId ?? null);
      
      // Fetch task details (no embedded select)
      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      if (taskError) {
        console.error('Error fetching task:', taskError);
        setLoading(false);
        return;
      }
      
      let taskData: any = taskRow;
      if (taskRow?.poster_id) {
        const { data: posterProfile } = await supabase
          .from('profiles')
          .select('user_id, id, full_name, avatar_url')
          .eq('user_id', taskRow.poster_id)
          .maybeSingle();
        taskData = {
          ...taskRow,
          poster: posterProfile ? {
            id: posterProfile.id,
            full_name: posterProfile.full_name,
            avatar_url: posterProfile.avatar_url,
          } : null,
        };
      }
      setTask(taskData);
      setIsTaskPoster(currentUserId === taskRow?.poster_id);
      
      // Check if user is a worker
      if (currentUserId) {
        const { data: workerData, error: workerError } = await supabase
          .from('worker_profiles')
          .select('*')
          .eq('user_id', currentUserId)
          .maybeSingle();
        
        if (!workerError && workerData) {
          setUserRole('worker');
          
          // Check if user has already applied
          const { data: applicationData, error: applicationError } = await supabase
            .from('applications')
            .select('*')
            .eq('task_id', id)
            .eq('worker_id', currentUserId)
            .maybeSingle();
          
          if (!applicationError && applicationData) {
            setHasApplied(true);
          }
        } else {
          setUserRole('poster');
        }
        
        // If user is the task poster, fetch applications (no embedded select)
        if (currentUserId === taskRow?.poster_id) {
          const { data: apps, error: applicationsError } = await supabase
            .from('applications')
            .select('*')
            .eq('task_id', id)
            .order('created_at', { ascending: false });
          if (!applicationsError && apps) {
            const workerIds = Array.from(new Set(apps.map(a => a.worker_id).filter(Boolean)));
            let byUserProfile: Record<string, any> = {};
            let byWorkerProfile: Record<string, any> = {};
            if (workerIds.length > 0) {
              const [{ data: profs }, { data: wps }] = await Promise.all([
                supabase.from('profiles').select('user_id, id, full_name, avatar_url').in('user_id', workerIds),
                supabase.from('worker_profiles').select('user_id, rating, skills').in('user_id', workerIds),
              ]);
              if (profs) {
                for (const p of profs) byUserProfile[p.user_id] = p;
              }
              if (wps) {
                for (const wp of wps) byWorkerProfile[wp.user_id] = wp;
              }
            }
            const mergedApps = apps.map(a => ({
              ...a,
              worker: byUserProfile[a.worker_id]
                ? {
                    id: byUserProfile[a.worker_id].id,
                    full_name: byUserProfile[a.worker_id].full_name,
                    avatar_url: byUserProfile[a.worker_id].avatar_url,
                  }
                : null,
              worker_profile: byWorkerProfile[a.worker_id]
                ? {
                    rating: byWorkerProfile[a.worker_id].rating,
                    skills: byWorkerProfile[a.worker_id].skills,
                  }
                : { rating: 0, skills: [] },
            }));
            setApplications(mergedApps);
          }
        }
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [id, supabase]);
  
  const handleApply = async () => {
    if (!userId) {
      router.push('/auth');
      return;
    }
    
    if (userRole !== 'worker') {
      alert('Only workers can apply for tasks');
      return;
    }
    
    setApplying(true);
    
    try {
      const { error } = await supabase
        .from('applications')
        .insert({
          task_id: id,
          worker_id: userId,
          message: applicationNote,
          status: 'pending'
        });
      
      if (error) {
        throw error;
      }

      if (task?.poster_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: task.poster_id,
            type: 'new_application',
            task_id: id,
            sender_id: userId,
            title: 'New application received',
            message: `You have a new application for "${task?.title ?? 'your task'}".`
          });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }

      setHasApplied(true);
      setApplicationNote('');
      
    } catch (error) {
      console.error('Error applying for task:', error);
      alert('Failed to apply for task. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/discovery');
    }
  };
  
  const updateApplicationStatus = async (applicationId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', applicationId);
      
      if (error) {
        throw error;
      }
      
      // Update local state
      setApplications(applications.map(app => 
        app.id === applicationId ? { ...app, status } : app
      ));
      
      // If accepting, update task status
      if (status === 'accepted') {
        await supabase
          .from('tasks')
          .update({ status: 'assigned', worker_id: applications.find(app => app.id === applicationId).worker_id })
          .eq('id', id);
        
        // Update local task state
        setTask({
          ...task,
          status: 'assigned',
          worker_id: applications.find(app => app.id === applicationId).worker_id
        });
      }
      
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('Failed to update application status. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!task) {
    return (
      <div className="min-h-[100svh] bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xl">
            <h1 className="text-2xl font-semibold text-slate-900">Task not found</h1>
            <p className="mt-3 text-sm text-slate-500">
              The task you’re looking for may have been removed or is no longer available.
            </p>
            <button
              onClick={() => router.push('/discovery')}
              className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
            >
              Browse open tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const postedRelative = formatDistanceToNow(new Date(task.created_at));

  return (
    <div className="min-h-[100svh] bg-slate-50">
      <Navbar />
      <main className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(76,106,255,0.12),_transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-6">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary/40 hover:text-primary"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-8">
              <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
                {task.images && task.images.length > 0 ? (
                  <figure className="relative h-64 w-full overflow-hidden bg-slate-900 sm:h-72">
                    <img src={task.images[0]} alt={task.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" aria-hidden="true" />
                    <div className="absolute bottom-6 left-6 flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white ${
                          task.status === 'open'
                            ? 'bg-emerald-500/80'
                            : task.status === 'assigned'
                            ? 'bg-blue-500/80'
                            : task.status === 'completed'
                            ? 'bg-purple-500/80'
                            : 'bg-slate-500/80'
                        }`}
                      >
                        {task.status.replace(/\b\w/g, (char: string) => char.toUpperCase())}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        <FiClock className="h-3.5 w-3.5" />
                        {postedRelative} ago
                      </span>
                    </div>
                  </figure>
                ) : null}
                <div className="px-6 py-6 sm:px-10 sm:py-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      {!task.images?.length && (
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white ${
                            task.status === 'open'
                              ? 'bg-emerald-500'
                              : task.status === 'assigned'
                              ? 'bg-blue-500'
                              : task.status === 'completed'
                              ? 'bg-purple-500'
                              : 'bg-slate-500'
                          }`}
                        >
                          {task.status.replace(/\b\w/g, (char: string) => char.toUpperCase())}
                        </span>
                      )}
                      <h1 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">{task.title}</h1>
                      <p className="mt-2 text-sm text-slate-500">
                        Posted {postedRelative} ago • {task.poster?.full_name ? `by ${task.poster.full_name}` : 'by an anonymous poster'}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white shadow-lg">
                      <FiDollarSign className="h-5 w-5 opacity-80" />
                      <span>${task.budget}</span>
                    </div>
                  </div>
                  <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        <FiClock className="h-4 w-4 text-primary" />
                        Posted
                      </dt>
                      <dd className="mt-2 text-base font-medium text-slate-800">{postedRelative} ago</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        <FiMapPin className="h-4 w-4 text-primary" />
                        Location
                      </dt>
                      <dd className="mt-2 text-base font-medium text-slate-800">{task.location || 'Remote'}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        <FiTag className="h-4 w-4 text-primary" />
                        Category
                      </dt>
                      <dd className="mt-2 text-base font-medium text-slate-800">{task.category || 'Not specified'}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        <FiDollarSign className="h-4 w-4 text-primary" />
                        Budget
                      </dt>
                      <dd className="mt-2 text-base font-medium text-slate-800">${task.budget}</dd>
                    </div>
                  </dl>
                  <div className="mt-8 border-t border-slate-200 pt-8">
                    <h2 className="text-lg font-semibold text-slate-900">Project overview</h2>
                    <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-700">
                      {task.description}
                    </p>
                  </div>
                </div>
              </section>

              {isTaskPoster && (
                <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-xl sm:px-10 sm:py-8">
                  <header className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Applications</h2>
                      <p className="text-sm text-slate-500">Review and manage applicants for this opportunity.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                      {applications.length} {applications.length === 1 ? 'applicant' : 'applicants'}
                    </span>
                  </header>
                  <div className="mt-6 space-y-6">
                    {applications.length > 0 ? (
                      applications.map((application) => (
                        <article key={application.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 shadow-sm">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-1 items-start gap-4">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                                {application.worker?.avatar_url ? (
                                  <img
                                    src={application.worker.avatar_url}
                                    alt={application.worker.full_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-white text-lg font-semibold text-primary">
                                    {application.worker?.full_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-slate-900">
                                      {application.worker?.full_name || 'Applicant'}
                                    </h3>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        application.status === 'pending'
                                          ? 'bg-amber-100 text-amber-700'
                                          : application.status === 'accepted'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : application.status === 'rejected'
                                          ? 'bg-rose-100 text-rose-700'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                                    Applied {formatDistanceToNow(new Date(application.created_at))} ago
                                  </p>
                                </div>
                                {application.worker_profile?.skills?.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {application.worker_profile.skills.map((skill: string, index: number) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {application.message && (
                                  <p className="text-sm leading-relaxed text-slate-600">
                                    {application.message}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                              <button
                                onClick={() => router.push(`/profile/${application.worker_id}`)}
                                className="inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary-dark"
                              >
                                View Profile
                              </button>
                              {application.status === 'pending' && task.status === 'open' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => updateApplicationStatus(application.id, 'accepted')}
                                    className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => updateApplicationStatus(application.id, 'rejected')}
                                    className="inline-flex items-center rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
                        No applications yet. You’ll see applicants here as soon as workers express interest.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-8">
              {task.poster && (
                <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-xl sm:px-8 sm:py-8">
                  <h2 className="text-lg font-semibold text-slate-900">Posted by</h2>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-full bg-slate-100">
                      {task.poster.avatar_url ? (
                        <img src={task.poster.avatar_url} alt={task.poster.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-semibold text-primary">
                          {task.poster.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{task.poster.full_name}</p>
                      <button
                        onClick={() => router.push(`/profile/${task.poster.id}`)}
                        className="mt-1 inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary-dark"
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {userRole === 'worker' && task.status === 'open' && !isTaskPoster && (
                <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-xl sm:px-8 sm:py-8">
                  <h2 className="text-lg font-semibold text-slate-900">Apply for this task</h2>
                  <p className="mt-1 text-sm text-slate-500">Share a short note to highlight why you’re the right fit.</p>
                  {hasApplied ? (
                    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="mx-auto h-12 w-12 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-3 text-sm font-semibold text-emerald-900">Application submitted</p>
                      <p className="mt-1 text-sm text-emerald-700">The poster will get in touch if they’d like to move forward.</p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleApply();
                      }}
                      className="mt-6 space-y-4"
                    >
                      <div>
                        <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-700">
                          Application note
                        </label>
                        <textarea
                          id="note"
                          value={applicationNote}
                          onChange={(e) => setApplicationNote(e.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Explain how your experience aligns with this task..."
                        />
                      </div>
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={applying}
                      >
                        {applying ? 'Submitting...' : 'Submit application'}
                      </button>
                    </form>
                  )}
                </section>
              )}

              <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500 shadow-inner">
                Advertisement Placeholder
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}