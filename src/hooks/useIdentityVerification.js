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
      setError(invokeError?.message || data?.error || 'Não foi possível iniciar a verificação agora.')
      setStarting(false)
      return false
    }
    window.location.assign(data.url)
    return true
  }, [user])

  return { verification, loading, starting, error, start, refresh }
}
