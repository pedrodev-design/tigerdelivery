import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faBicycle,
  faBoxOpen,
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
  faRoute,
  faRotate,
  faShieldHalved,
  faStar,
  faWallet,
} from '@fortawesome/free-solid-svg-icons'
import { AnimatePresence, motion } from 'motion/react'
import { useAccount } from '../../hooks/useAccount'
import { useIdentityVerification } from '../../hooks/useIdentityVerification'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import { LoadingOverlay } from '../../components/ui/LoadingOverlay'
import { FaceScan } from '../../components/FaceScan'
import { formatEta, getDrivingRoute } from '../../services/routing'
import { formatCpf, formatPhone, isValidCpf, onlyDigits } from '../../utils/validators'
import { supabase } from '../../lib/supabase'
import styles from './Driver.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
const DeliveryMap = lazy(() => import('../../components/map/DeliveryMap').then(module => ({ default: module.DeliveryMap })))
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const vehicles = [
  { id: 'motorcycle', label: 'Moto', icon: faMotorcycle },
  { id: 'bicycle', label: 'Bicicleta', icon: faBicycle },
  { id: 'car', label: 'Carro', icon: faCar },
]

function Shell({ children, eyebrow = 'Parceiros TigreFood' }) {
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

function DriverRouteMap({ order, location }) {
  const [route, setRoute] = useState(null)
  const [routeMeta, setRouteMeta] = useState(null)
  const driverPoint = useMemo(() => location ? [Number(location.latitude), Number(location.longitude)] : null, [location])
  const storePoint = useMemo(() => Number.isFinite(Number(order.stores?.latitude)) && Number.isFinite(Number(order.stores?.longitude)) ? [Number(order.stores.latitude), Number(order.stores.longitude)] : null, [order.stores])
  const addressPoint = useMemo(() => Array.isArray(order.delivery_address?.point) ? order.delivery_address.point.map(Number) : null, [order.delivery_address])
  const target = order.status === 'picked_up' ? addressPoint : storePoint

  useEffect(() => {
    if (!driverPoint || !target) return undefined
    const controller = new AbortController()
    getDrivingRoute([driverPoint, target], controller.signal).then(result => {
      if (!result) return
      setRoute(result.geometry)
      setRouteMeta(result)
    }).catch(error => { if (error.name !== 'AbortError') setRouteMeta(null) })
    return () => controller.abort()
  }, [driverPoint, target])

  if (!driverPoint) return null
  return <div className={styles.driverRouteMap}>
    <Suspense fallback={<div className={styles.mapLoading}>Abrindo rota…</div>}><DeliveryMap center={driverPoint} zoom={13.5} driverLocation={driverPoint} storeLocation={storePoint} destination={addressPoint} route={route} /></Suspense>
    <div className={styles.driverRouteMeta}><span>{order.status === 'picked_up' ? 'Até o cliente' : 'Até a retirada'}</span><strong>{routeMeta ? formatEta(routeMeta.duration) : 'Calculando…'}</strong></div>
  </div>
}

function DriverHome({ account }) {
  const tracking = useDriverTracking(account.user.id)
  const { online } = tracking
  const [toast, setToast] = useState('')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState('')
  const firstName = account.profile?.full_name?.split(' ')[0] || 'Parceiro'
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2200) }

  async function toggleOnline() {
    const changed = await tracking.setAvailability(!online)
    if (changed) notify(!online ? 'Você está online e recebendo entregas' : 'Você ficou offline')
  }

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('store_orders')
      .select('id, status, total, driver_fee, driver_accepted_at, picked_up_at, delivery_address, payment_method, created_at, stores(name, address, phone, latitude, longitude), store_order_items(product_name, quantity)')
      .eq('driver_id', account.user.id)
      .order('created_at', { ascending: false })
      .limit(40)
    setOrders(data || [])
    setOrdersError(error ? 'Não foi possível atualizar suas entregas.' : '')
    setOrdersLoading(false)
  }, [account.user.id])

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    const channel = supabase.channel(`driver-orders-${account.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_orders', filter: `driver_id=eq.${account.user.id}` }, loadOrders)
      .subscribe()
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel) }
  }, [account.user.id, loadOrders])

  async function updateOrder(order, action) {
    setUpdatingOrder(order.id)
    const { error } = await supabase.rpc('driver_update_demo_order', { p_order_id: order.id, p_action: action })
    setUpdatingOrder('')
    if (error) { notify('Não foi possível atualizar esta entrega.'); return }
    await loadOrders()
    notify(action === 'accept' ? 'Entrega aceita' : action === 'pickup' ? 'Pedido retirado na loja' : 'Entrega finalizada')
  }

  const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status))
  const deliveredToday = orders.filter(order => order.status === 'delivered' && new Date(order.created_at).toDateString() === new Date().toDateString())
  const todayEarnings = deliveredToday.reduce((sum, order) => sum + Number(order.driver_fee || 0), 0)

  return <Shell eyebrow="Área do entregador">
    <section className={styles.driverHome}>
      <div className={styles.driverIntro}>
        <div><p>Olá, {firstName}</p><h1>{online ? 'Você está disponível' : 'Pronto para rodar?'}</h1></div>
        <button className={`${styles.statusSwitch} ${online ? styles.onlineSwitch : ''}`} onClick={toggleOnline} aria-pressed={online} disabled={tracking.changing}>
          <span className={styles.switchTrack}><motion.i animate={{ x: online ? 18 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 32 }}><b /></motion.i></span>
          <span className={styles.switchCopy}><AnimatePresence mode="wait" initial={false}><motion.strong key={online ? 'online' : 'offline'} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .16 }}>{online ? 'Online' : 'Offline'}</motion.strong></AnimatePresence><small>{online ? 'Recebendo' : 'Pausado'}</small></span>
        </button>
      </div>

      {tracking.error && <p className={styles.locationNotice}><Icon icon={faLocationDot} />{tracking.error}</p>}

      {activeOrders.length > 0 && <section className={styles.deliveryQueue}>
        <header><div><span>{activeOrders.length} {activeOrders.length === 1 ? 'entrega disponível' : 'entregas disponíveis'}</span><h2>Sua rota agora</h2></div><button onClick={loadOrders}><Icon icon={faRotate} />Atualizar</button></header>
        {activeOrders.map(order => {
          const pickup = order.stores?.address || 'Endereço da loja indisponível'
          const destination = order.delivery_address?.label || [order.delivery_address?.street, order.delivery_address?.number, order.delivery_address?.neighborhood].filter(Boolean).join(', ')
          const accepted = Boolean(order.driver_accepted_at)
          const action = !accepted ? 'accept' : order.status === 'picked_up' ? 'deliver' : 'pickup'
          const actionLabel = !accepted ? 'Aceitar entrega' : order.status === 'picked_up' ? 'Finalizar entrega' : 'Confirmar retirada'
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(destination)}`
          return <motion.article className={styles.deliveryCard} key={order.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}>
            <div className={styles.deliveryCardTop}><span><Icon icon={order.status === 'picked_up' ? faRoute : faBoxOpen} /></span><div><small>{order.status === 'picked_up' ? 'Pedido a caminho' : accepted ? 'Entrega aceita' : 'Nova entrega'}</small><strong>Pedido #{order.id.slice(0, 6).toUpperCase()}</strong></div><b>{money(order.driver_fee)}</b></div>
            {accepted && <DriverRouteMap order={order} location={tracking.location} />}
            <div className={styles.deliveryRoute}>
              <div><i /><span><small>Retirada</small><strong>{order.stores?.name || 'Loja TigreFood'}</strong><p>{pickup}</p></span></div>
              <div><i /><span><small>Entrega</small><strong>{order.delivery_address?.recipient_name || 'Cliente TigreFood'}</strong><p>{destination || 'Endereço não informado'}</p></span></div>
            </div>
            <div className={styles.deliveryItems}><Icon icon={faReceipt} /><span>{(order.store_order_items || []).map(item => `${item.quantity}× ${item.product_name}`).join(' · ') || 'Itens do pedido'}</span><small>{order.payment_method === 'cash' ? 'Receber em dinheiro' : order.payment_method === 'card' ? 'Pago no cartão' : 'Pago pelo Pix'}</small></div>
            <div className={styles.deliveryActions}><a href={mapsUrl} target="_blank" rel="noreferrer"><Icon icon={faRoute} />Abrir rota</a><button disabled={!online || updatingOrder === order.id} onClick={() => updateOrder(order, action)}>{updatingOrder === order.id ? <i className={styles.spinner} /> : <>{actionLabel}<Icon icon={faArrowRight} /></>}</button></div>
          </motion.article>
        })}
      </section>}

      {ordersError && <p className={styles.ordersError}>{ordersError}</p>}
      {ordersLoading && <div className={styles.deliveryLoading}><i /><i /></div>}

      {!ordersLoading && activeOrders.length === 0 && <motion.section className={`${styles.availabilityCard} ${online ? styles.available : ''}`} layout>
        <span className={styles.radar}><i /><Icon icon={online ? faLocationDot : faMotorcycle} /></span>
        <div><small>{online ? 'Buscando por perto' : 'Você está offline'}</small><h2>{online ? 'Procurando a melhor entrega' : 'Fique online para receber pedidos'}</h2><p>{online ? 'Quando aparecer uma boa rota, você vê o valor antes de aceitar.' : 'Você escolhe quando começar e pode parar a qualquer momento.'}</p></div>
      </motion.section>}

      <section className={styles.earnings}>
        <div><small>Ganhos de hoje</small><strong>{money(todayEarnings)}</strong><span>{deliveredToday.length ? `${deliveredToday.length} ${deliveredToday.length === 1 ? 'entrega finalizada' : 'entregas finalizadas'}` : 'Nenhuma entrega finalizada'}</span></div>
        <button onClick={() => notify(deliveredToday.length ? 'Ganhos atualizados' : 'O extrato será exibido quando houver entregas')} aria-label="Ver ganhos"><Icon icon={faWallet} /></button>
      </section>

      <div className={styles.metrics}>
        <article><Icon icon={faReceipt} /><div><strong>{deliveredToday.length}</strong><span>entregas hoje</span></div></article>
        <article><Icon icon={faStar} /><div><strong>—</strong><span>avaliação</span></div></article>
        <article><Icon icon={faClock} /><div><strong>{online ? 'Agora' : '0h'}</strong><span>tempo online</span></div></article>
      </div>

      <section className={styles.driverMenu}>
        <h2>Sua rotina</h2>
        <button onClick={() => notify(deliveredToday.length ? `${deliveredToday.length} entrega concluída hoje` : 'Ainda não há entregas no histórico')}><span><Icon icon={faReceipt} />Histórico de entregas</span><Icon icon={faChevronRight} /></button>
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
    <p className={styles.kicker}>{pending ? 'Cadastro recebido' : 'Precisamos de uma correção'}</p>
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
    <div className={styles.applicationIntro}><p className={styles.kicker}>Entregue com a TigreFood</p><h1>Faça seu horário.<br />A cidade é sua.</h1><p>Complete o cadastro para nossa equipe analisar. A área de entregas só aparece depois da aprovação.</p></div>
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
  const [showFaceScan, setShowFaceScan] = useState(false)
  useEffect(() => { document.title = 'Tigre Entregas — Área do motorista' }, [])
  if (account.loading) return <LoadingOverlay label="Quase lá" detail="Abrindo sua área de entregas." />
  if (!account.user) return <Gate title="Entre para continuar" text="O cadastro de entregador fica ligado à sua conta TigreFood." />
  if (account.error) return <Gate title="Não conseguimos abrir sua conta" text="Tente novamente em alguns instantes." action="Voltar ao TigreFood" href="#catalogo" />
  if (account.role === 'admin') return <Gate title="Painel administrativo disponível" text="Sua conta administra cadastros de entregadores." action="Abrir painel administrativo" href="#admin" icon={faShieldHalved} />
  if (account.role === 'driver' && account.application?.status === 'approved') return <DriverHome account={account} />
  if (account.application && !editing) return <><Status application={account.application} onEdit={() => setEditing(true)} identityVerification={identity.verification || account.identityVerification} onStartIdentity={() => setShowFaceScan(true)} identityStarting={false} identityError={identity.error} />{showFaceScan && <FaceScan user={account.user} onClose={() => setShowFaceScan(false)} onComplete={async () => { setShowFaceScan(false); await identity.refresh(); await account.refresh() }} />}</>
  return <ApplicationForm account={account} onSent={() => setEditing(false)} />
}
