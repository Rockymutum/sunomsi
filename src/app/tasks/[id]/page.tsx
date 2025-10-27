"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import { formatDistanceToNow } from '@/utils/dateUtils';

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
      
      setHasApplied(true);
      setApplicationNote('');
      
    } catch (error) {
      console.error('Error applying for task:', error);
      alert('Failed to apply for task. Please try again.');
    } finally {
      setApplying(false);
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
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Task not found</h1>
            <p className="mt-2 text-gray-600">The task you're looking for doesn't exist or has been removed.</p>
            <button 
              onClick={() => router.push('/discovery')}
              className="mt-4 btn-primary"
            >
              Browse Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              {task.images && task.images.length > 0 && (
                <div className="h-64 tile">
                  <img 
                    src={task.images[0]} 
                    alt={task.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      task.status === 'open' ? 'bg-green-100 text-green-800' :
                      task.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                    <span className="ml-4 text-xl font-semibold text-gray-900">${task.budget}</span>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-500 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Posted {formatDistanceToNow(new Date(task.created_at))}</span>
                  
                  {task.location && (
                    <>
                      <span className="mx-2">•</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{task.location}</span>
                    </>
                  )}
                  
                  {task.category && (
                    <>
                      <span className="mx-2">•</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{task.category}</span>
                    </>
                  )}
                </div>
                
                <div className="prose max-w-none">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-700 whitespace-pre-line">{task.description}</p>
                </div>
              </div>
            </div>
            
            {/* Applications section for task poster */}
            {isTaskPoster && (
              <div className="mt-6 card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Applications ({applications.length})
                </h2>
                
                {applications.length > 0 ? (
                  <div className="space-y-6">
                    {applications.map((application) => (
                      <div key={application.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                        <div className="flex items-start">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            {application.worker.avatar_url ? (
                              <img 
                                src={application.worker.avatar_url} 
                                alt={application.worker.full_name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                                {application.worker.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">
                                  {application.worker.full_name}
                                </h4>
                                <div className="flex items-center mt-1">
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <svg 
                                        key={star}
                                        xmlns="http://www.w3.org/2000/svg" 
                                        className={`h-4 w-4 ${star <= application.worker_profile.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                        viewBox="0 0 20 20" 
                                        fill="currentColor"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 01-2.828 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                    <span className="ml-1 text-xs text-gray-600">
                                      ({application.worker_profile.rating.toFixed(1)})
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-sm text-gray-500">
                                {formatDistanceToNow(new Date(application.created_at))}
                              </span>
                            </div>
                            
                            {application.worker_profile.skills && application.worker_profile.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {application.worker_profile.skills.map((skill: string, index: number) => (
                                  <span 
                                    key={index} 
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {application.message && (
                              <p className="mt-2 text-sm text-gray-700">
                                {application.message}
                              </p>
                            )}
                            
                            <div className="mt-3 flex items-center justify-between">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                application.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                application.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                              </span>
                              
                              {application.status === 'pending' && task.status === 'open' && (
                                <div className="flex space-x-2">
                                  <button 
                                    onClick={() => updateApplicationStatus(application.id, 'accepted')}
                                    className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700"
                                  >
                                    Accept
                                  </button>
                                  <button 
                                    onClick={() => updateApplicationStatus(application.id, 'rejected')}
                                    className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                              
                              <button 
                                onClick={() => router.push(`/profile/${application.worker_id}`)}
                                className="text-primary hover:text-primary-dark text-sm font-medium"
                              >
                                View Profile
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No applications yet.</p>
                )}
              </div>
            )}

            
          </div>
          
          {/* Sidebar */}
          <div>
            {/* Task poster info */}
            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Posted by</h2>
              
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                  {task.poster.avatar_url ? (
                    <img 
                      src={task.poster.avatar_url} 
                      alt={task.poster.full_name} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                      {task.poster.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="ml-4">
                  <h3 className="text-md font-medium text-gray-900">{task.poster.full_name}</h3>
                  <button 
                    onClick={() => router.push(`/profile/${task.poster.id}`)}
                    className="text-primary hover:text-primary-dark text-sm"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>
            
            {/* Apply for task section */}
            {userRole === 'worker' && task.status === 'open' && !isTaskPoster && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Apply for this task</h2>
                
                {hasApplied ? (
                  <div className="text-center py-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-700">You have applied for this task.</p>
                    <p className="text-sm text-gray-500 mt-1">The task poster will review your application.</p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleApply(); }}>
                    <div className="mb-4">
                      <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                        Add a note (optional)
                      </label>
                      <textarea
                        id="note"
                        value={applicationNote}
                        onChange={(e) => setApplicationNote(e.target.value)}
                        rows={4}
                        className="input-field"
                        placeholder="Explain why you're a good fit for this task..."
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="btn-primary w-full"
                      disabled={applying}
                    >
                      {applying ? 'Applying...' : 'Apply Now'}
                    </button>
                  </form>
                )}
              </div>
            )}
            
            {/* AdSense Placeholder */}
            <div className="mt-6 bg-gray-100 p-4 rounded-lg border border-dashed border-gray-300 flex items-center justify-center h-60">
              <span className="text-gray-500 text-sm">Advertisement Placeholder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}