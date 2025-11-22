"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import PageShell from '@/components/ui/PageShell';

export default function NewTaskPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const CATEGORIES = [
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
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
        return;
      }

      setUserId(session.user.id);
    };

    checkAuth();
  }, [supabase, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setImageFiles(filesArray);

      const previewsArray: string[] = [];
      filesArray.forEach(file => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      alert('You must be logged in to post a task');
      return;
    }

    setLoading(true);

    try {
      // Upload images if provided
      const imageUrls: string[] = [];

      for (const imageFile of imageFiles) {
        const fileName = `${userId}/${Date.now()}-${imageFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from('task_images')
          .upload(fileName, imageFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('task_images')
          .getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      }

      // Create task
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          budget: budget ? parseFloat(budget) : null,
          location,
          category,
          poster_id: userId,
          images: imageUrls,
          status: 'open',
          deadline: new Date(deadline).toISOString(), // Use the selected deadline
        })
        .select();

      if (error) {
        throw error;
      }

      // Redirect to the task page
      router.push(`/tasks/${data[0].id}`);

    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-background overflow-x-hidden">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageShell
          header={<h1 className="text-2xl font-bold text-gray-900 text-center">Post a New Task</h1>}
          darkSection={<p className="text-sm text-gray-300">Fill in the details below to post your task.</p>}
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-5 py-5">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Help me move furniture"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="input-field resize-none"
                  placeholder="Describe what you need help with in detail..."
                  required
                  style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
                    Budget ($)
                  </label>
                  <input
                    type="number"
                    id="budget"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    min="1"
                    step="0.01"
                    className="input-field"
                    placeholder="e.g., 50"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="input-field"
                  placeholder="e.g., New York, NY"
                  required
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  id="deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-1">
                  Task Images (Optional)
                </label>
                <input
                  type="file"
                  id="images"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary-dark"
                />

                {imagePreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <img
                        key={index}
                        src={preview}
                        alt={`Task preview ${index + 1}`}
                        className="h-40 object-cover rounded-md"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Posting...' : 'Post Task'}
                </button>
              </div>
            </div>
          </form>
        </PageShell>
      </div>
    </div>
  );
}