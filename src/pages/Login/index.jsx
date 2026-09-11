import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft as ArrowLeft,
  faArrowRight as ArrowRight,
  faCircleInfo as Info,
  faEnvelope as EnvelopeSimple,
  faLock as Lock,
  faUser as User,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { validateAuthForm } from '../../utils/validators'
import loginImage from '../../assets/images/img-login.png'
import styles from './Login.module.css'

const screens = {
  login: { title: 'Entre na sua conta', subtitle: 'Sua próxima refeição favorita começa aqui.', action: 'Entrar' },
  register: { title: 'Crie sua conta', subtitle: 'Seu próximo pedido começa por aqui.', action: 'Criar conta' },
  recover: { title: 'Esqueceu a senha?', subtitle: 'Informe o e-mail da sua conta para recuperar seu acesso.', action: 'Recuperar senha' },
}
const readMode = () => window.location.hash === '#criar-conta' ? 'register' : window.location.hash === '#recuperar-senha' ? 'recover' : 'login'
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
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [capsLock, setCapsLock] = useState(false)
  const heading = useRef(null)
  const screen = screens[mode]
  const register = mode === 'register'
  const recover = mode === 'recover'

  useEffect(() => {
    function onNavigate() {
      setMode(readMode())
      setErrors({})
      setNotice('')
      setCapsLock(false)
      setValues(previous => ({ ...previous, password: '', confirmPassword: '' }))
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('hashchange', onNavigate)
    return () => window.removeEventListener('hashchange', onNavigate)
  }, [])

  useEffect(() => {
    document.title = `${screen.title} — TigreFood`
  }, [screen.title])

  function update(field, value) {
    const next = { ...values, [field]: value }
    setValues(next)
    setNotice('')
    setErrors(previous => {
      const validation = validateAuthForm(mode, next)
      const updated = { ...previous }
      if (previous[field]) updated[field] = validation[field]
      if (field === 'password' && previous.confirmPassword) updated.confirmPassword = validation.confirmPassword
      return updated
    })
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = validateAuthForm(mode, values)
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length) {
      document.getElementById('auth-' + Object.keys(nextErrors)[0])?.focus()
      return
    }
    // Connect the authentication service here before enabling account creation.
    setNotice(recover
      ? 'A recuperação de senha ainda não está disponível. Nenhum e-mail foi enviado.'
      : register
        ? 'O cadastro ainda não está disponível. Seus dados não foram enviados.'
        : 'O acesso à conta ainda não está disponível. Tente novamente mais tarde.')
  }

  function field(name, label, type, placeholder, icon, autoComplete, hint) {
    return <Input key={mode + name} id={'auth-' + name} name={name} label={label} type={type} placeholder={placeholder}
      icon={<Icon icon={icon} />} autoComplete={autoComplete} value={values[name]}
      onChange={event => update(name, event.target.value)} onBlur={() => { if (type === 'password') setCapsLock(false) }}
      onKeyUp={type === 'password' ? event => setCapsLock(event.getModifierState('CapsLock')) : undefined}
      onKeyDown={type === 'password' ? event => setCapsLock(event.getModifierState('CapsLock')) : undefined}
      error={errors[name]} hint={hint} spellCheck={false} autoCapitalize={name === 'name' ? 'words' : 'none'} required />
  }

  return (
    <main className={styles.page}>
      <div className={styles.photo}>
        <img src={loginImage} alt="Tigre entregador em uma moto amarela pela cidade ao pôr do sol" fetchPriority="high" />
      </div>
      <section className={styles.panel} aria-labelledby="auth-title">
        <div className={styles.content}>
          {recover && <a className={styles.back} href="#entrar"><Icon icon={ArrowLeft} />Voltar para o login</a>}
          <header className={styles.header}>
            <h1 ref={heading} tabIndex={-1} id="auth-title" className={styles.title}>{screen.title}</h1>
            <p className={styles.subtitle}>{screen.subtitle}</p>
          </header>
          <form className={styles.form} onSubmit={submit} noValidate>
            {register && field('name', 'Seu nome', 'text', 'Como você gostaria de ser chamado?', User, 'name')}
            {field('email', 'E-mail', 'email', 'voce@email.com', EnvelopeSimple, 'email')}
            {!recover && field('password', 'Senha', 'password', register ? 'Crie uma senha' : 'Digite sua senha', Lock, register ? 'new-password' : 'current-password', register ? 'Use pelo menos 8 caracteres.' : undefined)}
            {register && field('confirmPassword', 'Confirme sua senha', 'password', 'Repita a senha', Lock, 'new-password')}
            {capsLock && <p className={styles.capsLock} role="status">A tecla Caps Lock está ativada.</p>}
            {!register && !recover && <div className={styles.forgotRow}><a className={styles.textLink} href="#recuperar-senha">Esqueceu a senha?</a></div>}
            <Button type="submit" fullWidth className={styles.submit}>{screen.action}<Icon icon={ArrowRight} /></Button>
          </form>
          {!recover && <>
            <div className={styles.divider} aria-hidden="true"><span />ou<span /></div>
            <Button variant="secondary" fullWidth type="button" className={styles.google} onClick={() => setNotice('O acesso com o Google ainda não está disponível. Tente novamente mais tarde.')}>
              <GoogleIcon />{register ? 'Continuar com o Google' : 'Entrar com o Google'}
            </Button>
            <footer className={styles.footer}>
              <span>{register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}</span>
              <a className={styles.textLink} href={register ? '#entrar' : '#criar-conta'}>{register ? 'Entrar' : 'Criar conta'}<Icon icon={ArrowRight} /></a>
            </footer>
          </>}
          {notice && <div className={styles.notice} role="status"><Icon icon={Info} /><p>{notice}</p></div>}
          <a className={styles.explore} href="#catalogo">Só quero dar uma olhada no cardápio <Icon icon={ArrowRight} /></a>
        </div>
      </section>
    </main>
  )
}

