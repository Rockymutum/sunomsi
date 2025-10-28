"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import WorkerCard from '@/components/workers/WorkerCard';
import AdPlaceholder from '@/components/ads/AdPlaceholder';
import PageShell from '@/components/ui/PageShell';

export default function WorkersPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const initialQ = (searchParams.get('q') || '').trim();
  
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    skills: [],
    minRating: 0,
    location: '',
    searchTerm: initialQ
  });
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skillsInput, setSkillsInput] = useState<string[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: Basic, 1: Skills, 2: Review
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  
  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setUserId(s?.user?.id ?? null);
      fetchWorkers();
    };
    init();
  }, [filters]);

  // Refetch when the page regains focus or becomes visible (handles back navigation)
  useEffect(() => {
    const onFocus = () => fetchWorkers();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchWorkers();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Realtime sync for worker profiles
  useEffect(() => {
    const channel = supabase
      .channel('worker-profiles-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_profiles' }, (payload: any) => {
        setWorkers((prev) => [{ ...payload.new }, ...prev.filter((w: any) => w.id !== payload.new.id)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'worker_profiles' }, (payload: any) => {
        setWorkers((prev) => prev.map((w: any) => (w.id === payload.new.id ? { ...w, ...payload.new } : w)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'worker_profiles' }, (payload: any) => {
        setWorkers((prev) => prev.filter((w: any) => w.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Refetch on auth state changes (handles JWT refresh/sign-in/sign-out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchWorkers();
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Keep filters.searchTerm in sync with URL changes (e.g., header search while on this page)
  useEffect(() => {
    setFilters((prev) => ({ ...prev, searchTerm: initialQ }));
  }, [initialQ]);
  
  const fetchWorkers = async () => {
    setLoading(true);
    
    // Fetch worker profiles (without relational select to avoid FK dependency)
    let baseQuery = () => supabase
      .from('worker_profiles')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    let query = baseQuery();
    
    // Apply filters
    if (filters.skills && filters.skills.length > 0) {
      // Filter by skills (array contains)
      query = query.contains('skills', filters.skills);
    }
    
    if (filters.minRating > 0) {
      query = query.gte('rating', filters.minRating);
    }
    
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    
    if (filters.searchTerm) {
      // This is a bit tricky since we need to search in the related profiles table
      // For a real app, you might want to implement a more sophisticated search
      const { data: profileIds, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${filters.searchTerm}%`);
      
      if (!profileError && profileIds && profileIds.length > 0) {
        const ids = profileIds.map(p => p.id);
        query = query.in('user_id', ids);
      } else {
        // If no matching profiles, search in bio
        query = query.ilike('bio', `%${filters.searchTerm}%`);
      }
    }
    
    const runProfiles = async () => await query;
    let { data, error } = await runProfiles();
    if (error && (error.message?.toLowerCase().includes('jwt') || error.message?.toLowerCase().includes('token'))) {
      try {
        await supabase.auth.refreshSession();
        // rebuild query after refresh
        query = baseQuery();
        if (filters.skills && filters.skills.length > 0) query = query.contains('skills', filters.skills);
        if (filters.minRating > 0) query = query.gte('rating', filters.minRating);
        if (filters.location) query = query.ilike('location', `%${filters.location}%`);
        if (filters.searchTerm) {
          const { data: profileIds } = await supabase
            .from('profiles')
            .select('id')
            .ilike('full_name', `%${filters.searchTerm}%`);
          if (profileIds && profileIds.length > 0) {
            const ids = profileIds.map((p: any) => p.id);
            query = query.in('user_id', ids);
          } else {
            query = query.ilike('bio', `%${filters.searchTerm}%`);
          }
        }
        ({ data, error } = await runProfiles());
      } catch (_e) {
        // ignore; fall through
      }
    }
    
    if (error) {
      console.error('Error fetching workers:', error);
    } else if (data && data.length > 0) {
      // Fetch matching profiles by user_id and merge client-side
      const userIds = Array.from(new Set(
        data.map((w: any) => w.user_id).filter((x: any) => !!x)
      ));
      let merged = data;
      if (userIds.length > 0) {
        const runJoin = async () => await supabase
          .from('profiles')
          .select('user_id, id, full_name, avatar_url, updated_at')
          .in('user_id', userIds);
        let { data: profs, error: profErr } = await runJoin();
        if (profErr && (profErr.message?.toLowerCase().includes('jwt') || profErr.message?.toLowerCase().includes('token'))) {
          try {
            await supabase.auth.refreshSession();
            ({ data: profs, error: profErr } = await runJoin());
          } catch (_e) {}
        }
        if (!profErr && profs) {
          const byUserId: Record<string, any> = {};
          for (const p of profs) byUserId[p.user_id] = p;
          merged = data.map((w: any) => ({
            ...w,
            profiles: byUserId[w.user_id]
              ? {
                  id: byUserId[w.user_id].id,
                  full_name: byUserId[w.user_id].full_name,
                  avatar_url: byUserId[w.user_id].avatar_url,
                  updated_at: byUserId[w.user_id].updated_at,
                }
              : null,
          }));
        }
      }
      setWorkers(merged || []);
    } else {
      setWorkers([]);
    }
    
    setLoading(false);
  };
  
  const addSkill = () => {
    const v = skillInput.trim();
    if (v && !skillsInput.includes(v)) {
      setSkillsInput([...skillsInput, v]);
      setSkillInput('');
    }
  };

  const removeSkill = (s: string) => {
    setSkillsInput(skillsInput.filter(x => x !== s));
  };

  const handleClearFilters = () => {
    setFilters({ skills: [], minRating: 0, location: '', searchTerm: '' });
  };

  // No avatar upload within the portfolio composer

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError(null);
    if (!userId) {
      setComposeError('Please sign in to create your portfolio.');
      return;
    }
    if (currentStep < 2) {
      // proceed to next step instead of saving
      setCurrentStep((s) => Math.min(2, s + 1));
      return;
    }
    setSaving(true);
    try {
      // Insert or update worker profile without relying on ON CONFLICT
      const { data: existing, error: fetchWpErr } = await supabase
        .from('worker_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (fetchWpErr) throw fetchWpErr;

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('worker_profiles')
          .update({
            title: titleInput.trim() || null,
            location: locationInput.trim() || null,
            bio: bioInput.trim() || null,
            skills: skillsInput,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('worker_profiles')
          .insert({
            user_id: userId,
            title: titleInput.trim() || null,
            location: locationInput.trim() || null,
            bio: bioInput.trim() || null,
            skills: skillsInput,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        if (insErr) throw insErr;
      }

      // Reset inputs and refresh list
      setLocationInput('');
      setBioInput('');
      setTitleInput('');
      setSkillsInput([]);
      setSkillInput('');
      setShowComposer(false);
      setPublishSuccess('Your portfolio has been published and will appear in the list shortly.');
      // Clear any filters that might hide the new card
      setFilters({ skills: [], minRating: 0, location: '', searchTerm: '' });
      fetchWorkers();
    } catch (err: any) {
      setComposeError(err?.message || 'Failed to save portfolio');
    } finally {
      setSaving(false);
    }
  };
  
  // Filter UI removed; filtering is now driven by URL (?q=) and internal fetch logic
  
  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {publishSuccess && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
            {publishSuccess}
          </div>
        )}
        {/* Top banner ad */}
        <div className="mb-6">
          <AdPlaceholder type="banner" height="90px" />
        </div>
        
        <div className="flex flex-col gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Portfolio composer toggle */}
            {userId && !showComposer && (
              <div className="mb-4">
                <button type="button" onClick={() => setShowComposer(true)} className="btn-primary">
                  Create Portfolio
                </button>
              </div>
            )}

            {showComposer && (
              <div className="card mb-5">
                {/* Wizard header */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`${currentStep===0 ? 'font-semibold text-gray-900' : ''}`}>1. Basic Info</span>
                    <span>›</span>
                    <span className={`${currentStep===1 ? 'font-semibold text-gray-900' : ''}`}>2. Skills</span>
                    <span>›</span>
                    <span className={`${currentStep===2 ? 'font-semibold text-gray-900' : ''}`}>3. Review & Publish</span>
                  </div>
                </div>
                <form onSubmit={handleCreatePortfolio} className="space-y-3">
                  {currentStep === 0 && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={titleInput}
                          onChange={(e) => setTitleInput(e.target.value)}
                          placeholder="Main title (e.g., Software Engineer)"
                          className="input-field"
                        />
                        <input
                          type="text"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value)}
                          placeholder="Location (optional)"
                          className="input-field"
                        />
                      </div>
                      <textarea
                        value={bioInput}
                        onChange={(e) => setBioInput(e.target.value)}
                        placeholder="Short bio (your experience, specialties)"
                        rows={4}
                        className="input-field"
                      />
                    </>
                  )}

                  {currentStep === 1 && (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          placeholder="Add a skill (e.g., Plumbing, React)"
                          className="input-field flex-1"
                        />
                        <button type="button" onClick={addSkill} className="btn-secondary-compact">Add</button>
                      </div>
                      {skillsInput.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {skillsInput.map((s) => (
                            <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {s}
                              <button type="button" className="ml-1 text-gray-500 hover:text-gray-700" onClick={() => removeSkill(s)}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {currentStep === 2 && (
                    <>
                      <div className="text-sm">
                        <div className="text-gray-900 font-semibold">{titleInput || '—'}</div>
                        <div className="text-gray-900 font-medium">Location: {locationInput || '—'}</div>
                        <div className="text-gray-700">{bioInput || 'No bio yet'}</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium mb-1">Skills</div>
                        {skillsInput.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {skillsInput.map((s) => (
                              <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{s}</span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500">No skills added</div>
                        )}
                      </div>
                    </>
                  )}

                  {composeError && <div className="text-sm text-red-600">{composeError}</div>}
                  <div className="flex justify-between gap-2">
                    <div>
                      {currentStep > 0 && (
                        <button type="button" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                          className="btn-secondary-compact">Back</button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setShowComposer(false); setComposeError(null); }}
                        className="btn-secondary-compact">Cancel</button>
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : (currentStep < 2 ? 'Next' : 'Publish')}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Available Workers</h1>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : workers.length > 0 ? (
              <>
                <div className="max-w-2xl mx-auto flex flex-col gap-5">
                  {workers.slice(0, 3).map((worker) => (
                    <WorkerCard key={worker.id} worker={worker} />
                  ))}
                </div>
                
                {/* Inline ad after first 3 workers */}
                {workers.length > 3 && (
                  <div className="my-5 max-w-2xl mx-auto">
                    <AdPlaceholder type="inline" height="250px" />
                  </div>
                )}
                
                {workers.length > 3 && (
                  <div className="max-w-2xl mx-auto flex flex-col gap-5">
                    {workers.slice(3).map((worker) => (
                      <WorkerCard key={worker.id} worker={worker} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="card text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">No workers found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters or check back later for new workers.
                </p>
                <button 
                  onClick={handleClearFilters}
                  className="mt-4 btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}