"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Toast from '@/components/ui/Toast';
import { sessionManager } from '@/utils/sessionPersistence';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  skills: string[];
  place: string | null;
  title: string | null;
  contact: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    place: '',
    title: '',
  });
  const [socialLinks, setSocialLinks] = useState({
    behance: '',
    dribbble: '',
    linkedin: '',
    instagram: '',
    facebook: '',
    github: '',
    twitter: '',
    website: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
        return;
      }

      setUser(session.user);
      await getProfile(session.user.id);
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push('/auth');
    }
  };

  const getProfile = async (userId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        if (error.code === 'PGRST116') {
          await createProfile(userId);
          return;
        }
        throw error;
      } else {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          place: data.place || '',
          title: data.title || '',
        });

        // Parse social links from contact field
        const contactStr = data.contact || '';
        setSocialLinks({
          behance: contactStr.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || '',
          dribbble: contactStr.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || '',
          linkedin: contactStr.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || '',
          instagram: contactStr.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || '',
          facebook: contactStr.match(/https?:\/\/[^\s]*facebook[^\s]*/i)?.[0] || '',
          github: contactStr.match(/https?:\/\/[^\s]*github[^\s]*/i)?.[0] || '',
          twitter: contactStr.match(/https?:\/\/[^\s]*twitter[^\s]*/i)?.[0] || '',
          website: '',
        });
      }
    } catch (error: any) {
      console.error('Error in getProfile:', error);
      setMessage({ text: 'Error loading profile: ' + error.message, type: 'error' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (userId: string) => {
    try {
      const newProfile = {
        user_id: userId,
        full_name: user?.user_metadata?.full_name || '',
        avatar_url: user?.user_metadata?.avatar_url || '',
        email: user?.email || '',
        phone: '',
        bio: '',
        skills: [],
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        place: data.place || '',
        title: data.title || '',
      });
      setSocialLinks({
        behance: '',
        dribbble: '',
        linkedin: '',
        instagram: '',
        facebook: '',
        github: '',
        twitter: '',
        website: '',
      });
    } catch (error: any) {
      console.error('Error creating profile:', error);
      setMessage({ text: 'Error creating profile: ' + error.message, type: 'error' });
      setTimeout(() => setMessage(null), 5000);
    }
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

  const handleSave = async () => {
    if (!profile || !user) return;

    try {
      setMessage('');

      // Upload avatar if provided
      let avatarUrl: string | undefined = undefined;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      // Combine social links into contact field
      const socialLinksArray = Object.values(socialLinks).filter(link => link.trim() !== '');
      const contactField = socialLinksArray.join(' ');

      const updateData: any = {
        full_name: formData.full_name,
        phone: formData.phone,
        bio: formData.bio,
        place: formData.place,
        title: formData.title,
        contact: contactField,
        updated_at: new Date().toISOString(),
      };

      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        ...formData,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {})
      } : null);
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ text: 'Error updating profile: ' + error.message, type: 'error' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      sessionManager.clearSession();
      router.push('/'); // Redirect to Get Started page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/'); // Redirect to Get Started page
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto py-8 px-4 pt-20 pb-24 md:pb-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto py-8 px-4 pt-20 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Profile</h1>
          <p className="text-base text-gray-600 mt-3 font-medium">Manage your account settings and preferences</p>
        </div>


        {/* Success/Error Toast Notification */}
        {message && (
          <div className={`fixed top-24 right-4 z-50 max-w-md animate-slide-in-right ${message.type === 'success'
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
            } border-2 rounded-lg shadow-lg p-4 flex items-start gap-3`}>
            {/* Icon */}
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            {/* Message */}
            <div className="flex-1">
              <p className="font-semibold">{message.type === 'success' ? 'Success!' : 'Error'}</p>
              <p className="text-sm mt-1">{message.text}</p>
            </div>
            {/* Close button */}
            <button
              onClick={() => setMessage(null)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Profile Info */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Personal Information</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Avatar Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2 tracking-wide">Profile Picture</label>
                  <div className="flex items-center gap-4">
                    {avatarPreview || profile?.avatar_url ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarPreview || profile?.avatar_url || ''}
                          alt="Profile photo"
                          className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                        />
                        {editing && avatarPreview && (
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
                        )}
                      </div>
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    {editing && (
                      <div>
                        <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Change Photo
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
                    )}
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                    {user?.email || ''}
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                      {profile?.full_name || 'Not set'}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone Number
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all"
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                      {profile?.phone || 'Not set'}
                    </div>
                  )}
                </div>

                {/* Professional Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Professional Title
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all"
                      placeholder="e.g., Graphic Designer, Developer"
                    />
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                      {profile?.title || 'Not set'}
                    </div>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.place}
                      onChange={(e) => setFormData(prev => ({ ...prev, place: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all"
                      placeholder="e.g., New York, NY"
                    />
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                      {profile?.place || 'Not set'}
                    </div>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Bio
                  </label>
                  {editing ? (
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all resize-none"
                      placeholder="Tell us about yourself..."
                      style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                    />
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 whitespace-pre-wrap min-h-[100px]">
                      {profile?.bio || 'No bio provided'}
                    </div>
                  )}
                </div>

                {/* Edit/Save Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  {editing ? (
                    <>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            full_name: profile?.full_name || '',
                            phone: profile?.phone || '',
                            bio: profile?.bio || '',
                            place: profile?.place || '',
                            title: profile?.title || '',
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-transparent rounded-md hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-transparent rounded-md hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Account</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Member since</p>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">User ID</p>
                  <p className="text-sm font-medium text-gray-900 font-mono text-xs truncate">
                    {user?.id}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-red-600 bg-white border-2 border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Quick Actions</h2>
              </div>
              <div className="p-6 space-y-3">
                <button
                  onClick={() => router.push('/discovery')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  📋 Browse Tasks
                </button>
                <button
                  onClick={() => router.push('/workers')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  👥 Find Workers
                </button>
                <button
                  onClick={() => router.push('/discovery')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  ➕ Create Task
                </button>
                <button
                  onClick={() => router.push('/test-push')}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors font-medium"
                >
                  🔔 Debug Push Notifications (v2.1)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}