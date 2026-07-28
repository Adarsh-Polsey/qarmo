import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server environment misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      }
    })

    // Get current authenticated user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get body parameters
    const body = await req.json()
    const { fullName, photoUrl, roles, city, vehicles, referralCode } = body

    if (!fullName || !roles || !city || !vehicles) {
      return new Response(
        JSON.stringify({ error: 'Missing required profile fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format vehicles for SQL RPC
    const vehiclesToInsert = roles.map((role: string) => {
      const v = vehicles[role]
      return {
        role: role,
        vehicle_type: v.vehicleType,
        registration_number: v.registrationNumber,
      }
    })

    // Call the atomic complete_profile RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('complete_profile', {
      user_id: user.id,
      full_name: fullName,
      photo_url: photoUrl || null,
      roles: roles,
      city: city,
      vehicles: vehiclesToInsert,
      referral_code: referralCode || ''
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: 'Failed to complete profile: ' + rpcError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (rpcData && rpcData.success === false) {
      return new Response(
        JSON.stringify({ error: rpcData.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userReferralCode = rpcData?.referral_code
    const referrerPushTokens: string[] = rpcData?.referrer_push_tokens || []

    // Send push notification to referrer on referral award (H3)
    if (referrerPushTokens.length > 0) {
      const messages = referrerPushTokens.map((token: string) => ({
        to: token,
        sound: 'default',
        body: `🎉 ${fullName} joined with your code — you earned 50 points!`,
      }))

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        })
        if (!response.ok) {
          console.error('Expo push notification error:', await response.text())
        }
      } catch (err) {
        console.error('Failed to send push notification:', err)
      }
    }

    return new Response(
      JSON.stringify({ success: true, referral_code: userReferralCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
