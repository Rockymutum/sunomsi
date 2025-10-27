"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function CheckEmailPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100svh] flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Check Your Email</h1>
        <p className="text-gray-700 mb-6">
          A confirmation link has been sent to your email address. Please click the link
          in the email to verify your account and complete the signup process.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You may need to check your spam folder.
        </p>
        <button
          onClick={() => router.push('/auth')}
          className="btn-primary w-full"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}