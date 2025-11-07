'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // If user is authenticated, redirect to discovery page
          router.replace('/discovery');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    };

    checkAuth();
  }, [router, supabase]);

  // Show loading state while checking auth
  const LoadingState = () => (
    <div className="min-h-[100svh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  // Only show the landing page if not authenticated
  return (
    <div className="bg-background min-h-[100svh] flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-6xl mx-auto text-center">
          <img 
            src="/logo.png.PNG" 
            alt="SUNOMSI logo" 
            className="mx-auto mb-3 object-contain w-[113px] h-[113px] md:w-[192px] md:h-[192px]" 
            loading="eager"
            fetchPriority="high"
          />
          <h1 className="text-3xl md:text-5xl font-extrabold mb-3 text-black tracking-tight">SUNOMSI</h1>
          <p className="text-base mb-6 max-w-2xl mx-auto text-gray-600">
            A digital and easy way to find jobs through your digits.
            <br />
            For the people by the people.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link 
              href="/auth?new=1" 
              className="btn-primary px-6 py-2 text-base rounded-lg shadow-sm hover:bg-gray-700 transition-colors"
              prefetch={false}
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}