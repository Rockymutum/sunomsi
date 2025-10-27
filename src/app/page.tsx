"use client";
import Link from 'next/link';

export default function Home() {
  return (
    <div className="bg-background min-h-[100svh] flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-6xl mx-auto text-center">
          <img src="/logo.png.PNG" alt="SUNOMSI logo" className="mx-auto mb-3 object-contain w-[113px] h-[113px] md:w-[192px] md:h-[192px] animate-logo" />
          <h1 className="text-3xl md:text-5xl font-extrabold mb-3 text-black tracking-tight animate-title">SUNOMSI</h1>
          <p className="text-base mb-6 max-w-2xl mx-auto text-gray-600 animate-subtitle">
            A digital and easy way to find jobs through your digits.
            <br />
            For the people by the people.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth?new=1" className="btn-primary px-6 py-2 text-base rounded-lg shadow-sm transform transition-transform duration-200 will-change-transform hover:scale-[1.02] active:scale-[0.99]">
              Get Started
            </Link>
          </div>
        </div>
      </section>

      

      
      <style jsx>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 1px 0 rgba(0,0,0,0.04)); }
          50% { transform: scale(1.03); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08)); }
        }
        .animate-logo { 
          animation: logoBreathe 6s ease-in-out 0.2s infinite, fadeInUp 700ms ease-out 0s both; 
        }
        .animate-title { 
          opacity: 0; 
          animation: fadeInUp 700ms ease-out 120ms both; 
        }
        .animate-subtitle { 
          opacity: 0; 
          animation: fadeInUp 700ms ease-out 240ms both; 
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-logo, .animate-title, .animate-subtitle { animation: none !important; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}