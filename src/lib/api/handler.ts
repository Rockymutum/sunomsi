import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Rate limiting setup
const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100, // Limit each IP to 100 requests per windowMs
};

const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface ApiHandlerOptions {
  methods: string[];
  authenticated?: boolean;
  rateLimited?: boolean;
}

export function createApiHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: ApiHandlerOptions = { methods: ['GET'], authenticated: false, rateLimited: true }
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Check allowed methods
    if (!options.methods.includes(req.method || '')) {
      return res.status(405).json({ 
        success: false, 
        error: `Method ${req.method} Not Allowed` 
      });
    }

    // Rate limiting
    if (options.rateLimited) {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
      const now = Date.now();
      
      if (!rateLimitCache.has(ip)) {
        rateLimitCache.set(ip, { count: 1, resetTime: now + RATE_LIMIT.WINDOW_MS });
      } else {
        const record = rateLimitCache.get(ip)!;
        
        if (now > record.resetTime) {
          // Reset the counter
          record.count = 1;
          record.resetTime = now + RATE_LIMIT.WINDOW_MS;
        } else if (record.count >= RATE_LIMIT.MAX_REQUESTS) {
          return res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
          });
        } else {
          record.count += 1;
        }
      }
    }

    // Authentication check
    if (options.authenticated) {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        });
      }

      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token' 
          });
        }

        // Add user to request object for use in route handlers
        (req as any).user = user;
      } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Authentication failed' 
        });
      }
    }

    // Execute the route handler
    try {
      await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : errorMessage,
      });
    }
  };
}

// Helper function to send standardized responses
export function sendResponse<T>(
  res: NextApiResponse,
  status: number,
  data: T | null = null,
  error: string | null = null
) {
  return res.status(status).json({
    success: status >= 200 && status < 300,
    data,
    error,
  });
}
