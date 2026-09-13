import { useState } from 'react'
import { validateLoginForm } from '../utils/validators'
import { getAuthMessage, isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Hook de autenticação — gerencia estado e lógica do login
 */
export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')

  /**
   * Realiza o login do usuário
   * @param {{ email: string, password: string }} credentials
   */
  async function login({ email, password }) {
    // Valida os campos antes de enviar
    const validationErrors = validateLoginForm({ email, password })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setServerError('')
    setLoading(true)

    try {
      if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      return data
    } catch (err) {
      setServerError(isSupabaseConfigured ? getAuthMessage(err) : 'A conexão com o Supabase ainda precisa das chaves do projeto.')
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, errors, serverError }
}
