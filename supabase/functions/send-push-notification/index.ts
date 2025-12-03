import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as webpush from 'npm:web-push@3.6.6'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
    notification_id: string
    user_id: string
    type: string
    title: string
    body: string
    data: any
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Configure web-push with VAPID keys
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

        console.log('VAPID Public Key length:', vapidPublicKey?.length)
        console.log('VAPID Private Key length:', vapidPrivateKey?.length)

        try {
            webpush.setVapidDetails(
                'mailto:support@sunomsi.app',
                vapidPublicKey,
                vapidPrivateKey
            )
        } catch (err) {
            console.error('Error setting VAPID details:', err)
            throw err
        }

        let payload: NotificationPayload = await req.json()

        console.log('Received payload:', JSON.stringify(payload))

        // Check if this is a Supabase Webhook payload
        // @ts-ignore
        if (payload.type === 'INSERT' && payload.table === 'messages' && payload.record) {
            console.log('Detected Webhook payload')
            // @ts-ignore
            const record = payload.record

            // Fetch sender's profile to get their name
            const { data: senderProfile } = await supabaseClient
                .from('profiles')
                .select('full_name')
                .eq('user_id', record.sender_id)
                .single()

            const senderName = senderProfile?.full_name || 'Someone'

            payload = {
                notification_id: record.id,
                user_id: record.receiver_id,
                type: 'message',
                title: `New message from ${senderName}`,
                body: record.content,
                data: {
                    url: `/messages/${record.sender_id}`,
                    sender_id: record.sender_id
                }
            }

            console.log('Normalized webhook payload:', payload)
        } else {
            console.log('Processing standard payload:', payload)
        }

        // Get user's push subscriptions
        const { data: subscriptions, error: subError } = await supabaseClient
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', payload.user_id)

        if (subError) {
            console.error('Error fetching subscriptions:', subError)
            throw subError
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('No push subscriptions found for user:', payload.user_id)
            return new Response(
                JSON.stringify({ message: 'No subscriptions found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        console.log(`Found ${subscriptions.length} subscription(s) for user`)

        // Send push notification to each subscription
        const pushPromises = subscriptions.map(async (subscription) => {
            try {
                const pushPayload = JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    type: payload.type,
                    icon: '/web-app-manifest-192x192.png',
                    badge: '/favicon-96x96.png',
                    ...payload.data
                })

                // Construct push subscription object
                const pushSubscription = {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dh,
                        auth: subscription.auth
                    }
                }

                console.log('Sending push to endpoint:', subscription.endpoint.substring(0, 50) + '...')

                // Send notification using web-push
                await webpush.sendNotification(pushSubscription, pushPayload)

                console.log('Push sent successfully')
                return true

            } catch (error) {
                console.error('Error sending push:', error)

                // If subscription is invalid (410 Gone) or Forbidden (403), remove it
                if (error.statusCode === 410 || error.statusCode === 403) {
                    console.log(`Removing invalid subscription (Status: ${error.statusCode})`)
                    await supabaseClient
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', subscription.id)
                }

                return { error: error.message, statusCode: error.statusCode }
            }
        })

        const results = await Promise.all(pushPromises)
        const successCount = results.filter(r => r === true).length

        console.log(`Sent ${successCount}/${subscriptions.length} push notifications`)

        return new Response(
            JSON.stringify({
                success: true,
                sent: successCount,
                total: subscriptions.length,
                errors: results.filter(r => r !== true)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error('Edge Function Error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack,
                details: error
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Return 200 so client can read the error body
            }
        )
    }
})
