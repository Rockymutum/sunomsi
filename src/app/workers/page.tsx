"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import WorkerCard from '@/components/workers/WorkerCard';
import AdPlaceholder from '@/components/ads/AdPlaceholder';

const BASE_SKILL_OPTIONS = [
  'Carpentry',
  'Electrical',
  'Plumbing',
  'Painting',
  'Cleaning',
  'Landscaping',
  'Cooking',
  'Babysitting',
  'Tutoring',
  'Graphic Design',
  'Photography',
  'Web Development',
  'Content Writing',
  'Digital Marketing',
  'Translation',
  'Event Planning',
];

interface FilterState {
  skills: string[];
  minRating: number;
  location: string;
  searchTerm: string;
}

export default function WorkersPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const initialQ = (searchParams.get('q') || '').trim();
  
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    skills: [],
    minRating: 0,
    location: '',
    searchTerm: initialQ
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [skillsInput, setSkillsInput] = useState<string[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: Basic, 1: Skills, 2: Review
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  const availableSkillOptions = useMemo(() => {
    const set = new Set<string>(BASE_SKILL_OPTIONS);
    categories.forEach((category) => {
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories]);

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
      // Also listen to profile updates so avatar/name changes reflect in the list
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        // Refetch to re-merge latest profiles (full_name, avatar_url, updated_at)
        fetchWorkers();
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
      const ratingByUser: Record<string, { sum: number; count: number }> = {};

      if (userIds.length > 0) {
        const runProfilesJoin = async () =>
          await supabase
            .from('profiles')
            .select('user_id, id, full_name, avatar_url, updated_at')
            .in('user_id', userIds);

        let { data: profs, error: profErr } = await runProfilesJoin();
        if (profErr && (profErr.message?.toLowerCase().includes('jwt') || profErr.message?.toLowerCase().includes('token'))) {
          try {
            await supabase.auth.refreshSession();
            ({ data: profs, error: profErr } = await runProfilesJoin());
          } catch (_e) {}
        }

        if (!profErr && profs) {
          const byUserId: Record<string, any> = {};
          for (const p of profs) {
            byUserId[p.user_id] = p;
          }
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

        const { data: reviewRows, error: reviewErr } = await supabase
          .from('reviews')
          .select('reviewee_id, rating')
          .in('reviewee_id', userIds);
        if (!reviewErr && reviewRows) {
          for (const row of reviewRows) {
            const id = row.reviewee_id as string | null;
            const rating = typeof row.rating === 'number' ? row.rating : Number(row.rating) || 0;
            if (!id) continue;
            if (!ratingByUser[id]) {
              ratingByUser[id] = { sum: 0, count: 0 };
            }
            ratingByUser[id].sum += rating;
            ratingByUser[id].count += 1;
          }
        }
      }

      const enrichedWorkers = merged.map((worker: any) => {
        const stats = worker?.user_id ? ratingByUser[worker.user_id] : undefined;
        const storedRating = Number(worker?.rating ?? 0);
        const hasStoredRating = Number.isFinite(storedRating) && storedRating > 0;
        const average = stats && stats.count > 0
          ? Number((stats.sum / stats.count).toFixed(1))
          : hasStoredRating
            ? Number(storedRating.toFixed(1))
            : 0;

        return {
          ...worker,
          average_rating: average,
          review_count: stats?.count ?? (hasStoredRating ? 1 : 0),
        };
      });

      setWorkers(enrichedWorkers);
      const skillsSet = new Set<string>();
      enrichedWorkers.forEach((w: any) => {
        if (Array.isArray(w.skills)) {
          w.skills.forEach((skill: string) => {
            if (skill) skillsSet.add(skill);
          });
        }
      });
      const nextCategories = Array.from(skillsSet).sort((a, b) => a.localeCompare(b));
      setCategories(nextCategories);
      if (selectedCategory && !nextCategories.includes(selectedCategory)) {
        setSelectedCategory('');
        setFilters((prev) => ({ ...prev, skills: [] }));
      }
    } else {
      setWorkers([]);
      setCategories([]);
    }
    
    setLoading(false);
  };
  
  const toggleSkillSelection = (skill: string) => {
    setSkillsInput((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleClearFilters = () => {
    setFilters({ skills: [], minRating: 0, location: '', searchTerm: '' });
    setSelectedCategory('');
  };

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
      setTitleInput('');
      setBioInput('');
      setLocationInput('');
      setSkillsInput([]);
      setShowComposer(false);
      setPublishSuccess('Your portfolio has been published and will appear in the list shortly.');
      setFilters({ skills: [], minRating: 0, location: '', searchTerm: '' });
      setSelectedCategory('');
      fetchWorkers();
    } catch (err: any) {
      setComposeError(err?.message || 'Failed to save portfolio');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryClick = (category: string) => {
    if (!category) {
      setSelectedCategory('');
      setFilters((prev) => ({ ...prev, skills: [] }));
      return;
    }
    if (selectedCategory === category) {
      setSelectedCategory('');
      setFilters((prev) => ({ ...prev, skills: [] }));
    } else {
      setSelectedCategory(category);
      setFilters((prev) => ({ ...prev, skills: [category] }));
    }
  };

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
                      <p className="text-sm text-gray-600">Select all skills that best describe your work. You can tap to toggle each option.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {availableSkillOptions.map((option) => {
                          const active = skillsInput.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => toggleSkillSelection(option)}
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                                active
                                  ? 'border-primary bg-primary text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {skillsInput.length > 0 ? (
                        <div className="mt-3 text-xs text-gray-500">
                          Selected: {skillsInput.join(', ')}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-amber-600">Choose at least one skill to help clients find you faster.</div>
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
            {categories.length > 0 && (
              <div className="mb-5 overflow-x-auto">
                <div className="flex w-full min-w-max items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('')}
                    className={`inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      selectedCategory === ''
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategoryClick(category)}
                      className={`inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        selectedCategory === category
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
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