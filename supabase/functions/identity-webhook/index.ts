import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, stripe-signature' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}

async function validSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map(item => item.split('=')))
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return constantTimeEqual(expected, signature)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const signature = request.headers.get('stripe-signature')
  const payload = await request.text()
  if (!secret || !serviceRoleKey || !supabaseUrl || !signature || !(await validSignature(payload, signature, secret))) return json({ error: 'invalid_signature' }, 400)

  let event: any
  try { event = JSON.parse(payload) } catch { return json({ error: 'invalid_payload' }, 400) }
  const supported = new Set(['identity.verification_session.verified', 'identity.verification_session.requires_input', 'identity.verification_session.canceled'])
  if (!supported.has(event.type)) return json({ received: true })

  const session = event.data?.object || {}
  const userId = session.metadata?.user_id
  if (!userId) return json({ received: true })
  const status = event.type.endsWith('.verified') ? 'verified' : event.type.endsWith('.canceled') ? 'canceled' : 'unverified'
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await admin.from('driver_identity_verifications').upsert({
    user_id: userId,
    provider: 'stripe',
    provider_session_id: session.id,
    status,
    failure_reason: session.last_error?.reason || session.last_error?.code || null,
    checks: { document: session.document || null, verified_outputs: session.verified_outputs || null },
    verified_at: status === 'verified' ? new Date().toISOString() : null,
  }, { onConflict: 'user_id' })
  if (error) return json({ error: 'identity_record_error' }, 500)
  return json({ received: true })
})
