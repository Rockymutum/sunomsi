import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/discovery';

    if (code) {
        try {
            const supabase = createRouteHandlerClient({ cookies });
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                console.error('OAuth callback error:', error);
                return NextResponse.redirect(new URL('/auth?error=oauth_failed', request.url));
            }

            if (data.user) {
                // Check if profile exists, create if not
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('user_id', data.user.id)
                    .single();

                if (!profile) {
                    // Create profile for OAuth user
                    await supabase
                        .from('profiles')
                        .insert({
                            user_id: data.user.id,
                            email: data.user.email,
                            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
                            avatar_url: data.user.user_metadata?.avatar_url || null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        });
                }
            }
        } catch (error) {
            console.error('OAuth exchange error:', error);
            return NextResponse.redirect(new URL('/auth?error=exchange_failed', request.url));
        }
    }

    // Redirect to discovery page after successful authentication
    return NextResponse.redirect(new URL(next, request.url));
}
