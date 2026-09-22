import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function getAuthMessage(error, context) {
  const message = error?.message?.toLowerCase() || ''
  if (context === 'otp' && (message.includes('expired') || message.includes('invalid'))) return 'Esse código expirou ou está incorreto. Confira e tente novamente.'
  if (message.includes('otp_expired')) return 'Esse código expirou. Peça um novo código.'
  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (message.includes('user already registered')) return 'Já existe uma conta com este e-mail.'
  if (message.includes('user_already_registered') || message.includes('email_exists')) return 'Já existe uma conta com este e-mail. Entre com sua senha ou recupere o acesso.'
  if (message.includes('signup is disabled') || message.includes('signup_disabled')) return 'A criação de contas está temporariamente indisponível.'
  if (message.includes('database error saving new user')) return 'Não conseguimos concluir o cadastro com esses dados. Confira o CPF ou tente entrar em uma conta existente.'
  if (message.includes('email rate limit') || message.includes('over_email_send_rate_limit')) return 'Muitos códigos foram solicitados. Aguarde alguns minutos e tente novamente.'
  if (message.includes('failed to fetch') || message.includes('network')) return 'Sem conexão com o servidor. Confira sua internet e tente novamente.'
  if (message.includes('password should be')) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (message.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.'
  return 'Não foi possível concluir agora. Tente novamente em instantes.'
}
