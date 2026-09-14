import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faBicycle,
  faCar,
  faCheck,
  faChevronRight,
  faClock,
  faCircleCheck,
  faHeadset,
  faHelmetSafety,
  faIdCard,
  faLocationDot,
  faLock,
  faMotorcycle,
  faPhone,
  faReceipt,
  faRotate,
  faShieldHalved,
  faStar,
  faWallet,
} from '@fortawesome/free-solid-svg-icons'
import { AnimatePresence, motion } from 'motion/react'
import { useAccount } from '../../hooks/useAccount'
import { useIdentityVerification } from '../../hooks/useIdentityVerification'
import { LoadingOverlay } from '../../components/ui/LoadingOverlay'
import { formatCpf, formatPhone, isValidCpf, onlyDigits } from '../../utils/validators'
import { supabase } from '../../lib/supabase'
import styles from './Driver.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
const vehicles = [
  { id: 'motorcycle', label: 'Moto', icon: faMotorcycle },
  { id: 'bicycle', label: 'Bicicleta', icon: faBicycle },
  { id: 'car', label: 'Carro', icon: faCar },
]

function Shell({ children, eyebrow = 'PARCEIROS TIGREFOOD' }) {
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="#catalogo" aria-label="Voltar ao TigreFood"><Icon icon={faArrowLeft} /></a>
      <div><small>{eyebrow}</small><strong>Tigre Entregas</strong></div>
      <span className={styles.headerMark}><Icon icon={faHelmetSafety} /></span>
    </header>
    {children}
  </main>
}

function Gate({ title, text, action = 'Entrar na minha conta', href = '#entrar', icon = faLock }) {
  return <Shell><section className={styles.centerState}>
    <span><Icon icon={icon} /></span><h1>{title}</h1><p>{text}</p>
    <a href={href}>{action}<Icon icon={faArrowRight} /></a>
  </section></Shell>
}

function DriverHome({ account }) {
  const [online, setOnline] = useState(false)
  const [toast, setToast] = useState('')
  const firstName = account.profile?.full_name?.split(' ')[0] || 'Parceiro'
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2200) }

  return <Shell eyebrow="ÁREA DO ENTREGADOR">
    <section className={styles.driverHome}>
      <div className={styles.driverIntro}>
        <div><p>Olá, {firstName}</p><h1>{online ? 'Você está disponível' : 'Pronto para rodar?'}</h1></div>
        <button className={online ? styles.onlineSwitch : ''} onClick={() => setOnline(value => !value)} aria-pressed={online}>
          <i /><span>{online ? 'Online' : 'Offline'}</span>
        </button>
      </div>

      <motion.section className={`${styles.availabilityCard} ${online ? styles.available : ''}`} layout>
        <span className={styles.radar}><i /><Icon icon={online ? faLocationDot : faMotorcycle} /></span>
        <div><small>{online ? 'BUSCANDO POR PERTO' : 'VOCÊ ESTÁ OFFLINE'}</small><h2>{online ? 'Procurando a melhor entrega' : 'Fique online para receber pedidos'}</h2><p>{online ? 'Quando aparecer uma boa rota, você vê o valor antes de aceitar.' : 'Você escolhe quando começar e pode parar a qualquer momento.'}</p></div>
      </motion.section>

      <section className={styles.earnings}>
        <div><small>GANHOS DE HOJE</small><strong>R$ 0,00</strong><span>Nenhuma entrega finalizada</span></div>
        <button onClick={() => notify('O extrato será exibido quando houver entregas')}><Icon icon={faWallet} /></button>
      </section>

      <div className={styles.metrics}>
        <article><Icon icon={faReceipt} /><div><strong>0</strong><span>entregas hoje</span></div></article>
        <article><Icon icon={faStar} /><div><strong>—</strong><span>avaliação</span></div></article>
        <article><Icon icon={faClock} /><div><strong>0h</strong><span>tempo online</span></div></article>
      </div>

      <section className={styles.driverMenu}>
        <h2>Sua rotina</h2>
        <button onClick={() => notify('Ainda não há entregas no histórico')}><span><Icon icon={faReceipt} />Histórico de entregas</span><Icon icon={faChevronRight} /></button>
        <button onClick={() => notify('Seus documentos estão aprovados')}><span><Icon icon={faShieldHalved} />Documentos e segurança</span><Icon icon={faChevronRight} /></button>
        <button onClick={() => notify('Central do parceiro disponível em breve')}><span><Icon icon={faHeadset} />Ajuda para entregadores</span><Icon icon={faChevronRight} /></button>
      </section>
    </section>
    <AnimatePresence>{toast && <motion.div className={styles.toast} initial={{ opacity: 0, y: 12, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 8, x: '-50%' }}>{toast}</motion.div>}</AnimatePresence>
  </Shell>
}

