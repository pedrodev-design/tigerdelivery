import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function useStoreAccount() {
  const [state, setState] = useState({ user: null, profile: null, membership: null, store: null, loading: isSupabaseConfigured, error: '' })

  const load = useCallback(async userOverride => {
    if (!isSupabaseConfigured) {
      setState(previous => ({ ...previous, loading: false, error: 'Supabase não configurado.' }))
      return
    }
    const user = userOverride === undefined ? (await supabase.auth.getSession()).data.session?.user ?? null : userOverride
    if (!user) {
      setState({ user: null, profile: null, membership: null, store: null, loading: false, error: '' })
      return
    }
    setState(previous => ({ ...previous, user, loading: true, error: '' }))
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', user.id).maybeSingle(),
      supabase.from('store_members').select('store_id, member_role').eq('user_id', user.id).maybeSingle(),
    ])
    let storeResult = { data: null, error: null }
    if (membershipResult.data?.store_id) {
      storeResult = await supabase.from('stores').select('id, owner_id, name, category, cnpj, phone, city, address, description, logo_url, cover_url, status, review_notes, is_open, created_at').eq('id', membershipResult.data.store_id).maybeSingle()
    }
    const firstError = profileResult.error || membershipResult.error || storeResult.error
    setState({ user, profile: profileResult.data, membership: membershipResult.data, store: storeResult.data, loading: false, error: firstError ? 'Não foi possível carregar os dados da loja.' : '' })
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0)
    if (!isSupabaseConfigured) return undefined
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => window.setTimeout(() => load(session?.user ?? null), 0))
    return () => { window.clearTimeout(initialLoad); subscription.unsubscribe() }
  }, [load])

  return { ...state, refresh: () => load(state.user) }
}
