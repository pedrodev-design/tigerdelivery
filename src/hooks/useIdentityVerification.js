import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function useIdentityVerification(user) {
  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(Boolean(user && isSupabaseConfigured))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setVerification(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('driver_identity_verifications')
      .select('user_id, provider, provider_session_id, status, failure_reason, verified_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setVerification(data || null)
    setError(queryError ? 'Não foi possível consultar a verificação.' : '')
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (verification?.status !== 'pending') return undefined
    const interval = window.setInterval(refresh, 5000)
    return () => window.clearInterval(interval)
  }, [refresh, verification?.status])

  const start = useCallback(async () => {
    if (!supabase || !user) return false
    setStarting(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('create-identity-session', { body: {} })
    if (invokeError || !data?.url) {
      let providerError = data?.error || ''
      if (!providerError && invokeError?.context?.json) {
        try { providerError = (await invokeError.context.json())?.error || '' } catch { /* resposta sem JSON */ }
      }
      const message = providerError === 'identity_provider_not_configured'
        ? 'A verificação ainda não foi configurada. Adicione as chaves do Stripe nos Secrets do Supabase.'
        : providerError === 'driver_application_required'
          ? 'Envie o cadastro de motorista antes de iniciar a verificação.'
          : providerError === 'identity_already_verified'
            ? 'Sua identidade já foi conferida.'
            : providerError === 'identity_provider_error'
              ? 'O Stripe recusou a sessão. Confira a STRIPE_SECRET_KEY no Supabase.'
              : 'Não foi possível iniciar a verificação agora. Tente novamente em instantes.'
      setError(message)
      setStarting(false)
      return false
    }
    window.location.assign(data.url)
    return true
  }, [user])

  return { verification, loading, starting, error, start, refresh }
}