function IdentityCard({ verification, onStart, starting, error }) {
  const status = verification?.status || 'not_started'
  const isVerified = status === 'verified'
  const isPending = status === 'pending'
  const isFailed = status === 'unverified' || status === 'canceled'
  const title = isVerified ? 'Identidade conferida' : isPending ? 'Verificação em andamento' : isFailed ? 'Precisamos tentar novamente' : 'Confirme sua identidade'
  const text = isVerified
    ? 'Documento e selfie conferidos com segurança.'
    : isPending
      ? 'Você pode fechar esta tela. Avisaremos assim que terminar.'
      : isFailed
        ? 'O documento ou a selfie não puderam ser confirmados. Faça uma nova captura.'
        : 'Envie um documento oficial e uma selfie rápida para liberar sua análise.'
  return <section className={`${styles.identityCard} ${isVerified ? styles.identityVerified : ''}`}>
    <span className={styles.identityCardIcon}><Icon icon={isVerified ? faCircleCheck : faIdCard} /></span>
    <div className={styles.identityCardCopy}><strong>{title}</strong><p>{text}</p>{!isVerified && !isPending && <small className={styles.identityConsent}>A captura é feita em ambiente seguro e usada somente nesta análise.</small>}{error && <small className={styles.identityError}>{error}</small>}</div>
    {!isVerified && !isPending && <button type="button" className={styles.identityAction} onClick={onStart} disabled={starting}>{starting ? <i className={styles.spinner} /> : <>{isFailed ? 'Tentar novamente' : 'Verificar agora'}<Icon icon={faArrowRight} /></>}</button>}
    {isPending && <span className={styles.identityPending}><i />Em análise</span>}
  </section>
}

function Status({ application, onEdit, identityVerification, onStartIdentity, identityStarting, identityError }) {
  const pending = application.status === 'pending'
  return <Shell><section className={styles.statusPage}>
    <span className={`${styles.statusIcon} ${pending ? styles.statusPending : styles.statusRejected}`}><Icon icon={pending ? faClock : faRotate} /></span>
    <p className={styles.kicker}>{pending ? 'CADASTRO RECEBIDO' : 'PRECISAMOS DE UMA CORREÇÃO'}</p>
    <h1>{pending ? 'Estamos conferindo seus dados' : 'Seu cadastro voltou para revisão'}</h1>
    <p>{pending ? 'A análise é feita pela equipe TigreFood. Assim que for aprovado, esta tela vira automaticamente sua área de entregas.' : application.review_notes || 'Confira seus dados e envie novamente para uma nova análise.'}</p>
    <div className={styles.timeline}>
      <div className={styles.done}><i><Icon icon={faCheck} /></i><span><strong>Cadastro enviado</strong><small>Dados recebidos com segurança</small></span></div>
      <div className={pending ? styles.current : styles.attention}><i>{pending ? '2' : '!'}</i><span><strong>{pending ? 'Análise da equipe' : 'Ajuste necessário'}</strong><small>{pending ? 'Identidade, CPF e veículo' : 'Revise as informações indicadas'}</small></span></div>
      <div><i>3</i><span><strong>Conta de motorista</strong><small>Liberada somente após aprovação</small></span></div>
    </div>
    <IdentityCard verification={identityVerification} onStart={onStartIdentity} starting={identityStarting} error={identityError} />
    {pending ? <a className={styles.darkAction} href="#catalogo">Voltar ao TigreFood<Icon icon={faArrowRight} /></a> : <button className={styles.primaryAction} onClick={onEdit}>Corrigir meu cadastro<Icon icon={faArrowRight} /></button>}
  </section></Shell>
}

