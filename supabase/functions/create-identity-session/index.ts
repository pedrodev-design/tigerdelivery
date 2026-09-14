import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
  const appUrl = Deno.env.get('APP_URL') || request.headers.get('origin') || 'http://localhost:5173'
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecret) return json({ error: 'identity_provider_not_configured' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'authentication_required' }, 401)
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return json({ error: 'authentication_required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: application } = await admin.from('driver_applications').select('id, status').eq('user_id', user.id).maybeSingle()
  if (!application) return json({ error: 'driver_application_required' }, 403)
  const { data: existing } = await admin.from('driver_identity_verifications').select('provider_session_id, status').eq('user_id', user.id).maybeSingle()
  if (existing?.status === 'verified') return json({ error: 'identity_already_verified' }, 409)

  const form = new URLSearchParams()
  form.set('type', 'document')
  form.set('options[document][allowed_types][0]', 'id_card')
  form.set('options[document][allowed_types][1]', 'driving_license')
  form.set('options[document][allowed_types][2]', 'passport')
  form.set('options[document][require_live_capture]', 'true')
  form.set('options[document][require_matching_selfie]', 'true')
  form.set('provided_details[email]', user.email || '')
  form.set('return_url', `${appUrl.replace(/\/$/, '')}/#motorista`)
  form.set('metadata[user_id]', user.id)

  const stripeResponse = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripeSecret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const session = await stripeResponse.json()
  if (!stripeResponse.ok) return json({ error: 'identity_provider_error', detail: session?.error?.message || 'Stripe error' }, 502)

  const { error: saveError } = await admin.from('driver_identity_verifications').upsert({
    user_id: user.id,
    provider: 'stripe',
    provider_session_id: session.id,
    status: 'pending',
    failure_reason: null,
    checks: {},
    verified_at: null,
  }, { onConflict: 'user_id' })
  if (saveError) return json({ error: 'identity_record_error' }, 500)

  return json({ session_id: session.id, url: session.url })
})
