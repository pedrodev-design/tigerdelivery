import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function useAccount() {
  const [state, setState] = useState({
    user: null,
    profile: null,
    role: null,
    application: null,
    identityVerification: null,
    loading: isSupabaseConfigured,
    error: '',
  })

  const load = useCallback(async userOverride => {
    if (!isSupabaseConfigured) {
      setState(previous => ({ ...previous, loading: false, error: 'Supabase não configurado.' }))
      return
    }

    const user = userOverride === undefined
      ? (await supabase.auth.getSession()).data.session?.user ?? null
      : userOverride

    if (!user) {
      setState({ user: null, profile: null, role: null, application: null, identityVerification: null, loading: false, error: '' })
      return
    }

    setState(previous => ({ ...previous, user, loading: true, error: '' }))
    const [profileResult, roleResult, applicationResult, identityResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, cpf').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('driver_applications').select('id, user_id, phone, vehicle_type, vehicle_plate, city, status, review_notes, submitted_at, reviewed_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('driver_identity_verifications').select('user_id, provider, provider_session_id, status, failure_reason, verified_at, updated_at').eq('user_id', user.id).maybeSingle(),
    ])

    const firstError = profileResult.error || roleResult.error || applicationResult.error || (identityResult.error?.code === '42P01' ? null : identityResult.error)
    setState({
      user,
      profile: profileResult.data,
      role: roleResult.data?.role || 'customer',
      application: applicationResult.data,
      identityVerification: identityResult.data,
      loading: false,
      error: firstError ? 'Não foi possível carregar os dados da conta.' : '',
    })
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0)
    if (!isSupabaseConfigured) return undefined
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => load(session?.user ?? null), 0)
    })
    return () => { window.clearTimeout(initialLoad); subscription.unsubscribe() }
  }, [load])

  return { ...state, refresh: () => load(state.user) }
}
