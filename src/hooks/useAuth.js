import { useState } from 'react'
import { validateLoginForm } from '../utils/validators'

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
      // TODO: Substituir pela chamada real à API
      await fakeLoginRequest({ email, password })
      // Sucesso: redirecionar ou salvar token
      console.log('Login realizado com sucesso!')
    } catch (err) {
      setServerError(err.message || 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, errors, serverError }
}

// ─── Simulação de requisição ──────────────────────────────────────────────────
function fakeLoginRequest({ email, password }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'admin@delivery.com' && password === '123456') {
        resolve({ token: 'fake-jwt-token' })
      } else {
        reject(new Error('E-mail ou senha incorretos'))
      }
    }, 1500)
  })
}
