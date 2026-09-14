import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft as ArrowLeft,
  faArrowRight as ArrowRight,
  faCircleInfo as Info,
  faEnvelope as EnvelopeSimple,
  faIdCard as IdCard,
  faLock as Lock,
  faUser as User,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '../../components/ui/Button'
import { LoadingOverlay } from '../../components/ui/LoadingOverlay'
import { Input } from '../../components/ui/Input'
import { formatCpf, validateAuthForm } from '../../utils/validators'
import { getAuthMessage, isSupabaseConfigured, supabase } from '../../lib/supabase'
import loginImage from '../../assets/images/img-login.png'
import styles from './Login.module.css'

const screens = {
  login: { title: 'Entre na sua conta', subtitle: 'Sua próxima refeição favorita começa aqui.', action: 'Entrar' },
  register: { title: 'Crie sua conta', subtitle: 'Seu próximo pedido começa por aqui.', action: 'Criar conta' },
  recover: { title: 'Esqueceu a senha?', subtitle: 'Informe o e-mail da sua conta para recuperar seu acesso.', action: 'Recuperar senha' },
  verify: { title: 'Confira seu e-mail', subtitle: 'Digite o código de 6 números que enviamos para você.', action: 'Confirmar código' },
}
const readMode = () => window.location.hash === '#criar-conta' ? 'register' : window.location.hash === '#recuperar-senha' ? 'recover' : window.location.hash === '#verificar-email' ? 'verify' : 'login'
const pendingSignupKey = 'tigrefood.pending-signup'
const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />

function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.41h11a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.56 6.08-8.8 6.08-14.81Z" />
      <path fill="#34A853" d="M24 44c5.52 0 10.15-1.83 13.53-4.97l-6.61-5.14c-1.83 1.23-4.18 1.98-6.92 1.98-5.32 0-9.85-3.59-11.47-8.42H5.71v5.29A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.53 27.45a12 12 0 0 1 0-6.9v-5.29H5.71a20 20 0 0 0 0 17.48l6.82-5.29Z" />
      <path fill="#EA4335" d="M24 12.13c3.01 0 5.69 1.04 7.82 3.09l5.86-5.86A19.65 19.65 0 0 0 24 4 20 20 0 0 0 5.71 15.26l6.82 5.29c1.62-4.83 6.15-8.42 11.47-8.42Z" />
    </svg>
  )
}

