import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faBowlFood,
  faBoxOpen,
  faCheck,
  faChevronRight,
  faCircleCheck,
  faClock,
  faGear,
  faIdCard,
  faPlus,
  faReceipt,
  faRotate,
  faStore,
  faTag,
  faToggleOn,
  faTrash,
  faUser,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { AnimatePresence } from 'motion/react'
import { LoadingOverlay } from '../../components/ui/LoadingOverlay'
import { useStoreAccount } from '../../hooks/useStoreAccount'
import { formatPhone, onlyDigits } from '../../utils/validators'
import { supabase } from '../../lib/supabase'
import styles from './Store.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
const categories = ['Hambúrgueres', 'Pizzas', 'Refeições', 'Japonesa', 'Doces e bebidas', 'Outros']
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatCnpj = value => onlyDigits(value).slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4').replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')

function Shell({ children }) {
  return <main className={styles.page}><header className={styles.header}><a href="#catalogo" aria-label="Voltar ao TigreFood"><Icon icon={faArrowLeft} /></a><div><small>PARCEIROS TIGREFOOD</small><strong>Central da loja</strong></div><span><Icon icon={faStore} /></span></header>{children}</main>
}

function Gate({ title, text, href = '#entrar', action = 'Entrar na conta' }) {
  return <Shell><section className={styles.centerState}><span><Icon icon={faStore} /></span><h1>{title}</h1><p>{text}</p><a href={href}>{action}<Icon icon={faArrowRight} /></a></section></Shell>
}

