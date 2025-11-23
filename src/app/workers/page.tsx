"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import WorkerCard from '@/components/workers/WorkerCard';
import Toast from '@/components/ui/Toast';

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: Basic, 1: Skills, 2: Portfolio, 3: Review
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Portfolio images state (up to 4 images with titles)
  const [portfolioItems, setPortfolioItems] = useState<Array<{
    file: File | null;
    preview: string | null;
    title: string;
  }>>([{ file: null, preview: null, title: '' }]);

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

  // Scroll restoration - restore after workers are loaded
  useEffect(() => {
    if (!loading && workers.length > 0) {
      const savedScroll = sessionStorage.getItem('workersScroll');
      if (savedScroll) {
        const scrollY = parseInt(savedScroll, 10);
        if (scrollY > 0) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo({
                top: scrollY,
                behavior: 'instant' as ScrollBehavior,
              });
            }, 150);
          });
        }
      }
    }
  }, [loading, workers.length]);

  // Save scroll position
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollY = window.scrollY;
        sessionStorage.setItem('workersScroll', scrollY.toString());
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
          } catch (_e) { }
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearFilters = () => {
    setFilters({ skills: [], minRating: 0, location: '', searchTerm: '' });
    setSelectedCategory('');
  };

  const handlePortfolioImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newItems = [...portfolioItems];
      newItems[index].file = file;

      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = [...portfolioItems];
        updated[index].preview = reader.result as string;
        setPortfolioItems(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePortfolioTitleChange = (index: number, title: string) => {
    const newItems = [...portfolioItems];
    newItems[index].title = title;
    setPortfolioItems(newItems);
  };

  const addPortfolioItem = () => {
    if (portfolioItems.length < 4) {
      setPortfolioItems([...portfolioItems, { file: null, preview: null, title: '' }]);
    }
  };

  const removePortfolioItem = (index: number) => {
    setPortfolioItems(portfolioItems.filter((_, i) => i !== index));
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
      // Upload avatar if provided
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;

        // Update profile with new avatar
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (profileUpdateError) throw profileUpdateError;
      }

      // Upload portfolio images
      const portfolioData = [];
      for (const item of portfolioItems) {
        if (item.file && item.title) {
          const fileName = `${userId}/portfolio/${Date.now()}-${item.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('worker_portfolio')
            .upload(fileName, item.file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('worker_portfolio')
              .getPublicUrl(fileName);

            portfolioData.push({
              image: publicUrl,
              title: item.title
            });
          }
        }
      }

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
            portfolio_images: portfolioData,
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
            portfolio_images: portfolioData,
            rating: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        if (insErr) throw insErr;
      }

      setMessage({ text: 'Portfolio published successfully!', type: 'success' });
      setPublishSuccess('Portfolio published successfully!');
      setTimeout(() => setPublishSuccess(null), 3000);
      setShowComposer(false);
      setTitleInput('');
      setLocationInput('');
      setBioInput('');
      setSkillsInput([]);
      setAvatarFile(null);
      setAvatarPreview(null);
      setCurrentStep(0);
      fetchWorkers();
    } catch (error: any) {
      setComposeError(error.message || 'Failed to publish portfolio');
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
    <div className="min-h-[100svh] bg-slate-50">
      <Navbar />
      <Toast message={message} onClose={() => setMessage(null)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 pb-24 md:pb-8">
        {publishSuccess && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
            {publishSuccess}
          </div>
        )}

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
              <div className="bg-white rounded-[28px] shadow-xl border border-slate-200 p-6 sm:p-8 mb-6">
                {/* Wizard header */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`${currentStep === 0 ? 'font-semibold text-gray-900' : ''}`}>1. Basic Info</span>
                    <span>›</span>
                    <span className={`${currentStep === 1 ? 'font-semibold text-gray-900' : ''}`}>2. Skills</span>
                    <span>›</span>
                    <span className={`${currentStep === 2 ? 'font-semibold text-gray-900' : ''}`}>3. Review & Publish</span>
                  </div>
                </div>
                <form onSubmit={handleCreatePortfolio} className="space-y-3">
                  {currentStep === 0 && (
                    <>
                      {/* Avatar Upload */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Profile Photo
                        </label>
                        <div className="flex items-center gap-4">
                          {avatarPreview ? (
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={avatarPreview}
                                alt="Avatar preview"
                                className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setAvatarFile(null);
                                  setAvatarPreview(null);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Choose Photo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                              />
                            </label>
                            <p className="mt-1 text-xs text-gray-500">
                              JPG, PNG or GIF (max 5MB)
                            </p>
                          </div>
                        </div>
                      </div>

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
                        className="input-field resize-none"
                        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                      />

                      {/* Portfolio Images - Past Jobs */}
                      <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Portfolio (Past Jobs) - Up to 4 photos
                        </label>
                        {portfolioItems.map((item, index) => (
                          <div key={index} className="mb-4 p-4 border border-gray-200 rounded-lg">
                            <div className="flex gap-4">
                              {/* Image Preview */}
                              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                {item.preview ? (
                                  <img src={item.preview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Title and Upload */}
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Job title (e.g., Kitchen Renovation)"
                                  value={item.title}
                                  onChange={(e) => handlePortfolioTitleChange(index, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 text-sm"
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePortfolioImageChange(index, e)}
                                  className="text-sm"
                                />
                              </div>

                              {/* Remove Button */}
                              {portfolioItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePortfolioItem(index)}
                                  className="text-red-600 hover:text-red-800 text-xl font-bold"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {portfolioItems.length < 4 && (
                          <button
                            type="button"
                            onClick={addPortfolioItem}
                            className="text-sm text-primary hover:text-primary-dark font-medium"
                          >
                            + Add Another Photo
                          </button>
                        )}
                      </div>
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
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${active
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
                    className={`inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${selectedCategory === ''
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
                      className={`inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${selectedCategory === category
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
              <div className="max-w-2xl mx-auto flex flex-col gap-5">
                {workers.map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>
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