export function LoginPage() {
  const [mode, setMode] = useState(readMode)
  const [values, setValues] = useState({ name: '', cpf: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [touched, setTouched] = useState({})
  const [success, setSuccess] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [pendingSignup, setPendingSignup] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(pendingSignupKey)) || null } catch { return null }
  })
  const heading = useRef(null)
  const otpRefs = useRef([])
  const screen = screens[mode]
  const register = mode === 'register'
  const recover = mode === 'recover'
  const verify = mode === 'verify'

  useEffect(() => {
    function onNavigate() {
      setMode(readMode())
      setErrors({})
      setNotice('')
      setCapsLock(false)
      setTouched({})
      setSuccess(false)
      setOtpError(false)
      setValues(previous => ({ ...previous, password: '', confirmPassword: '' }))
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('hashchange', onNavigate)
    return () => window.removeEventListener('hashchange', onNavigate)
  }, [])

  useEffect(() => {
    document.title = `${screen.title} — TigreFood`
  }, [screen.title])

  useEffect(() => {
    if (!resendIn) return undefined
    const timer = window.setInterval(() => setResendIn(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  useEffect(() => {
    if (verify && !pendingSignup?.email) window.location.hash = '#criar-conta'
  }, [verify, pendingSignup])

  useEffect(() => {
    if (!verify || !pendingSignup?.email) return
    const focusTimer = window.setTimeout(() => otpRefs.current[0]?.focus(), 80)
    return () => window.clearTimeout(focusTimer)
  }, [verify, pendingSignup?.email])

  function update(field, value) {
    const next = { ...values, [field]: field === 'cpf' ? formatCpf(value) : value }
    setValues(next)
    setNotice('')
    setErrors(previous => {
      const validation = validateAuthForm(mode, next)
      const updated = { ...previous }
      if (touched[field] || previous[field]) {
        if (validation[field]) updated[field] = validation[field]
        else delete updated[field]
      }
      if (field === 'password' && (touched.confirmPassword || previous.confirmPassword)) {
        if (validation.confirmPassword) updated.confirmPassword = validation.confirmPassword
        else delete updated.confirmPassword
      }
      return updated
    })
  }

  function blurField(field, type) {
    setTouched(previous => ({ ...previous, [field]: true }))
    if (type === 'password') setCapsLock(false)
    const validation = validateAuthForm(mode, values)
    setErrors(previous => {
      const updated = { ...previous }
      if (validation[field]) updated[field] = validation[field]
      else delete updated[field]
      return updated
    })
  }

  async function enterCatalog(session) {
    if (!session?.access_token || !session?.refresh_token) throw new Error('Sessão não criada')
    const { error: sessionError } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    if (sessionError) throw sessionError
    const { data: stored, error: storedError } = await supabase.auth.getSession()
    if (storedError || !stored.session) throw storedError || new Error('Sessão não persistida')
    setSuccess(true)
    await new Promise(resolve => window.setTimeout(resolve, 320))
    window.location.hash = '#catalogo'
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateAuthForm(mode, values)
    const required = recover ? ['email'] : register ? ['name', 'cpf', 'email', 'password', 'confirmPassword'] : ['email', 'password']
    setTouched(Object.fromEntries(required.map(field => [field, true])))
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length) {
      document.getElementById('auth-' + Object.keys(nextErrors)[0])?.focus()
      return
    }
    if (!isSupabaseConfigured) {
      setNotice('A conexão com o Supabase ainda precisa das chaves do projeto.')
      return
    }

    setLoading(true)
    try {
      if (recover) {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email.trim(), {
          redirectTo: `${window.location.origin}/#entrar`,
        })
        if (error) throw error
        setNotice('Enviamos as instruções de recuperação para o seu e-mail.')
        return
      }

      if (register) {
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            data: { full_name: values.name.trim(), cpf: values.cpf.replace(/\D/g, '') },
            emailRedirectTo: `${window.location.origin}/#catalogo`,
          },
        })
        if (error) throw error
        if (data.session) await enterCatalog(data.session)
        else {
          const pending = { email: values.email.trim(), name: values.name.trim() }
          sessionStorage.setItem(pendingSignupKey, JSON.stringify(pending))
          setPendingSignup(pending)
          setOtp(['', '', '', '', '', ''])
          setResendIn(60)
          window.location.hash = '#verificar-email'
        }
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      })
      if (error) throw error
      await enterCatalog(data.session)
    } catch (error) {
      setNotice(getAuthMessage(error))
    } finally {
      setLoading(false)
    }
  }

  function updateOtp(index, rawValue) {
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      setOtp(current => current.map((value, position) => position === index ? '' : value))
      setOtpError(false)
      return
    }
    const next = [...otp]
    digits.slice(0, 6 - index).split('').forEach((digit, offset) => { next[index + offset] = digit })
    setOtp(next)
    setOtpError(false)
    setNotice('')
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus()
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
      setOtp(current => current.map((value, position) => position === index - 1 ? '' : value))
    }
    if (event.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpPaste(event) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    event.preventDefault()
    const next = Array.from({ length: 6 }, (_, index) => digits[index] || '')
    setOtp(next)
    setOtpError(false)
    otpRefs.current[Math.min(digits.length, 6) - 1]?.focus()
  }

  async function verifyCode(event) {
    event.preventDefault()
    const token = otp.join('')
    if (token.length !== 6) {
      setOtpError(true)
      setNotice('Digite os 6 números do código enviado por e-mail.')
      otpRefs.current[otp.findIndex(value => !value)]?.focus()
      return
    }
    setLoading(true)
    setNotice('')
    setOtpError(false)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: pendingSignup.email, token, type: 'email' })
      if (error) throw error
      await enterCatalog(data.session)
      sessionStorage.removeItem(pendingSignupKey)
    } catch (error) {
      setOtpError(true)
      setNotice(getAuthMessage(error, 'otp'))
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (resendIn || loading || !pendingSignup?.email) return
    setLoading(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingSignup.email })
      if (error) throw error
      setOtp(['', '', '', '', '', ''])
      setResendIn(60)
      setNotice('Enviamos um novo código. Confira também a caixa de spam.')
      requestAnimationFrame(() => otpRefs.current[0]?.focus())
    } catch (error) {
      setNotice(getAuthMessage(error, 'otp'))
    } finally {
      setLoading(false)
    }
  }

  async function continueWithGoogle() {
    if (!isSupabaseConfigured) {
      setNotice('A conexão com o Supabase ainda precisa das chaves do projeto.')
      return
    }
    setLoading(true)
    setNotice('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setNotice(getAuthMessage(error))
      setLoading(false)
    }
  }

  function field(name, label, type, placeholder, icon, autoComplete, hint) {
    const validation = validateAuthForm(mode, values)
    const valid = Boolean(touched[name] && String(values[name]).trim() && !validation[name])
    return <Input key={mode + name} id={'auth-' + name} name={name} label={label} type={type} placeholder={placeholder}
      icon={<Icon icon={icon} />} autoComplete={autoComplete} value={values[name]}
      onChange={event => update(name, event.target.value)} onBlur={() => blurField(name, type)} valid={valid}
      onKeyUp={type === 'password' ? event => setCapsLock(event.getModifierState('CapsLock')) : undefined}
      onKeyDown={type === 'password' ? event => setCapsLock(event.getModifierState('CapsLock')) : undefined}
      inputMode={name === 'cpf' ? 'numeric' : undefined} maxLength={name === 'cpf' ? 14 : undefined}
      error={errors[name]} hint={hint} spellCheck={false} autoCapitalize={name === 'name' ? 'words' : 'none'} required />
  }

  return (
    <main className={styles.page}>
      <div className={styles.photo}>
        <img src={loginImage} alt="Tigre entregador em uma moto amarela pela cidade ao pôr do sol" fetchPriority="high" />
      </div>
      <section className={styles.panel} aria-labelledby="auth-title">
        <div className={styles.content}>
          {(recover || verify) && <a className={styles.back} href={verify ? '#criar-conta' : '#entrar'}><Icon icon={ArrowLeft} />{verify ? 'Alterar e-mail' : 'Voltar para o login'}</a>}
          <header className={styles.header}>
            <h1 ref={heading} tabIndex={-1} id="auth-title" className={styles.title}>{screen.title}</h1>
            <p className={styles.subtitle}>{screen.subtitle}</p>
            {verify && pendingSignup?.email && <p className={styles.sentTo}>{pendingSignup.email}</p>}
          </header>
          {verify ? <form className={styles.otpForm} onSubmit={verifyCode} noValidate>
            <fieldset className={`${styles.otpFieldset} ${otpError ? styles.otpInvalid : ''} ${success ? styles.otpVerified : ''}`}>
              <legend className="sr-only">Código de verificação</legend>
              <div className={styles.otpGrid} onPaste={handleOtpPaste}>
                {otp.map((digit, index) => <input
                  key={index}
                  ref={element => { otpRefs.current[index] = element }}
                  className={styles.otpInput}
                  value={digit}
                  onChange={event => updateOtp(index, event.target.value)}
                  onKeyDown={event => handleOtpKeyDown(index, event)}
                  onFocus={event => event.currentTarget.select()}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Número ${index + 1} do código`}
                  aria-invalid={otpError}
                  disabled={loading}
                />)}
              </div>
            </fieldset>
            <Button type="submit" fullWidth loading={loading} success={success} loadingLabel={success ? 'Conta confirmada' : 'Confirmando código'} className={`${styles.submit} ${success ? styles.successButton : ''}`}>{screen.action}<Icon icon={ArrowRight} /></Button>
            <div className={styles.resendRow}>
              <span>Não recebeu?</span>
              <button type="button" onClick={resendCode} disabled={Boolean(resendIn) || loading}>
                {resendIn ? `Reenviar em 0:${String(resendIn).padStart(2, '0')}` : 'Enviar outro código'}
              </button>
            </div>
          </form> : <form className={styles.form} onSubmit={submit} noValidate>
            {register && field('name', 'Seu nome', 'text', 'Como você gostaria de ser chamado?', User, 'name')}
            {register && field('cpf', 'CPF', 'text', '000.000.000-00', IdCard, 'off', 'Seu CPF fica protegido e não aparece no catálogo.')}
            {field('email', 'E-mail', 'email', 'voce@email.com', EnvelopeSimple, 'email')}
            {!recover && field('password', 'Senha', 'password', register ? 'Crie uma senha' : 'Digite sua senha', Lock, register ? 'new-password' : 'current-password', register ? 'Use pelo menos 8 caracteres.' : undefined)}
            {register && field('confirmPassword', 'Confirme sua senha', 'password', 'Repita a senha', Lock, 'new-password')}
            {capsLock && <p className={styles.capsLock} role="status">A tecla Caps Lock está ativada.</p>}
            {!register && !recover && <div className={styles.forgotRow}><a className={styles.textLink} href="#recuperar-senha">Esqueceu a senha?</a></div>}
            <Button type="submit" fullWidth loading={loading} success={success} loadingLabel={success ? 'Tudo certo' : recover ? 'Enviando e-mail' : register ? 'Criando sua conta' : 'Entrando'} className={`${styles.submit} ${success ? styles.successButton : ''}`}>{screen.action}<Icon icon={ArrowRight} /></Button>
          </form>}
          {!recover && !verify && <>
            <div className={styles.divider} aria-hidden="true"><span />ou<span /></div>
            <Button variant="secondary" fullWidth type="button" loading={loading} loadingLabel="Abrindo o Google" className={styles.google} onClick={continueWithGoogle}>
              <GoogleIcon />{register ? 'Continuar com o Google' : 'Entrar com o Google'}
            </Button>
            <footer className={styles.footer}>
              <span>{register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}</span>
              <a className={styles.textLink} href={register ? '#entrar' : '#criar-conta'}>{register ? 'Entrar' : 'Criar conta'}<Icon icon={ArrowRight} /></a>
            </footer>
          </>}
          {notice && <div className={styles.notice} role="status"><Icon icon={Info} /><p>{notice}</p></div>}
          {!verify && <a className={styles.explore} href="#catalogo">Só quero dar uma olhada no cardápio <Icon icon={ArrowRight} /></a>}
        </div>
      </section>
      <AnimatePresence>{loading && <LoadingOverlay label={verify ? 'Quase lá' : 'Só um instante'} detail={verify ? 'Conferindo seu código com segurança.' : 'Estamos cuidando do seu acesso.'} />}</AnimatePresence>
    </main>
  )
}