function StoreApplication({ account, onSent }) {
  const [values, setValues] = useState({ name: '', category: categories[0], cnpj: '', phone: '', city: '', address: '', description: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const update = (name, value) => { const next = name === 'cnpj' ? formatCnpj(value) : name === 'phone' ? formatPhone(value) : value; setValues(previous => ({ ...previous, [name]: next })); setErrors(previous => ({ ...previous, [name]: '' })) }
  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (values.name.trim().length < 2) next.name = 'Informe o nome da loja.'
    if (onlyDigits(values.cnpj).length !== 14) next.cnpj = 'Informe um CNPJ válido.'
    if (!/^\d{10,11}$/.test(onlyDigits(values.phone))) next.phone = 'Informe um telefone com DDD.'
    if (values.city.trim().length < 2) next.city = 'Informe a cidade da loja.'
    setErrors(next); setNotice('')
    if (Object.keys(next).length) return
    setLoading(true)
    const { error } = await supabase.rpc('submit_store_application', { p_name: values.name.trim(), p_category: values.category, p_cnpj: onlyDigits(values.cnpj), p_phone: onlyDigits(values.phone), p_city: values.city.trim(), p_address: values.address.trim() || null, p_description: values.description.trim() || null })
    setLoading(false)
    if (error) { setNotice(error.message.includes('cnpj_already_registered') ? 'Esse CNPJ já está cadastrado.' : 'Não foi possível enviar agora. Confira os dados e tente novamente.'); return }
    await account.refresh(); onSent()
  }
  return <Shell><section className={styles.application}><div className={styles.applicationIntro}><p className={styles.kicker}>VENDA COM A TIGREFOOD</p><h1>Sua loja.<br />Mais pedidos.</h1><p>Cadastre seu negócio para aparecer no catálogo e receber pedidos de clientes da sua região.</p><div className={styles.promise}><span><Icon icon={faReceipt} /></span><div><strong>Operação simples</strong><small>Você controla o cardápio e os horários.</small></div></div><div className={styles.promise}><span><Icon icon={faUser} /></span><div><strong>Equipe por perto</strong><small>Conte com suporte quando precisar.</small></div></div></div><form onSubmit={submit} noValidate><div className={styles.formHeader}><span><Icon icon={faStore} /></span><div><h2>Cadastre sua loja</h2><p>A análise é feita pela equipe TigreFood.</p></div></div><label className={errors.name ? styles.invalid : ''}><span>Nome da loja</span><input value={values.name} onChange={event => update('name', event.target.value)} placeholder="Ex.: Brasa Burger" autoComplete="organization" />{errors.name && <small>{errors.name}</small>}</label><div className={styles.formRow}><label><span>Categoria</span><select value={values.category} onChange={event => update('category', event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className={errors.cnpj ? styles.invalid : ''}><span>CNPJ</span><input value={values.cnpj} onChange={event => update('cnpj', event.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" />{errors.cnpj && <small>{errors.cnpj}</small>}</label></div><label className={errors.phone ? styles.invalid : ''}><span>Telefone para pedidos</span><input value={values.phone} onChange={event => update('phone', event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />{errors.phone && <small>{errors.phone}</small>}</label><div className={styles.formRow}><label className={errors.city ? styles.invalid : ''}><span>Cidade</span><input value={values.city} onChange={event => update('city', event.target.value)} placeholder="Sua cidade" />{errors.city && <small>{errors.city}</small>}</label><label><span>Endereço (opcional)</span><input value={values.address} onChange={event => update('address', event.target.value)} placeholder="Rua, número e bairro" /></label></div><label><span>Conte um pouco sobre a loja <em>opcional</em></span><textarea value={values.description} onChange={event => update('description', event.target.value.slice(0, 500))} placeholder="O que seus clientes encontram por aqui?" /><small className={styles.counter}>{values.description.length}/500</small></label>{notice && <p className={styles.notice}>{notice}</p>}<button className={styles.submit} disabled={loading}>{loading ? <><i className={styles.spinner} />Enviando cadastro</> : <>Enviar para análise<Icon icon={faArrowRight} /></>}</button><p className={styles.formNote}><Icon icon={faIdCard} /> Seus dados comerciais ficam protegidos e são usados apenas na análise da loja.</p></form><AnimatePresence>{loading && <LoadingOverlay label="Quase lá" detail="Enviando os dados da sua loja." />}</AnimatePresence></section></Shell>
}

function StoreStatus({ store, onEdit }) {
  const rejected = store.status === 'rejected'
  return <Shell><section className={styles.centerState}><span className={rejected ? styles.darkIcon : ''}><Icon icon={rejected ? faRotate : faClock} /></span><p className={styles.kicker}>{rejected ? 'AJUSTE NECESSÁRIO' : 'CADASTRO RECEBIDO'}</p><h1>{rejected ? 'Vamos revisar sua loja' : 'Estamos conferindo seus dados'}</h1><p>{rejected ? store.review_notes || 'Confira os dados enviados e encaminhe novamente.' : 'Assim que a equipe aprovar o cadastro, você poderá montar o cardápio e receber pedidos.'}</p><div className={styles.statusSteps}><div className={styles.stepDone}><i><Icon icon={faCheck} /></i><span><strong>Cadastro enviado</strong><small>Dados recebidos com segurança</small></span></div><div className={styles.stepCurrent}><i>2</i><span><strong>Análise da equipe</strong><small>Conferência dos dados comerciais</small></span></div><div><i>3</i><span><strong>Painel da loja</strong><small>Cardápio e pedidos liberados</small></span></div></div>{rejected ? <button className={styles.primaryAction} onClick={onEdit}>Corrigir cadastro<Icon icon={faArrowRight} /></button> : <a className={styles.darkAction} href="#catalogo">Voltar ao TigreFood<Icon icon={faArrowRight} /></a>}</section></Shell>
}

function Overview({ store, products, orders, onTab }) {
  const todayOrders = orders.filter(item => new Date(item.created_at).toDateString() === new Date().toDateString())
  const sales = todayOrders.reduce((sum, item) => sum + Number(item.total || 0), 0)
  return <div className={styles.overview}><section className={styles.welcomeCard}><div><small>HOJE NA SUA LOJA</small><h2>{store.is_open ? 'Você está recebendo pedidos' : 'A loja está fechada'}</h2><p>{store.is_open ? 'Fique de olho na fila e aceite os próximos pedidos.' : 'Abra a loja quando estiver pronto para começar.'}</p></div><span><Icon icon={store.is_open ? faCircleCheck : faClock} /></span></section><section className={styles.stats}><article><span><Icon icon={faReceipt} /></span><div><small>PEDIDOS HOJE</small><strong>{todayOrders.length}</strong></div></article><article><span><Icon icon={faTag} /></span><div><small>VENDAS HOJE</small><strong>{money(sales)}</strong></div></article><article><span><Icon icon={faBowlFood} /></span><div><small>ITENS ATIVOS</small><strong>{products.filter(item => item.available).length}</strong></div></article></section><section className={styles.nextActions}><header><div><h2>Próximos passos</h2><p>Deixe sua operação pronta para o primeiro pedido.</p></div></header><button onClick={() => onTab('menu')}><span><Icon icon={faBowlFood} /><strong>Monte seu cardápio<small>{products.length ? 'Revise seus itens e preços' : 'Adicione seu primeiro produto'}</small></strong></span><Icon icon={faChevronRight} /></button><button onClick={() => onTab('orders')}><span><Icon icon={faReceipt} /><strong>Acompanhe os pedidos<small>Veja a fila assim que ela começar</small></strong></span><Icon icon={faChevronRight} /></button></section></div>
}

function MenuManager({ store, onChanged }) {
  const [products, setProducts] = useState([])
  const [categoriesList, setCategoriesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', prep_minutes: 25 })
  const load = useCallback(async () => { setLoading(true); const [catResult, productResult] = await Promise.all([supabase.from('store_categories').select('id, name, position, active').eq('store_id', store.id).order('position'), supabase.from('store_products').select('id, name, description, price, prep_minutes, available, category_id').eq('store_id', store.id).order('position')]); setCategoriesList(catResult.data || []); setProducts(productResult.data || []); setNotice(catResult.error || productResult.error ? 'Não foi possível carregar o cardápio.' : ''); setLoading(false) }, [store.id])
  useEffect(() => { const id = window.setTimeout(() => load(), 0); return () => window.clearTimeout(id) }, [load])
  async function addProduct(event) { event.preventDefault(); if (form.name.trim().length < 2 || Number(form.price) <= 0) { setNotice('Informe o nome e um preço válido.'); return } setSaving(true); let categoryId = form.category || categoriesList[0]?.id; if (!categoryId) { const categoryResult = await supabase.from('store_categories').insert({ store_id: store.id, name: 'Principal', position: 0 }).select('id, name').single(); categoryId = categoryResult.data?.id; if (categoryResult.data) setCategoriesList([categoryResult.data]) } const { error } = await supabase.from('store_products').insert({ store_id: store.id, category_id: categoryId || null, name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price), prep_minutes: Number(form.prep_minutes) || 25, position: products.length }); setSaving(false); if (error) { setNotice('Não foi possível adicionar o item.'); return } setForm({ name: '', description: '', price: '', category: categoryId || '', prep_minutes: 25 }); await load(); onChanged() }
  async function toggleProduct(item) { await supabase.from('store_products').update({ available: !item.available }).eq('id', item.id); load(); onChanged() }
  async function removeProduct(item) { if (!window.confirm(`Remover ${item.name} do cardápio?`)) return; await supabase.from('store_products').delete().eq('id', item.id); load(); onChanged() }
  return <section className={styles.menuPanel}><header className={styles.sectionHeader}><div><h2>Cardápio</h2><p>Itens disponíveis para os clientes encontrarem sua loja.</p></div><button onClick={load} aria-label="Atualizar cardápio"><Icon icon={faRotate} />Atualizar</button></header><div className={styles.menuGrid}><form className={styles.productForm} onSubmit={addProduct}><div><span className={styles.formIcon}><Icon icon={faPlus} /></span><div><h3>Adicionar produto</h3><p>Comece com os itens mais pedidos.</p></div></div><label><span>Nome do produto</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Smash com fritas" /></label><label><span>Descrição</span><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Ingredientes e detalhes do item" /></label><div className={styles.formRow}><label><span>Preço</span><input type="number" min="0.01" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="29,90" /></label><label><span>Preparo</span><select value={form.prep_minutes} onChange={event => setForm({ ...form, prep_minutes: event.target.value })}><option value="15">15 min</option><option value="25">25 min</option><option value="35">35 min</option><option value="45">45 min</option></select></label></div><label><span>Categoria</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}><option value="">Principal</option>{categoriesList.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{notice && <p className={styles.notice}>{notice}</p>}<button className={styles.addProduct} disabled={saving}>{saving ? 'Salvando…' : <>Adicionar ao cardápio<Icon icon={faArrowRight} /></>}</button></form><div className={styles.productList}>{loading ? <div className={styles.listLoading}><i /><i /><i /></div> : products.length ? products.map(item => <article key={item.id} className={!item.available ? styles.productUnavailable : ''}><span className={styles.productThumb}><Icon icon={faBowlFood} /></span><div><strong>{item.name}</strong><small>{item.description || 'Sem descrição'} · {item.prep_minutes} min</small><b>{money(item.price)}</b></div><button onClick={() => toggleProduct(item)} aria-label={`${item.available ? 'Pausar' : 'Ativar'} ${item.name}`}><Icon icon={item.available ? faToggleOn : faXmark} /></button><button onClick={() => removeProduct(item)} aria-label={`Remover ${item.name}`}><Icon icon={faTrash} /></button></article>) : <div className={styles.emptyMenu}><span><Icon icon={faBowlFood} /></span><h3>Seu cardápio começa aqui</h3><p>Adicione o primeiro produto para a loja ficar pronta.</p></div>}</div></div></section>
}

function OrdersPanel({ store }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); const { data } = await supabase.from('store_orders').select('id, status, total, customer_note, created_at').eq('store_id', store.id).order('created_at', { ascending: false }).limit(30); setOrders(data || []); setLoading(false) }, [store.id])
  useEffect(() => { const id = window.setTimeout(() => load(), 0); return () => window.clearTimeout(id) }, [load])
  const status = { new: 'Novo pedido', confirmed: 'Confirmado', preparing: 'Em preparo', ready: 'Pronto', picked_up: 'Saiu para entrega', delivered: 'Entregue', cancelled: 'Cancelado' }
  async function advance(order) { const next = { new: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'picked_up', picked_up: 'delivered' }[order.status]; if (!next) return; await supabase.from('store_orders').update({ status: next, ...(next === 'confirmed' ? { accepted_at: new Date().toISOString() } : {}), ...(next === 'ready' ? { ready_at: new Date().toISOString() } : {}), ...(next === 'delivered' ? { delivered_at: new Date().toISOString() } : {}) }).eq('id', order.id); load() }
  return <section className={styles.ordersPanel}><header className={styles.sectionHeader}><div><h2>Pedidos</h2><p>Uma fila simples para sua equipe não perder nenhum pedido.</p></div><button onClick={load}><Icon icon={faRotate} />Atualizar</button></header>{loading ? <div className={styles.listLoading}><i /><i /><i /></div> : orders.length ? <div className={styles.orderList}>{orders.map(order => <article key={order.id}><span className={styles.orderIcon}><Icon icon={faReceipt} /></span><div><strong>Pedido #{order.id.slice(0, 6).toUpperCase()}</strong><small>{new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{order.customer_note ? ` · ${order.customer_note}` : ''}</small></div><b data-order-status={order.status}>{status[order.status]}</b><strong className={styles.orderTotal}>{money(order.total)}</strong>{['new', 'confirmed', 'preparing', 'ready', 'picked_up'].includes(order.status) && <button className={styles.orderAction} onClick={() => advance(order)}>{order.status === 'new' ? 'Aceitar' : order.status === 'preparing' ? 'Marcar pronto' : order.status === 'ready' ? 'Entregar ao motorista' : 'Avançar'}<Icon icon={faArrowRight} /></button>}</article>)}</div> : <div className={styles.ordersEmpty}><span><Icon icon={faBoxOpen} /></span><h3>A fila está tranquila</h3><p>Quando um cliente fizer um pedido, ele aparece aqui com o prazo e o valor.</p></div>}</section>
}

function StoreHome({ account }) {
  const [tab, setTab] = useState('overview')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [saving, setSaving] = useState(false)
  const store = account.store
  const loadOverview = useCallback(async () => { const [productsResult, ordersResult] = await Promise.all([supabase.from('store_products').select('id, available, price').eq('store_id', store.id), supabase.from('store_orders').select('id, total, created_at, status').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50)]); setProducts(productsResult.data || []); setOrders(ordersResult.data || []) }, [store.id])
  useEffect(() => { const id = window.setTimeout(() => loadOverview(), 0); return () => window.clearTimeout(id) }, [loadOverview])
  async function toggleOpen() { setSaving(true); await supabase.from('stores').update({ is_open: !store.is_open }).eq('id', store.id); await account.refresh(); setSaving(false) }
  const firstName = account.profile?.full_name?.split(' ')[0] || 'lojista'
  return <main className={styles.dashboard}><aside className={styles.sidebar}><a href="#catalogo" className={styles.sideBrand}><span><Icon icon={faStore} /></span><div><strong>TigreFood</strong><small>Central da loja</small></div></a><nav><button className={tab === 'overview' ? styles.navActive : ''} onClick={() => setTab('overview')}><Icon icon={faBoxOpen} />Visão geral</button><button className={tab === 'menu' ? styles.navActive : ''} onClick={() => setTab('menu')}><Icon icon={faBowlFood} />Cardápio{products.length > 0 && <small>{products.length}</small>}</button><button className={tab === 'orders' ? styles.navActive : ''} onClick={() => setTab('orders')}><Icon icon={faReceipt} />Pedidos</button><button><Icon icon={faGear} />Configurações</button></nav><a href="#catalogo" className={styles.backLink}><Icon icon={faArrowLeft} />Voltar ao app</a></aside><section className={styles.workspace}><header className={styles.topbar}><div><small>PAINEL DA LOJA</small><h1>{store.name}</h1><p>Olá, {firstName}. Tudo certo por aí?</p></div><div className={styles.topActions}><button className={`${styles.storeSwitch} ${store.is_open ? styles.storeOpen : ''}`} onClick={toggleOpen} disabled={saving}><i />{store.is_open ? 'Loja aberta' : 'Loja fechada'}</button><span className={styles.storeAvatar}><Icon icon={faStore} /></span></div></header><div className={styles.content}>{tab === 'overview' && <Overview store={store} products={products} orders={orders} onTab={setTab} />}{tab === 'menu' && <MenuManager store={store} onChanged={loadOverview} />}{tab === 'orders' && <OrdersPanel store={store} />}</div></section></main>
}

export function StorePage() {
  const account = useStoreAccount()
  const [editing, setEditing] = useState(false)
  useEffect(() => { document.title = 'Central da loja — TigreFood' }, [])
  if (account.loading) return <LoadingOverlay label="Quase lá" detail="Abrindo a central da loja." />
  if (!account.user) return <Gate title="Entre para cadastrar sua loja" text="A central da loja fica ligada à sua conta TigreFood." />
  if (account.store?.status === 'approved') return <StoreHome account={account} />
  if (account.store && !editing) return <StoreStatus store={account.store} onEdit={() => setEditing(true)} />
  return <StoreApplication account={account} onSent={() => setEditing(false)} />
}
