"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isWorker, setIsWorker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  
  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Worker profile form state
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  // Social links (stored inside profiles.contact on save)
  const [behance, setBehance] = useState('');
  const [dribbble, setDribbble] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  
  const AVAILABLE_SKILLS = [
    'Cleaning',
    'Delivery',
    'Handyman',
    'Moving',
    'Technology',
    'Design',
    'Writing',
    'Cooking',
    'Gardening',
    'Other'
  ];
  
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      
      const userId = session.user.id;
      setUserId(userId);
      
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profileData) {
        setFullName(profileData.full_name || '');
        setEmail(profileData.email || '');
        setAvatarUrl(profileData.avatar_url || '');
        setBio(profileData.bio || '');
        setLocation(profileData.place || '');
        // Prefill social links from contact field if present
        const c = (profileData.contact || '').toString();
        // Strip known social URLs from contact so only non-social contact info remains visible in the input
        const contactWithoutSocials = c
          .replace(/https?:\/\/[^\s]*behance[^\s]*/gi, '')
          .replace(/https?:\/\/[^\s]*dribbble[^\s]*/gi, '')
          .replace(/https?:\/\/[^\s]*linkedin[^\s]*/gi, '')
          .replace(/https?:\/\/[^\s]*instagram[^\s]*/gi, '')
          .replace(/https?:\/\/[^\s]*facebook[^\s]*/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        setContact(contactWithoutSocials);
        setBehance(c.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || '');
        setDribbble(c.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || '');
        setLinkedin(c.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || '');
        setInstagram(c.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || '');
        setFacebook(c.match(/https?:\/\/[^\s]*facebook[^\s]*/i)?.[0] || '');
      }
      
      // Check if user is a worker
      const { data: workerData, error: workerError } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (!workerError && workerData) {
        setIsWorker(true);
        setSkills(workerData.skills || []);
      }
      
      setLoading(false);
    };
    
    fetchProfile();
  }, [supabase, router]);
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const addSkill = () => {
    if (skillInput && !skills.includes(skillInput)) {
      setSkills([...skills, skillInput]);
      setSkillInput('');
    }
  };
  
  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) return;
    
    setSaving(true);
    
    try {
      // Upload avatar if changed
      let finalAvatarUrl = avatarUrl;
      
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);
        
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          alert(`Failed to upload avatar: ${uploadError.message || 'Unknown error'}`);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        finalAvatarUrl = publicUrl;
      }
      
      // Ensure a profile exists; create if missing (role based on isWorker)
      const { data: profExisting, error: profFetchErr } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (profFetchErr) {
        console.error('Profile fetch error:', profFetchErr);
        alert(`Failed to update profile: ${profFetchErr.message || 'Unknown error'}`);
        return;
      }
      if (!profExisting) {
        const { data: sessionWrap } = await supabase.auth.getSession();
        const currentUser = sessionWrap?.session?.user;
        const fallbackName =
          fullName ||
          (currentUser?.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) ||
          currentUser?.email ||
          'User';
        // Merge generic contact + social links
        const socials = [behance, dribbble, linkedin, instagram, facebook].filter(Boolean).join(' ');
        const combinedContact = [contact, socials].filter(Boolean).join(' ');
        const { error: profInsertErr } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: fallbackName,
            role: isWorker ? 'worker' : 'poster',
            avatar_url: finalAvatarUrl,
            bio,
            place: location,
            contact: combinedContact,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (profInsertErr) {
          console.error('Profile create error:', profInsertErr);
          alert(`Failed to create profile: ${profInsertErr.message || 'Unknown error'}`);
          return;
        }
      } else {
        // Update profile
        const socials = [behance, dribbble, linkedin, instagram, facebook].filter(Boolean).join(' ');
        const combinedContact = [contact, socials].filter(Boolean).join(' ');
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            avatar_url: finalAvatarUrl,
            bio,
            place: location,
            contact: combinedContact,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (profileError) {
          console.error('Profile update error:', profileError);
          alert(`Failed to update profile: ${profileError.message || 'Unknown error'}`);
          return;
        }
      }
      // No worker_profiles write for bio/place/contact to keep user profile separate
      
      // Redirect to profile page
      router.push(`/profile/${userId}`);
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(`Failed to update profile. ${error?.message ? 'Details: ' + error.message : ''}`);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                disabled
                className="input-field bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>
            <div>
              <label htmlFor="avatar" className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
              <input type="file" id="avatar" accept="image/*" onChange={handleAvatarChange} />
              {avatarUrl && (
                <div className="mt-2 h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Profile Details</h2>
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input-field"
                rows={4}
                placeholder="Tell others about yourself"
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Place</label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
                placeholder="City, State"
              />
            </div>
            {/* Social links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Behance</label>
                <input
                  type="url"
                  value={behance}
                  onChange={(e) => setBehance(e.target.value)}
                  className="input-field"
                  placeholder="https://behance.net/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dribbble</label>
                <input
                  type="url"
                  value={dribbble}
                  onChange={(e) => setDribbble(e.target.value)}
                  className="input-field"
                  placeholder="https://dribbble.com/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="input-field"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="input-field"
                  placeholder="https://instagram.com/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                <input
                  type="url"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  className="input-field"
                  placeholder="https://facebook.com/username"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}