function ApplicationForm({ account, onSent }) {
  const [values, setValues] = useState({
    cpf: formatCpf(account.profile?.cpf || ''),
    phone: formatPhone(account.application?.phone || ''),
    city: account.application?.city || '',
    vehicle: account.application?.vehicle_type || 'motorcycle',
    plate: account.application?.vehicle_plate || '',
  })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const needsPlate = values.vehicle !== 'bicycle'

  const vehicleLabel = useMemo(() => vehicles.find(item => item.id === values.vehicle)?.label, [values.vehicle])
  function update(name, value) {
    const normalized = name === 'cpf' ? formatCpf(value) : name === 'phone' ? formatPhone(value) : name === 'plate' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : value
    setValues(previous => ({ ...previous, [name]: normalized }))
    setErrors(previous => ({ ...previous, [name]: '' }))
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!isValidCpf(values.cpf)) nextErrors.cpf = 'Confira os números do CPF.'
    if (!/^\d{10,11}$/.test(onlyDigits(values.phone))) nextErrors.phone = 'Informe um telefone com DDD.'
    if (values.city.trim().length < 2) nextErrors.city = 'Informe sua cidade.'
    if (needsPlate && !/^[A-Z0-9]{7,8}$/.test(values.plate)) nextErrors.plate = 'Confira a placa do veículo.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setLoading(true)
    setNotice('')
    const { error } = await supabase.rpc('submit_driver_application', {
      p_cpf: onlyDigits(values.cpf),
      p_phone: onlyDigits(values.phone),
      p_vehicle_type: values.vehicle,
      p_vehicle_plate: needsPlate ? values.plate : '',
      p_city: values.city.trim(),
    })
    setLoading(false)
    if (error) {
      setNotice(error.message.includes('cpf_already_registered') ? 'Este CPF já está ligado a outra conta.' : 'Não foi possível enviar agora. Confira os dados e tente novamente.')
      return
    }
    await account.refresh()
    onSent()
  }

  return <Shell><section className={styles.application}>
    <div className={styles.applicationIntro}><p className={styles.kicker}>ENTREGUE COM A TIGREFOOD</p><h1>Faça seu horário.<br />A cidade é sua.</h1><p>Complete o cadastro para nossa equipe analisar. A área de entregas só aparece depois da aprovação.</p></div>
    <form onSubmit={submit} noValidate>
      <div className={styles.formSection}><span>1</span><div><h2>Seus dados</h2><p>Usados somente para validar sua identidade.</p></div></div>
      <label className={errors.cpf ? styles.invalid : ''}><span><Icon icon={faIdCard} />CPF</span><input value={values.cpf} onChange={event => update('cpf', event.target.value)} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />{errors.cpf && <small>{errors.cpf}</small>}</label>
      <label className={errors.phone ? styles.invalid : ''}><span><Icon icon={faPhone} />Celular com DDD</span><input value={values.phone} onChange={event => update('phone', event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" />{errors.phone && <small>{errors.phone}</small>}</label>
      <label className={errors.city ? styles.invalid : ''}><span><Icon icon={faLocationDot} />Cidade onde quer entregar</span><input value={values.city} onChange={event => update('city', event.target.value)} autoComplete="address-level2" placeholder="Sua cidade" />{errors.city && <small>{errors.city}</small>}</label>

      <div className={styles.formSection}><span>2</span><div><h2>Como você entrega?</h2><p>Escolha o veículo que você usa no dia a dia.</p></div></div>
      <div className={styles.vehicles} role="radiogroup" aria-label="Veículo">
        {vehicles.map(item => <button key={item.id} type="button" role="radio" aria-checked={values.vehicle === item.id} onClick={() => update('vehicle', item.id)} className={values.vehicle === item.id ? styles.vehicleActive : ''}><Icon icon={item.icon} /><span>{item.label}</span>{values.vehicle === item.id && <i><Icon icon={faCheck} /></i>}</button>)}
      </div>
      {needsPlate && <label className={errors.plate ? styles.invalid : ''}><span><Icon icon={faIdCard} />Placa da {vehicleLabel.toLowerCase()}</span><input value={values.plate} onChange={event => update('plate', event.target.value)} autoCapitalize="characters" placeholder="ABC1D23" />{errors.plate && <small>{errors.plate}</small>}</label>}
      <div className={styles.safetyNote}><Icon icon={faShieldHalved} /><p><strong>Seus dados ficam protegidos.</strong> CPF e telefone nunca aparecem para clientes ou restaurantes.</p></div>
      {notice && <p className={styles.formNotice}>{notice}</p>}
      <button className={styles.submit} disabled={loading}>{loading ? <><i className={styles.spinner} />Enviando cadastro</> : <>Enviar para análise<Icon icon={faArrowRight} /></>}</button>
    </form>
    <AnimatePresence>{loading && <LoadingOverlay label="Quase lá" detail="Enviando seu cadastro para análise." />}</AnimatePresence>
  </section></Shell>
}

export function DriverPage() {
  const account = useAccount()
  const identity = useIdentityVerification(account.user)
  const [editing, setEditing] = useState(false)
  useEffect(() => { document.title = 'Tigre Entregas — Área do motorista' }, [])
  if (account.loading) return <LoadingOverlay label="Quase lá" detail="Abrindo sua área de entregas." />
  if (!account.user) return <Gate title="Entre para continuar" text="O cadastro de entregador fica ligado à sua conta TigreFood." />
  if (account.error) return <Gate title="Não conseguimos abrir sua conta" text="Tente novamente em alguns instantes." action="Voltar ao TigreFood" href="#catalogo" />
  if (account.role === 'admin') return <Gate title="Painel administrativo disponível" text="Sua conta administra cadastros de entregadores." action="Abrir painel administrativo" href="#admin" icon={faShieldHalved} />
  if (account.role === 'driver' && account.application?.status === 'approved') return <DriverHome account={account} />
  if (account.application && !editing) return <><Status application={account.application} onEdit={() => setEditing(true)} identityVerification={identity.verification || account.identityVerification} onStartIdentity={identity.start} identityStarting={identity.starting} identityError={identity.error} />{identity.starting && <LoadingOverlay label="Quase lá" detail="Abrindo a verificação segura." />}</>
  return <ApplicationForm account={account} onSent={() => setEditing(false)} />
}
