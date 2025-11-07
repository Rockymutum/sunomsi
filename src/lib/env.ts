// This file provides type-safe access to environment variables
// and validates them on app startup

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Validate required environment variables
if (typeof window === 'undefined') {
  // Server-side validation
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

// Client-side accessible environment variables
export const env = {
  // Next.js automatically exposes NEXT_PUBLIC_* environment variables
  // on the client side, so we can safely access them here
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  // Server-side only environment variables
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
  },
} as const;

// Type-safe environment variable access
type Env = typeof env;
declare global {
  // eslint-disable-next-line no-var
  var ENV: Env;
  interface Window {
    ENV: Env;
  }
}

// Make environment variables available globally
if (typeof window !== 'undefined') {
  window.ENV = env;
} else {
  global.ENV = env;
}

// This function can be used to get environment variables in a type-safe way
export function getEnv() {
  return env;
}
