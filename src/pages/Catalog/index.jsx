import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight as ArrowRight,
  faBagShopping as Bag,
  faBookmark as BookmarkSolid,
  faBolt as Lightning,
  faCamera as Camera,
  faCheck as Check,
  faChevronDown as CaretDown,
  faChevronLeft as CaretLeft,
  faChevronRight as CaretRight,
  faCircleQuestion as Question,
  faCircleNotch as Spinner,
  faClipboard as ClipboardSolid,
  faCreditCard as CreditCard,
  faHeart as Heart,
  faHouse as House,
  faLocationDot as MapPin,
  faLocationCrosshairs as Locate,
  faMagnifyingGlass as MagnifyingGlass,
  faMinus as Minus,
  faMoneyBillWave as Cash,
  faMotorcycle as Motorcycle,
  faPen as Pen,
  faPlus as Plus,
  faQrcode as QrCode,
  faReceipt as Receipt,
  faRectangleList as MenuSolid,
  faShareNodes as Share,
  faShieldHalved as Shield,
  faSliders as SlidersHorizontal,
  faStar as Star,
  faStore as Store,
  faTag as Tag,
  faUser as User,
  faXmark as X,
} from '@fortawesome/free-solid-svg-icons'
import {
  faBookmark as BookmarkRegular,
  faClipboard as ClipboardRegular,
  faHouse as HouseRegular,
  faRectangleList as MenuRegular,
  faUser as UserRegular,
} from '@fortawesome/free-regular-svg-icons'
import { Dialog, Select, Tooltip } from 'radix-ui'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import useEmblaCarousel from 'embla-carousel-react'
import { useDeliveryTracking } from '../../hooks/useDeliveryTracking'
import { formatEta } from '../../services/routing'
import { categories, products, money } from './data'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAccount } from '../../hooks/useAccount'
import styles from './Catalog.module.css'
import allCategory from '../../assets/icons/tudo-icon.png'
import burgerCategory from '../../assets/icons/burguer-icon.png'
import coffeeCategory from '../../assets/icons/coffe-icon.png'
import mealCategory from '../../assets/icons/pastel-icon.png'
import pizzaCategory from '../../assets/icons/pizza-icon.png'
import healthyCategory from '../../assets/icons/salada-icon.png'
import chickenCategory from '../../assets/icons/salgados-icon.png'
import japaneseCategory from '../../assets/icons/sushi-icon.png'
import dessertCategory from '../../assets/icons/acai-icon.png'
import ordersIllustration from '../../assets/icons/pedidos-icon.png'
import locationIllustration from '../../assets/icons/loc-icon.png'
import bagIllustration from '../../assets/icons/sacola-icon.png'
import bannerOne from '../../assets/banners/banner-1.png'
import bannerTwo from '../../assets/banners/banner-2.png'
import bannerThree from '../../assets/banners/banner-3.png'
import bannerFour from '../../assets/banners/banner-4.png'
import bannerFive from '../../assets/banners/banner-5.png'
import bannerSix from '../../assets/banners/banner-6.png'
import bannerSeven from '../../assets/banners/banner-7.png'
import bannerEight from '../../assets/banners/banner-8.png'

const Icon = ({ icon, weight: _weight, ...props }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" {...props} />
const DeliveryMap = lazy(() => import('../../components/map/DeliveryMap').then(module => ({ default: module.DeliveryMap })))
const tap = { scale: 0.94 }
const spring = { type: 'spring', stiffness: 420, damping: 30 }
const readSaved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const categoryImages = { all: allCategory, burgers: burgerCategory, pizza: pizzaCategory, japanese: japaneseCategory, meals: mealCategory, chicken: chickenCategory, healthy: healthyCategory, desserts: dessertCategory, drinks: coffeeCategory }
const defaultPoint = [-23.55052, -46.633308]
const formatCep = value => value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
const pointCacheKey = point => `tigre-geocode:${point.map(value => Number(value).toFixed(4)).join(',')}`

function useDragClickGuard() {
  const start = useRef(null)
  const suppress = useRef(false)
  const onPointerDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    start.current = [event.clientX, event.clientY]
    suppress.current = false
  }
  const onPointerMove = event => {
    if (!start.current) return
    const distance = Math.hypot(event.clientX - start.current[0], event.clientY - start.current[1])
    if (distance > 8) suppress.current = true
  }
  const onPointerUp = () => {
    start.current = null
  }
  const guard = callback => event => {
    if (suppress.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); return }
    callback(event)
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, guard }
}

function useScrollChrome(enabled, page) {
  const rootRef = useRef(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) return undefined
    let idleTimer
    const showBottomNav = () => {
      window.clearTimeout(idleTimer)
      root.removeAttribute('data-scrolling')
    }
    const onScroll = () => {
      const y = Math.max(0, window.scrollY)
      if (y <= 4) root.removeAttribute('data-compact-header')
      else if (y >= 72) root.setAttribute('data-compact-header', 'true')
      if (y <= 4 || root.querySelector(`.${styles.bottomNav} :focus-visible`)) { showBottomNav(); return }
      root.setAttribute('data-scrolling', 'true')
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(showBottomNav, 420)
    }
    if (window.scrollY >= 72) root.setAttribute('data-compact-header', 'true')
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      showBottomNav()
      root.removeAttribute('data-compact-header')
      window.removeEventListener('scroll', onScroll)
    }
  }, [enabled, page])
  return rootRef
}

function parseMapAddress(payload) {
  const item = payload?.address || {}
  return {
    street: item.road || item.pedestrian || item.residential || item.footway || '',
    number: item.house_number || '',
    neighborhood: item.suburb || item.neighbourhood || item.quarter || item.city_district || '',
    city: item.city || item.town || item.village || item.municipality || '',
    state: item['ISO3166-2-lvl4']?.replace('BR-', '') || item.state_code?.replace('BR-', '') || item.state || '',
    cep: formatCep(item.postcode || ''),
  }
}

const imageBanners = [
  { id: 'banner-1', image: bannerOne, category: 'burgers', alt: 'Tigre Delivery: peça lanches, sushi e muito mais pelo app' },
  { id: 'banner-2', image: bannerTwo, category: 'burgers', alt: 'Promoção Tigre Delivery com dez reais de desconto' },
  { id: 'banner-3', image: bannerThree, category: 'japanese', alt: 'Sushi do dia no Tigre Delivery' },
  { id: 'banner-4', image: bannerFour, category: 'pizza', alt: 'Pizza do dia no Tigre Delivery' },
  { id: 'banner-5', image: bannerFive, category: 'desserts', alt: 'Açaí do dia no Tigre Delivery' },
  { id: 'banner-6', image: bannerSix, category: 'burgers', alt: 'Lanches, pizza e sushi para pedir à noite' },
  { id: 'banner-7', image: bannerSeven, category: 'burgers', alt: 'Fim de semana no Tigre Delivery' },
  { id: 'banner-8', image: bannerEight, category: 'meals', alt: 'Entrega grátis no Tigre Delivery' },
]
const heroBanners = imageBanners.slice(0, 2)
const sortOptions = [['recommended', 'Recomendados'], ['price', 'Menor preço'], ['time', 'Mais rápidos'], ['rating', 'Melhor avaliação']]
const extrasByCategory = {
  burgers: [{ id: 'cheese', name: 'Queijo extra', price: 4 }, { id: 'bacon', name: 'Bacon crocante', price: 5 }, { id: 'egg', name: 'Ovo', price: 3 }, { id: 'sauce', name: 'Molho da casa', price: 2.5 }],
  pizza: [{ id: 'border', name: 'Borda recheada', price: 8 }, { id: 'cheese', name: 'Muçarela extra', price: 6 }, { id: 'olive', name: 'Azeitonas', price: 3 }, { id: 'sauce', name: 'Molho de alho', price: 2.5 }],
  japanese: [{ id: 'ginger', name: 'Gengibre extra', price: 2 }, { id: 'tare', name: 'Molho tarê', price: 2.5 }, { id: 'cream', name: 'Cream cheese', price: 4 }, { id: 'joy', name: 'Dupla de joy', price: 8 }],
  default: [{ id: 'protein', name: 'Porção extra', price: 6 }, { id: 'cheese', name: 'Queijo extra', price: 4 }, { id: 'sauce', name: 'Molho da casa', price: 2.5 }, { id: 'drink', name: 'Bebida lata', price: 6 }],
}

const bottomNavItems = [
  { id: 'home', name: 'Início', regular: HouseRegular, solid: House },
  { id: 'menu', name: 'Cardápio', regular: MenuRegular, solid: MenuSolid },
  { id: 'orders', name: 'Pedidos', regular: ClipboardRegular, solid: ClipboardSolid },
  { id: 'offers', name: 'Ofertas', regular: BookmarkRegular, solid: BookmarkSolid },
  { id: 'profile', name: 'Perfil', regular: UserRegular, solid: User },
]

function BottomNavItem({ item, active, onClick }) {
  const [pressed, setPressed] = useState(false)
  const filled = active || pressed
  return <motion.button
    type="button"
    data-nav={item.id}
    className={`${item.id === 'orders' ? styles.ordersTab : ''} ${active ? styles.bottomActive : ''}`}
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
    onPointerDown={() => setPressed(true)}
    onPointerUp={() => setPressed(false)}
    onPointerCancel={() => setPressed(false)}
  >
    <span className={`${styles.navIconShell} ${item.id === 'orders' ? styles.ordersIcon : ''}`}>
      <motion.span className={styles.navGlyph} initial={false} animate={{ opacity: filled ? 0 : 1 }} transition={{ duration: .18, ease: 'easeOut' }}><Icon icon={item.regular} /></motion.span>
      <motion.span className={styles.navGlyph} initial={false} animate={{ opacity: filled ? 1 : 0 }} transition={{ duration: .2, ease: 'easeOut' }}><Icon icon={item.solid} /></motion.span>
    </span>
    <span>{item.name}</span>
  </motion.button>
}

function HeroCarousel({ onBrowse }) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: true, align: 'start', duration: 28 })
  const [selected, setSelected] = useState(0)
  const slides = heroBanners
  const updateSelected = useCallback(() => { if (embla) setSelected(embla.selectedScrollSnap()) }, [embla])
  useEffect(() => {
    if (!embla) return
    embla.on('select', updateSelected).on('reInit', updateSelected)
    return () => { embla.off('select', updateSelected).off('reInit', updateSelected) }
  }, [embla, updateSelected])
  useEffect(() => {
    if (!embla) return
    embla.reInit()
    embla.scrollTo(0, true)
  }, [embla])
  useEffect(() => {
    if (!embla || slides.length < 2) return undefined
    let timer
    const stop = () => window.clearTimeout(timer)
    const schedule = () => {
      stop()
      if (document.visibilityState === 'visible') timer = window.setTimeout(() => embla.scrollNext(), 10000)
    }
    const onVisibility = () => document.visibilityState === 'visible' ? schedule() : stop()
    schedule()
    embla.on('select', schedule).on('reInit', schedule).on('pointerDown', stop).on('settle', schedule)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      embla.off('select', schedule).off('reInit', schedule).off('pointerDown', stop).off('settle', schedule)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [embla, slides.length])
  return <section className={styles.heroCarousel} aria-label="Destaques do cardápio">
    <div className={styles.heroViewport} ref={viewportRef}><div className={styles.heroTrack}>{slides.map(banner => <div className={styles.heroSlide} key={banner.id}>
      <motion.button className={styles.imageBannerButton} whileTap={tap} transition={spring} onClick={() => onBrowse(banner.category)} aria-label={`Abrir ofertas: ${banner.alt}`}>
        <img className={styles.imageBanner} src={banner.image} alt={banner.alt} draggable="false" />
      </motion.button>
    </div>)}</div></div>
    <div className={styles.heroDots}>{slides.map((banner, index) => <button key={banner.id ?? banner.category} className={selected === index ? styles.dotActive : ''} onClick={() => embla?.scrollTo(index)} aria-label={`Mostrar destaque ${index + 1}`} aria-pressed={selected === index} />)}</div>
    <div className={styles.heroArrows}><motion.button whileTap={tap} aria-label="Destaque anterior" onClick={() => embla?.scrollPrev()}><Icon icon={CaretLeft} /></motion.button><motion.button whileTap={tap} aria-label="Próximo destaque" onClick={() => embla?.scrollNext()}><Icon icon={CaretRight} /></motion.button></div>
  </section>
}

function SortControl({ value, onChange }) {
  return <div className={styles.sortControl}><span>Ordenar por</span><Select.Root value={value} onValueChange={onChange}>
    <Select.Trigger className={styles.sortTrigger} aria-label="Ordenar pratos"><Select.Value /><Select.Icon><Icon icon={CaretDown} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className={styles.sortMenu} position="popper" sideOffset={7} align="end"><Select.Viewport>{sortOptions.map(([id, label]) => <Select.Item className={styles.sortItem} value={id} key={id}><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator><Icon icon={Check} /></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root></div>
}

function CategoryCarousel({ value, onChange }) {
  const [viewportRef] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true, skipSnaps: true })
  const dragGuard = useDragClickGuard()
  return <section className={styles.categories} ref={viewportRef} aria-label="Categorias" onPointerDown={dragGuard.onPointerDown} onPointerMove={dragGuard.onPointerMove} onPointerUp={dragGuard.onPointerUp} onPointerCancel={dragGuard.onPointerCancel}>
    <div className={styles.categoryTrack}>{categories.map((cat, index) => <motion.button key={cat.id} whileTap={tap} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .15) }} className={value === cat.id ? styles.categoryActive : ''} aria-pressed={value === cat.id} onClick={dragGuard.guard(() => onChange(cat.id))}>
      <span><img src={categoryImages[cat.id]} alt="" draggable="false" /></span><strong>{cat.label}</strong>
    </motion.button>)}</div>
  </section>
}

function ProductRail({ items, openProduct, add }) {
  const [viewportRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
    skipSnaps: true,
    breakpoints: { '(min-width: 601px)': { active: false } },
  })
  const dragGuard = useDragClickGuard()
  return <div className={styles.productViewport} ref={viewportRef} onPointerDown={dragGuard.onPointerDown} onPointerMove={dragGuard.onPointerMove} onPointerUp={dragGuard.onPointerUp} onPointerCancel={dragGuard.onPointerCancel}>
    <div className={styles.productGrid}>{items.map((item, index) => <ProductCard key={item.id} item={item} index={index} onOpen={dragGuard.guard(() => openProduct(item))} onAdd={dragGuard.guard(() => add(item))} />)}</div>
  </div>
}

function ProductCard({ item, index, onOpen, onAdd }) {
  const [added, setAdded] = useState(false)
  function handleAdd(event) {
    onAdd(event)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 650)
  }
  return <motion.article className={styles.card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={{ duration: .32, delay: Math.min(index * .035, .2), ease: [0.22, 1, 0.36, 1] }}>
    <div className={styles.cardImage}>
      <button className={styles.photoButton} aria-label={`Ver detalhes de ${item.name}`} onClick={onOpen}><img src={`/images/${item.image}.jpg`} alt={item.name} loading="lazy" /></button>
      {item.original && <span className={styles.tag}>−{Math.round((1 - item.price / item.original) * 100)}%</span>}
      <svg className={styles.addCutout} viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M64 4 Q64 16 52 16 H36 Q16 16 16 36 V52 Q16 64 4 64 H64 Z" /></svg>
      <motion.button className={styles.add} whileTap={{ scale: .9 }} transition={spring} aria-label={`Adicionar ${item.name} à sacola`} onClick={handleAdd}><motion.span key={added ? 'added' : 'plus'} initial={{ opacity: 0, scale: .55, rotate: added ? -18 : 18 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: .18, ease: 'easeOut' }}><Icon icon={added ? Check : Plus} /></motion.span></motion.button>
    </div>
    <div className={styles.cardBody}>
      <div className={styles.priceRow}><div>{item.startingAt && <small className={styles.startingAt}>a partir de</small>}<strong>{money(item.price)}</strong>{item.original && <del>{money(item.original)}</del>}</div></div>
      <button className={styles.productTitle} onClick={onOpen}><h3>{item.name}</h3></button>
      <div className={styles.delivery}><span><Icon icon={Lightning} />{item.time}–{item.time + 10} min</span><i /><span className={item.delivery === 0 ? styles.free : ''}>{item.delivery === 0 ? 'Grátis' : money(item.delivery)}</span></div>
    </div>
  </motion.article>
}

function RestaurantCard({ item, index, favorite, onFavorite, onOpen }) {
  const categoryLabel = categories.find(category => category.id === item.category)?.label || 'Restaurante'
  return <motion.article className={styles.restaurantCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, delay: Math.min(index * .035, .18) }}>
    <button className={styles.restaurantPhoto} onClick={onOpen} aria-label={`Ver ${item.name}`}><img src={`/images/${item.image}.jpg`} alt={item.name} loading="lazy" /></button>
    <div className={styles.restaurantInfo}><button onClick={onOpen}><h3>{item.shop}</h3></button><p><Icon icon={Star} />{item.rating} · {categoryLabel}</p><p><Icon className={styles.deliveryBolt} icon={Lightning} />{item.time}–{item.time + 10} min · {(0.7 + index * 0.6).toFixed(1).replace('.', ',')} km · <strong>{item.delivery === 0 ? 'Grátis' : money(item.delivery)}</strong></p>{item.original && <span>Itens com até {Math.round((1 - item.price / item.original) * 100)}% OFF</span>}</div>
    <motion.button whileTap={tap} className={styles.restaurantFavorite} aria-label={`${favorite ? 'Remover' : 'Adicionar'} ${item.shop} ${favorite ? 'dos' : 'aos'} favoritos`} aria-pressed={favorite} onClick={onFavorite}><Icon icon={Heart} /></motion.button>
  </motion.article>
}

function PromoImageRow({ banners: rowBanners, onBrowse }) {
  const [viewportRef] = useEmblaCarousel({ loop: false, align: 'start', containScroll: 'trimSnaps', dragFree: false, duration: 28 })
  return <motion.section className={styles.promoImageRow} ref={viewportRef} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }} aria-label="Ofertas em destaque">
    <div className={styles.promoImageTrack}>{rowBanners.map(banner => <motion.button key={banner.id} className={styles.promoImageCard} whileTap={tap} transition={spring} onClick={() => onBrowse(banner.category)} aria-label={`Abrir oferta: ${banner.alt}`}>
      <img src={banner.image} alt={banner.alt} loading="lazy" draggable="false" />
    </motion.button>)}</div>
  </motion.section>
}

function CatalogSections({ items, discovery, favorites, toggleFavorite, openProduct, add, browse, neighborhood }) {
  if (!discovery) return <motion.div layout className={styles.restaurantList}>{items.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</motion.div>

  const offers = items.filter(item => item.original).slice(0, 5)
  const fast = items.filter(item => item.time <= 25).slice(0, 4)
  const popular = [...items].sort((a, b) => parseFloat(b.rating.replace(',', '.')) - parseFloat(a.rating.replace(',', '.'))).slice(0, 5)
  return <div className={styles.discoveryFeed}>
    <ProductRail items={offers} openProduct={openProduct} add={add} />
    <PromoImageRow onBrowse={browse} banners={[imageBanners[2], imageBanners[3]]} />
    <section className={styles.feedSection}><header><div><h2><Icon className={styles.headingBolt} icon={Lightning} />Chega mais rápido</h2><p>Boas opções para receber em até 35 min.</p></div><button onClick={() => browse()}>Ver mais <Icon icon={CaretRight} /></button></header><div className={styles.restaurantList}>{fast.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</div></section>
    <PromoImageRow onBrowse={browse} banners={[imageBanners[4], imageBanners[5]]} />
    <section className={styles.feedSection}><header><div><h2>{neighborhood ? `Mais pedidos em ${neighborhood}` : 'Mais pedidos perto de você'}</h2><p>{neighborhood ? 'O que está fazendo sucesso na sua região.' : 'Informe seu endereço para ver opções mais próximas.'}</p></div></header><div className={styles.restaurantList}>{popular.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</div></section>
    <PromoImageRow onBrowse={browse} banners={[imageBanners[6], imageBanners[7]]} />
  </div>
}

function OrdersEmpty({ onBrowse, user }) {
  return <section className={styles.ordersEmpty}>
    <motion.img className={styles.ordersIllustration} src={ordersIllustration} alt="" initial={{ opacity: 0, y: 12, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }} />
    <h2>{user ? 'Você ainda não fez pedidos' : 'Acompanhe seus pedidos por aqui'}</h2>
    <p>{user ? 'Quando fizer seu primeiro pedido, o andamento e o histórico aparecerão aqui.' : 'Entre na sua conta para ver pedidos em andamento, entregas e compras anteriores.'}</p>
    <div className={styles.ordersActions}>{!user && <a href="#entrar">Entrar na minha conta <Icon icon={ArrowRight} /></a>}<button onClick={onBrowse}>Explorar restaurantes</button></div>
  </section>
}

function AddressPage({ address, onBack, onSave }) {
  const [editing, setEditing] = useState(Boolean(address))
  const [point, setPoint] = useState(address?.point || defaultPoint)
  const [locationError, setLocationError] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationAccuracy, setLocationAccuracy] = useState(0)
  const suppressReverseUntil = useRef(0)
  const mapPanelRef = useRef(null)
  const [details, setDetails] = useState({
    street: address?.street || '', number: address?.number || '', complement: address?.complement || '',
    neighborhood: address?.neighborhood || '', city: address?.city || '', state: address?.state || '', cep: address?.cep || '',
  })

  useEffect(() => {
    if (!editing) return undefined
    if (Date.now() < suppressReverseUntil.current) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setGeocoding(true)
      setLocationError('')
      try {
        const cacheKey = pointCacheKey(point)
        let payload
        try { payload = JSON.parse(sessionStorage.getItem(cacheKey)) } catch { /* cache indisponível */ }
        if (!payload) {
          const url = new URL('https://nominatim.openstreetmap.org/reverse')
          url.search = new URLSearchParams({ format: 'jsonv2', lat: String(point[0]), lon: String(point[1]), zoom: '18', addressdetails: '1', 'accept-language': 'pt-BR' })
          const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
          if (!response.ok) throw new Error('reverse-geocode')
          payload = await response.json()
          try { sessionStorage.setItem(cacheKey, JSON.stringify(payload)) } catch { /* cache indisponível */ }
        }
        const parsed = parseMapAddress(payload)
        setDetails(current => ({ ...current, ...parsed, complement: current.complement }))
      } catch (error) {
        if (error.name !== 'AbortError') setLocationError('Não encontramos esse ponto automaticamente. Você pode preencher o endereço abaixo.')
      } finally {
        if (!controller.signal.aborted) setGeocoding(false)
      }
    }, 900)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [editing, point])

  const updateDetail = (field, value) => setDetails(current => ({ ...current, [field]: value }))

  const lookupCep = async () => {
    const cep = details.cep.replace(/\D/g, '')
    if (cep.length !== 8 || cepLoading) {
      if (cep.length && cep.length !== 8) setLocationError('Digite um CEP com 8 números.')
      return
    }
    setCepLoading(true)
    setLocationError('')
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('cep-not-found')
      const result = await response.json()
      setDetails(current => ({ ...current, street: result.street || '', number: '', neighborhood: result.neighborhood || '', city: result.city || '', state: result.state || '', cep: formatCep(result.cep || cep) }))
      const latitude = Number(result.location?.coordinates?.latitude), longitude = Number(result.location?.coordinates?.longitude)
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        suppressReverseUntil.current = Date.now() + 1600
        setPoint([latitude, longitude])
        if (window.matchMedia('(max-width: 600px)').matches) {
          window.requestAnimationFrame(() => mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }
      }
    } catch {
      setLocationError('CEP não encontrado. Confira os números ou escolha o ponto no mapa.')
    } finally {
      setCepLoading(false)
    }
  }

  const locate = () => {
    if (!navigator.geolocation) { setLocationError('Localização indisponível neste navegador.'); return }
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      position => {
        const nextPoint = [position.coords.latitude, position.coords.longitude]
        setUserLocation(nextPoint)
        setLocationAccuracy(Math.min(Math.max(position.coords.accuracy || 80, 30), 500))
        setPoint(nextPoint)
      },
      () => setLocationError('Não foi possível acessar sua localização. Você pode escolher o ponto no mapa.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const saveAddress = event => {
    event.preventDefault()
    const street = details.street.trim(), number = details.number.trim(), neighborhood = details.neighborhood.trim(), city = details.city.trim()
    onSave({ ...details, label: `${street}, ${number} · ${neighborhood || city}`, street, number, neighborhood, city, point })
  }

  return <motion.section className={styles.addressPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <header className={styles.addressPageHeader}><motion.button whileTap={tap} onClick={onBack} aria-label="Voltar ao catálogo"><Icon icon={CaretLeft} /></motion.button><div><h1>{editing ? 'Endereço de entrega' : 'Endereços'}</h1><p>{editing ? 'Busque pelo CEP e ajuste o ponto' : 'Gerencie seus locais de entrega'}</p></div></header>
    {!editing ? <div className={styles.locationEmpty}><img src={locationIllustration} alt="" /><h2>Você ainda não tem um endereço</h2><p>Adicione um local para encontrar restaurantes próximos e receber seus pedidos.</p><motion.button whileTap={tap} onClick={() => setEditing(true)}>Adicionar endereço <Icon icon={ArrowRight} /></motion.button></div> : <form className={styles.addressEditor} onSubmit={saveAddress}>
      <section className={styles.addressSearchPanel} aria-labelledby="cep-title">
        <div className={styles.locationFormHeading}><h2 id="cep-title">Busque pelo CEP</h2><p>Vamos encontrar a região. Depois, ajuste o pino até a entrada certa.</p></div>
        <label>CEP<div className={styles.cepControl}><input name="cep" value={details.cep} onChange={event => updateDetail('cep', formatCep(event.target.value))} onBlur={lookupCep} inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" /><button type="button" onClick={lookupCep} aria-label="Buscar endereço pelo CEP" disabled={cepLoading}>{cepLoading ? <Icon icon={Spinner} /> : <Icon icon={MagnifyingGlass} />}</button></div></label>
        {locationError && <p className={styles.locationError} role="status">{locationError}</p>}
      </section>
      <div className={styles.mapPanel} ref={mapPanelRef}>
        <Suspense fallback={<div className={styles.mapLoading}>Preparando mapa…</div>}><DeliveryMap className={styles.map} center={point} zoom={16} onCenterChange={setPoint} userLocation={userLocation} accuracy={locationAccuracy} /></Suspense>
        <div className={styles.centerPin} aria-hidden="true"><span><Icon icon={MapPin} /></span><i /></div>
        <motion.button whileTap={tap} className={`${styles.locateButton} ${userLocation ? styles.locateButtonActive : ''}`} type="button" onClick={locate}><Icon icon={Locate} />{userLocation ? 'Localização atual' : 'Usar minha localização'}</motion.button>
        <div className={styles.mapHint}><span className={styles.mapHintIcon}><Icon icon={geocoding ? Spinner : MapPin} /></span><span><strong>{geocoding ? 'Localizando endereço…' : 'Ajuste o ponto da entrega'}</strong><small>{geocoding ? 'Só um instante' : userLocation ? 'Ponto azul: você está aqui · mova o mapa se precisar' : details.street ? `${details.street} · mova o mapa se precisar` : 'Deixe o pino exatamente na entrada'}</small></span></div>
      </div>
      <div className={styles.locationForm}>
        <div className={styles.locationFormHeading}><h2>Complete o endereço</h2><p>Informe o número e, se precisar, um complemento.</p></div>
        <label className={styles.streetField}>Rua ou avenida<input name="street" value={details.street} onChange={event => updateDetail('street', event.target.value)} placeholder="Ex.: Rua das Flores" autoComplete="street-address" required /></label>
        <div className={styles.locationFormRow}><label>Número<input name="number" value={details.number} onChange={event => updateDetail('number', event.target.value)} inputMode="numeric" placeholder="123" required /></label><label>Complemento <small>opcional</small><input name="complement" value={details.complement} onChange={event => updateDetail('complement', event.target.value)} placeholder="Apto, bloco..." /></label></div>
        <label>Bairro<input name="neighborhood" value={details.neighborhood} onChange={event => updateDetail('neighborhood', event.target.value)} placeholder="Seu bairro" /></label>
        <div className={styles.locationFormRow}><label>Cidade<input name="city" value={details.city} onChange={event => updateDetail('city', event.target.value)} placeholder="Sua cidade" required /></label><label>Estado<input name="state" value={details.state} onChange={event => updateDetail('state', event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" autoComplete="address-level1" /></label></div>
        <button className={styles.saveAddress}>Salvar endereço <Icon icon={ArrowRight} /></button>
      </div>
    </form>}
  </motion.section>
}

const orderStatus = {
  new: { label: 'Pedido recebido', step: 1 },
  confirmed: { label: 'Confirmado pela loja', step: 2 },
  preparing: { label: 'Em preparo', step: 2 },
  ready: { label: 'Pronto para retirada', step: 3 },
  picked_up: { label: 'Saiu para entrega', step: 4 },
  delivered: { label: 'Entregue', step: 5 },
  cancelled: { label: 'Cancelado', step: 0 },
}

function CustomerOrderCard({ order }) {
  const state = orderStatus[order.status] || orderStatus.new
  const items = order.store_order_items || []
  const addressLabel = order.delivery_address?.label || [order.delivery_address?.street, order.delivery_address?.number].filter(Boolean).join(', ')
  const tracking = useDeliveryTracking(order)
  const isLive = order.fulfillment_type === 'delivery' && !['delivered', 'cancelled'].includes(order.status) && tracking.driverPoint
  const mapCenter = tracking.driverPoint || tracking.store || tracking.destination || defaultPoint
  const statusText = order.status === 'confirmed'
    ? 'A loja confirmou. O motorista segue para a retirada.'
    : order.status === 'preparing'
      ? 'Seu pedido está sendo preparado.'
      : order.status === 'ready'
        ? 'O pedido está pronto para o motorista.'
        : order.status === 'picked_up'
          ? 'Seu pedido está a caminho.'
          : order.status === 'delivered'
            ? 'Entrega concluída.'
            : 'Acompanhe as próximas atualizações por aqui.'
  return <motion.article className={order.status === 'cancelled' ? styles.cancelledOrder : ''} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <div className={styles.customerOrderTop}><span><Icon icon={Store} /></span><div><small>Pedido #{order.id.slice(0, 6).toUpperCase()}</small><strong>{order.stores?.name || 'TigreFood'}</strong><p>{items.map(item => `${item.quantity}× ${item.product_name}`).join(' · ')}</p></div><b>{money(Number(order.total))}</b></div>
    {isLive && <div className={styles.liveOrderMap}>
      <Suspense fallback={<div className={styles.mapLoading}>Abrindo rota…</div>}><DeliveryMap center={mapCenter} zoom={13.5} interactive={false} driverLocation={tracking.driverPoint} storeLocation={tracking.store} destination={tracking.destination} route={tracking.route} /></Suspense>
      <div className={styles.liveOrderEta}><span>Motorista em movimento</span><strong>{tracking.routeMeta ? formatEta(tracking.routeMeta.duration) : 'Calculando rota…'}</strong></div>
    </div>}
    <div className={styles.customerOrderStatus}><div><span>{state.label}</span><small>{statusText}</small></div><strong>{new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></div>
    {order.fulfillment_type === 'delivery' && addressLabel && <div className={styles.customerOrderAddress}><Icon icon={MapPin} /><span><small>Entrega em</small><strong>{addressLabel}</strong></span></div>}
    {order.status !== 'cancelled' && <div className={styles.orderProgress} aria-label={`Etapa ${state.step} de 5`}><i style={{ '--order-progress': `${Math.max(8, state.step * 20)}%` }} /></div>}
  </motion.article>
}

function OrdersPage({ user, onBrowse }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    if (!user || !supabase) { setLoading(false); return }
    const { data, error: queryError } = await supabase
      .from('store_orders')
      .select('id, driver_id, status, total, fulfillment_type, delivery_address, route_distance_m, route_duration_s, estimated_arrival_at, created_at, stores(name, address, latitude, longitude), store_order_items(product_name, quantity)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setOrders(data || [])
    setError(queryError ? 'Não foi possível atualizar seus pedidos agora.' : '')
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    if (!user || !supabase) return () => window.clearTimeout(timer)
    const channel = supabase.channel(`customer-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_orders', filter: `customer_id=eq.${user.id}` }, loadOrders)
      .subscribe()
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel) }
  }, [loadOrders, user])

  if (!user) return <OrdersEmpty user={user} onBrowse={onBrowse} />
  if (loading) return <div className={styles.ordersLoading}><i /><i /><i /></div>
  if (!orders.length) return <OrdersEmpty user={user} onBrowse={onBrowse} />

  return <section className={styles.ordersPage}>
    <header><div><span>Atualização em tempo real</span><h2>Acompanhe seu pedido</h2></div><button onClick={loadOrders}><Icon icon={Spinner} />Atualizar</button></header>
    {error && <p className={styles.ordersError}>{error}</p>}
    <div className={styles.customerOrderList}>{orders.map(order => <CustomerOrderCard key={order.id} order={order} />)}</div>
  </section>
}

function ProductPage({ product, favorite, onFavorite, onBack, onAdd }) {
  const extras = extrasByCategory[product.category] || extrasByCategory.default
  const [quantity, setQuantity] = useState(1)
  const [selectedExtras, setSelectedExtras] = useState([])
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (extras.find(extra => extra.id === id)?.price || 0), 0)
  const total = (product.price + extrasTotal) * quantity
  const discount = product.original ? Math.round((1 - product.price / product.original) * 100) : 0
  const toggleExtra = id => setSelectedExtras(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const share = async () => {
    const data = { title: product.name, text: `${product.name} no ${product.shop}`, url: window.location.href }
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(window.location.href) } } catch { /* compartilhamento cancelado */ }
  }

  return <motion.section className={styles.productPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <div className={styles.productHero}><img src={`/images/${product.image}.jpg`} alt={product.name} /><div className={styles.productTopActions}><motion.button whileTap={tap} onClick={onBack} aria-label="Fechar detalhes"><Icon icon={X} /></motion.button><motion.button whileTap={tap} onClick={share} aria-label="Compartilhar produto"><Icon icon={Share} /></motion.button></div></div>
    <div className={styles.productPageBody}>
      <div className={styles.productIdentity}><div><span>{product.shop}</span><h1>{product.name}</h1></div><motion.button whileTap={tap} aria-label={`${favorite ? 'Remover dos' : 'Adicionar aos'} favoritos`} aria-pressed={favorite} onClick={onFavorite}><Icon icon={Heart} /></motion.button></div>
      <div className={styles.productPricing}>{product.startingAt && <small>a partir de</small>}<div><strong>{money(product.price)}</strong>{product.original && <><del>{money(product.original)}</del><span>−{discount}%</span></>}</div></div>
      <p className={styles.productDescription}>{product.description}</p>
      <div className={styles.productMeta}><span><Icon icon={Lightning} />{product.time}–{product.time + 10} min</span><i /><strong>{product.delivery === 0 ? 'Entrega grátis' : `Entrega ${money(product.delivery)}`}</strong></div>
      <section className={styles.extrasSection}><header><h2>Complete seu pedido</h2><p>Escolha até {extras.length}</p></header><div>{extras.map((extra, index) => { const selected = selectedExtras.includes(extra.id); return <button key={extra.id} className={selected ? styles.extraSelected : ''} aria-pressed={selected} onClick={() => toggleExtra(extra.id)}><img src={`/images/${product.image}.jpg`} alt="" /><span><strong>{extra.name}</strong>{index % 2 === 0 && <small>Mais pedido</small>}</span><b>+{money(extra.price)}</b><i><Icon icon={selected ? Check : Plus} /></i></button> })}</div></section>
      <div className={styles.productCheckout}><div className={styles.productQuantity}><button aria-label="Diminuir quantidade" disabled={quantity === 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}><Icon icon={Minus} /></button><span>{quantity}</span><button aria-label="Aumentar quantidade" disabled={quantity === 10} onClick={() => setQuantity(value => Math.min(10, value + 1))}><Icon icon={Plus} /></button></div><motion.button whileTap={tap} className={styles.productAddButton} onClick={() => onAdd(product, quantity, selectedExtras.map(id => extras.find(extra => extra.id === id)))}><span>Adicionar</span><strong>{money(total)}</strong></motion.button></div>
    </div>
  </motion.section>
}

function FulfillmentSwitch({ value, onChange }) {
  return <div className={styles.fulfillment} role="group" aria-label="Forma de recebimento"><button className={value === 'delivery' ? styles.fulfillmentActive : ''} aria-pressed={value === 'delivery'} onClick={() => onChange('delivery')}>Entrega</button><button className={value === 'pickup' ? styles.fulfillmentActive : ''} aria-pressed={value === 'pickup'} onClick={() => onChange('pickup')}>Retirada</button></div>
}

function CartContent({ count, cart, cartExtras, subtotal, deliveryTotal, serviceFee, discount, total, couponCode, fulfillment, changeQuantity, browse, user, onCheckout, onCoupon }) {
  const items = products.filter(item => cart[item.id])
  const [couponInput, setCouponInput] = useState(couponCode)
  const [couponError, setCouponError] = useState('')
  const applyCoupon = event => {
    event.preventDefault()
    const code = couponInput.trim().toUpperCase()
    if (!code) { setCouponError('Digite o código do cupom.'); return }
    if (!['TIGRE10', 'PRIMEIRA'].includes(code)) { setCouponError('Este cupom não está disponível.'); return }
    setCouponError('')
    onCoupon(code)
  }
  if (!count) return <div className={styles.cartEmpty}><motion.img className={styles.cartIllustration} src={bagIllustration} alt="" initial={{ opacity: 0, y: 12, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }} /><h2>Sua sacola está vazia</h2><p>Escolha algo gostoso para começar seu pedido.</p><button onClick={() => browse()}>Explorar restaurantes <Icon icon={ArrowRight} /></button></div>

  const storeName = items.length === 1 ? items[0].shop : `${new Set(items.map(item => item.shop)).size} restaurantes`
  return <>
    <div className={styles.cartStore}><img src="/images/burger.jpg" alt="" /><div><small>Pedido em</small><strong>{storeName}</strong><span>{items.length === 1 ? `${items[0].time}–${items[0].time + 10} min` : 'Entregas separadas por restaurante'}</span></div></div>
    <div className={styles.cartItems}>{items.map(item => {
      const extras = Array.isArray(cartExtras[item.id]) ? cartExtras[item.id] : []
      const unitPrice = item.price + extras.reduce((sum, extra) => sum + Number(extra.price || 0), 0)
      return <motion.article layout className={styles.cartItem} key={item.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
        <img src={`/images/${item.image}.jpg`} alt="" />
        <div className={styles.cartItemInfo}><small>{item.shop}</small><h3>{item.name}</h3>{extras.length > 0 && <p className={styles.cartItemExtras}>{extras.map(extra => extra.name).join(' · ')}</p>}<strong>{money(unitPrice * cart[item.id])}</strong><div className={styles.cartItemFooter}><div className={styles.stepper}><motion.button whileTap={tap} aria-label={`Diminuir ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Icon icon={Minus} /></motion.button><AnimatePresence mode="popLayout" initial={false}><motion.span key={cart[item.id]} initial={{ scale: .65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.25, opacity: 0 }}>{cart[item.id]}</motion.span></AnimatePresence><motion.button whileTap={tap} aria-label={`Aumentar ${item.name}`} disabled={cart[item.id] >= 99} onClick={() => changeQuantity(item.id, 1)}><Icon icon={Plus} /></motion.button></div><button className={styles.cartRemove} onClick={() => changeQuantity(item.id, -cart[item.id])}>Remover</button></div></div>
      </motion.article>
    })}</div>
    <button className={styles.addMore} onClick={() => browse()}><Icon icon={Plus} />Adicionar mais itens</button>
    <section className={styles.couponBox} aria-label="Cupom de desconto"><div className={styles.couponHeading}><span><Icon icon={Tag} /></span><div><strong>{couponCode ? 'Cupom aplicado' : 'Tem um cupom?'}</strong><small>{couponCode ? `${couponCode} · desconto aplicado ao total.` : 'Digite o código para conferir o desconto.'}</small></div></div>{couponCode ? <button className={styles.removeCoupon} onClick={() => { onCoupon(''); setCouponInput('') }}>Remover</button> : <form onSubmit={applyCoupon}><input aria-label="Código do cupom" value={couponInput} onChange={event => { setCouponInput(event.target.value.toUpperCase()); setCouponError('') }} placeholder="Código do cupom" autoCapitalize="characters" /><button>Aplicar</button></form>}{couponError && <p role="status">{couponError}</p>}</section>
    <section className={styles.checkoutSummary} aria-label="Resumo da sacola"><header><h2>Valores do pedido</h2><span>Veja como o total foi calculado</span></header><div><span>Subtotal dos itens</span><strong>{money(subtotal)}</strong></div><div><span>{fulfillment === 'pickup' ? 'Retirada' : 'Entrega'}</span><strong className={deliveryTotal === 0 ? styles.checkoutFree : ''}>{fulfillment === 'pickup' ? 'Sem taxa' : deliveryTotal === 0 ? 'Grátis' : money(deliveryTotal)}</strong></div><div><span>Taxa de serviço</span><strong>{money(serviceFee)}</strong></div>{discount > 0 && <div className={styles.checkoutDiscount}><span>Desconto do cupom</span><strong>− {money(discount)}</strong></div>}<div className={styles.checkoutTotal}><span>Total</span><strong>{money(total)}</strong></div></section>
    <p className={styles.cartEta}><Icon icon={Lightning} />{fulfillment === 'pickup' ? 'Seu pedido ficará pronto para retirada em cerca de 20 minutos.' : 'O prazo de entrega aparece depois que você informar o endereço.'}</p>
    {user ? <button className={styles.checkoutButton} onClick={onCheckout}><span>Escolher pagamento</span><strong>{money(total)} <Icon icon={CaretRight} /></strong></button> : <a className={styles.checkoutButton} href="#entrar"><span>Entrar para continuar</span><strong>{money(total)} <Icon icon={CaretRight} /></strong></a>}
  </>
}

function CartPage({ count, cart, cartExtras, subtotal, deliveryTotal, serviceFee, discount, total, couponCode, fulfillment, changeQuantity, browse, onBack, user, onCheckout, onCoupon, onFulfillment }) {
  return <motion.section className={styles.cartPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <header className={styles.cartPageHeader}><motion.button whileTap={tap} onClick={onBack} aria-label="Voltar ao catálogo"><Icon icon={CaretLeft} /></motion.button><div><h1>Sua sacola</h1><p>{count ? `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}` : 'Pronta para o seu próximo pedido'}</p></div></header>
    <div className={styles.cartPageBody}>{count > 0 && <FulfillmentSwitch value={fulfillment} onChange={onFulfillment} />}<CartContent count={count} cart={cart} cartExtras={cartExtras} subtotal={subtotal} deliveryTotal={deliveryTotal} serviceFee={serviceFee} discount={discount} total={total} couponCode={couponCode} fulfillment={fulfillment} changeQuantity={changeQuantity} browse={browse} user={user} onCheckout={onCheckout} onCoupon={onCoupon} /></div>
  </motion.section>
}

function PaymentPage({ address, subtotal, deliveryTotal, serviceFee, discount, total, fulfillment, storeName, onFulfillment, onBack, onAddress, onConfirm, loading, error }) {
  const [method, setMethod] = useState('pix')
  const methods = [
    { id: 'pix', icon: QrCode, name: 'Pix', note: 'Confirmação rápida' },
    { id: 'card', icon: CreditCard, name: 'Cartão', note: 'Crédito ou débito' },
    { id: 'cash', icon: Cash, name: 'Dinheiro', note: 'Pague ao receber' },
  ]
  return <motion.section className={styles.paymentPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <header className={styles.cartPageHeader}><motion.button whileTap={tap} onClick={onBack} aria-label="Voltar para a sacola"><Icon icon={CaretLeft} /></motion.button><div><h1>Pagamento</h1><p>Endereço, forma de pagamento e total</p></div></header>
    <div className={styles.paymentBody}><FulfillmentSwitch value={fulfillment} onChange={onFulfillment} />
      {fulfillment === 'delivery' ? <section className={styles.paymentSection}><header><h2>Onde entregar</h2><button onClick={onAddress}>{address ? 'Alterar' : 'Adicionar'}</button></header><button className={`${styles.addressChoice} ${!address ? styles.addressMissing : ''}`} onClick={onAddress}><span><Icon icon={MapPin} /></span><div><strong>{address ? address.label : 'Informe seu endereço'}</strong><small>{address ? 'Usaremos este local para calcular o prazo.' : 'Precisamos do local antes de finalizar.'}</small></div><Icon icon={CaretRight} /></button></section> : <section className={styles.paymentSection}><header><h2>Onde retirar</h2></header><div className={styles.pickupChoice}><span><Icon icon={Store} /></span><div><strong>{storeName}</strong><small>O endereço e o código de retirada aparecem após confirmar.</small></div></div></section>}
      <section className={styles.paymentSection}><header><h2>Como você quer pagar?</h2></header><div className={styles.paymentMethods}>{methods.map(item => <motion.button whileTap={{ scale: .985 }} key={item.id} className={method === item.id ? styles.paymentSelected : ''} aria-pressed={method === item.id} onClick={() => setMethod(item.id)}><span><Icon icon={item.icon} /></span><div><strong>{item.name}</strong><small>{item.note}</small></div><i>{method === item.id && <Icon icon={Check} />}</i></motion.button>)}</div>{method === 'card' && <button className={styles.addPayment}><Icon icon={Plus} />Adicionar cartão</button>}{method === 'cash' && <label className={styles.changeField}>Precisa de troco?<input inputMode="decimal" placeholder="Troco para quanto?" /></label>}</section>
      <section className={`${styles.checkoutSummary} ${styles.paymentSummary}`} aria-label="Valores do pedido"><header><h2>Resumo do pagamento</h2><span>Veja como o total foi calculado</span></header><div><span>Subtotal dos itens</span><strong>{money(subtotal)}</strong></div><div><span>{fulfillment === 'pickup' ? 'Retirada' : 'Entrega'}</span><strong className={deliveryTotal === 0 ? styles.checkoutFree : ''}>{fulfillment === 'pickup' ? 'Sem taxa' : deliveryTotal === 0 ? 'Grátis' : money(deliveryTotal)}</strong></div><div><span>Taxa de serviço</span><strong>{money(serviceFee)}</strong></div>{discount > 0 && <div className={styles.checkoutDiscount}><span>Cupom</span><strong>− {money(discount)}</strong></div>}<div className={styles.checkoutTotal}><span>Total</span><strong>{money(total)}</strong></div></section>
      {error && <p className={styles.checkoutError} role="status">{error}</p>}
      <button className={styles.checkoutButton} disabled={loading || (fulfillment === 'delivery' && !address)} onClick={() => onConfirm(method)}><span>{fulfillment === 'delivery' && !address ? 'Adicione um endereço' : loading ? 'Confirmando pedido…' : 'Confirmar pedido'}</span><strong>{loading ? <Icon className={styles.checkoutSpinner} icon={Spinner} /> : <>{money(total)} <Icon icon={CaretRight} /></>}</strong></button>
      <p className={styles.paymentNote}>A loja confirma automaticamente neste teste e o motorista recebe a entrega na hora.</p>
    </div>
  </motion.section>
}

function ProfilePanel({ modal, setModal, fullPage = false }) {
  const metadata = modal.user?.user_metadata || {}
  const profile = modal.account?.profile || {}
  const initialName = profile.full_name || metadata.full_name || modal.user?.email?.split('@')[0] || ''
  const initialAvatar = profile.avatar_url || metadata.avatar_url || ''
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(metadata.phone || modal.account?.application?.phone || '')
  const [avatar, setAvatar] = useState(initialAvatar)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const chooseAvatar = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    setEditing(true)
    const reader = new FileReader()
    reader.onload = () => {
      const image = new window.Image()
      image.onload = () => {
        const size = 320
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        const scale = Math.max(size / image.width, size / image.height)
        const width = image.width * scale
        const height = image.height * scale
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
        setAvatar(canvas.toDataURL('image/jpeg', .82))
        setNotice('Foto pronta. Salve para aplicar no seu perfil.')
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const save = async () => {
    const cleanName = name.trim()
    if (!cleanName) {
      setNotice('Digite seu nome para continuar.')
      return
    }
    setSaving(true)
    setNotice('Salvando seus dados…')
    try {
      if (isSupabaseConfigured && supabase && modal.user) {
        const { data: authData, error: authError } = await supabase.auth.updateUser({
          data: { full_name: cleanName, avatar_url: avatar || null, phone: phone.trim() || null },
        })
        if (authError) throw authError
        const { error: profileError } = await supabase.from('profiles').update({ full_name: cleanName, avatar_url: avatar || null }).eq('id', modal.user.id)
        if (profileError) throw profileError
        await modal.refresh?.()
        const updatedUser = authData.user || modal.user
        if (!fullPage) setModal({
          ...modal,
          user: { ...updatedUser, user_metadata: { ...updatedUser.user_metadata, full_name: cleanName, avatar_url: avatar || null, phone: phone.trim() || null } },
          account: { ...modal.account, profile: { ...profile, full_name: cleanName, avatar_url: avatar || null } },
        })
      } else {
        localStorage.setItem('tigre-profile-draft', JSON.stringify({ full_name: cleanName, phone: phone.trim(), avatar_url: avatar }))
      }
      setEditing(false)
      setNotice('Perfil atualizado.')
    } catch (error) {
      setNotice(error?.message || 'Não foi possível salvar agora. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setName(initialName)
    setPhone(metadata.phone || modal.account?.application?.phone || '')
    setAvatar(initialAvatar)
    setNotice('')
    setEditing(false)
  }

  return <>
    <div className={styles.profileHero}>
      <div className={styles.profileAvatarWrap}>
        <span className={styles.profileAvatar}>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <Icon icon={User} />}</span>
        {modal.user && <label className={styles.profileAvatarEdit} title="Mudar foto"><Icon icon={Camera} /><input type="file" accept="image/*" onChange={chooseAvatar} /></label>}
      </div>
      <div className={styles.profileHeroCopy}>{fullPage ? <h2>{modal.user ? (name || initialName) : 'Sua conta'}</h2> : <Dialog.Title asChild><h2>{modal.user ? (name || initialName) : 'Sua conta'}</h2></Dialog.Title>}{fullPage ? <p>{modal.user ? modal.user.email : 'Entre para acompanhar pedidos e salvar seus dados.'}</p> : <Dialog.Description>{modal.user ? modal.user.email : 'Entre para acompanhar pedidos e salvar seus dados.'}</Dialog.Description>}</div>
      {modal.user && <button className={styles.profileEditButton} onClick={() => { if (modal.openFullProfile && !fullPage) modal.openFullProfile(); else { setNotice(''); setEditing(value => !value) } }} aria-expanded={editing}><Icon icon={Pen} />{editing ? 'Fechar' : fullPage ? 'Editar' : 'Ver perfil'}</button>}
    </div>
    {modal.user && !editing && <div className={styles.profileFacts} aria-label="Resumo dos dados pessoais"><div><span>Telefone</span><strong>{phone || 'Adicionar telefone'}</strong></div><div><span>CPF</span><strong>{profile.cpf || 'Não informado'}</strong></div></div>}
    {modal.user && editing && <section className={styles.profileEditor} aria-label="Editar perfil">
      <div className={styles.profileEditorHeading}><div><strong>Seus dados</strong><span>Atualize o que aparece na sua conta.</span></div><span className={styles.profileEditorBadge}><Icon icon={Check} />Seguro</span></div>
      <label className={styles.profileField}><span>Nome completo</span><input value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
      <label className={styles.profileField}><span>Telefone <em>opcional</em></span><input value={phone} maxLength={24} onChange={event => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" /></label>
      <div className={styles.profileReadOnly}><span>E-mail</span><strong>{modal.user.email}</strong><small>O e-mail é usado para entrar na conta.</small></div>
      {profile.cpf && <div className={styles.profileReadOnly}><span>CPF</span><strong>{profile.cpf}</strong><small>Documento vinculado à sua conta.</small></div>}
      {notice && <p className={styles.profileNotice} role="status">{notice}</p>}
      <div className={styles.profileEditorActions}><button className={styles.profileCancel} onClick={cancel} disabled={saving}>Cancelar</button><button className={styles.profileSave} onClick={save} disabled={saving}>{saving ? <><Icon icon={Spinner} spin />Salvando…</> : <><Icon icon={Check} />Salvar alterações</>}</button></div>
    </section>}
    {!modal.user && <div className={styles.profileAuth}><a className={styles.profilePrimary} href="#entrar">Entrar</a><a className={styles.profileSecondary} href="#criar-conta">Criar conta</a></div>}
    {modal.user && !editing && notice && <p className={styles.profileNotice} role="status">{notice}</p>}
    <div className={styles.profileList}><button onClick={() => modal.navigate('orders')}><span><Icon icon={Receipt} />Meus pedidos</span><Icon icon={CaretRight} /></button><button onClick={() => modal.navigate('favorites')}><span><Icon icon={Heart} />Favoritos</span><Icon icon={CaretRight} /></button><button onClick={modal.openAddress}><span><Icon icon={MapPin} />Endereços</span><Icon icon={CaretRight} /></button><button onClick={() => modal.onHelp ? modal.onHelp() : setModal({ type: 'help' })}><span><Icon icon={Question} />Ajuda</span><Icon icon={CaretRight} /></button></div>
    <div className={styles.profilePartner}><a className={styles.driverInvite} href={modal.user ? (modal.account?.role === 'admin' ? '#admin' : '#motorista') : '#entrar'}><span className={styles.driverInviteIcon}><Icon icon={modal.account?.role === 'admin' ? Shield : Motorcycle} /></span><span><strong>{modal.user ? (modal.account?.role === 'admin' ? 'Painel administrativo' : modal.account?.role === 'driver' ? 'Área do entregador' : modal.account?.application?.status === 'pending' ? 'Cadastro de motorista' : 'Quero fazer entregas') : 'Quero fazer entregas'}</strong><small>{modal.user ? (modal.account?.role === 'admin' ? 'Cadastros e operação' : modal.account?.role === 'driver' ? 'Entregas e ganhos' : modal.account?.application?.status === 'pending' ? 'Análise em andamento' : 'Cadastre-se para começar') : 'Entre para continuar'}</small></span><Icon icon={CaretRight} /></a><a className={styles.storeInvite} href={modal.user ? '#lojista' : '#entrar'}><span className={styles.storeInviteIcon}><Icon icon={Store} /></span><span><strong>Quero vender</strong><small>{modal.user ? 'Cadastre sua loja' : 'Entre para continuar'}</small></span><Icon icon={CaretRight} /></a></div>
    {modal.user && <button className={styles.profileLogout} onClick={modal.signOut}>Sair da conta</button>}
  </>
}

function ProfilePage({ account, navigate, onBack, onAddress, onHelp, signOut }) {
  const modal = { type: 'profile', user: account.user, account, navigate, openAddress: onAddress, onHelp, refresh: account.refresh, signOut }
  return <section className={styles.profilePage}>
    <header className={styles.profilePageHeader}><button onClick={onBack} aria-label="Voltar"><Icon icon={CaretLeft} /></button><div><small>Minha conta</small><h1>Perfil</h1></div><span><Icon icon={User} /></span></header>
    <div className={styles.profilePageBody}><ProfilePanel modal={modal} setModal={() => {}} fullPage /></div>
  </section>
}

function CatalogDialog({ modal, setModal }) {
  return <Dialog.Root open={Boolean(modal)} onOpenChange={open => { if (!open) setModal(null) }}><AnimatePresence>{modal && <Dialog.Portal forceMount>
    <Dialog.Overlay asChild forceMount><motion.div className={styles.dialogOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
    <Dialog.Content asChild forceMount><motion.section className={styles.dialog} initial={{ opacity: 0, y: 22, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .985 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}><div className={styles.dialogContent}>
      <Dialog.Close asChild><motion.button whileTap={tap} className={styles.close} aria-label="Fechar"><Icon icon={X} /></motion.button></Dialog.Close>
      {modal.type === 'help' && <><span className={styles.modalIcon}><Icon icon={Question} /></span><Dialog.Title asChild><h2>Como podemos ajudar?</h2></Dialog.Title><Dialog.Description className={styles.modalSubtitle}>Conheça esta prévia do TigreFood.</Dialog.Description><details open><summary>Como explorar o catálogo?</summary><p>Busque um prato ou restaurante, escolha uma categoria e combine os filtros. Toque em um prato para ver os detalhes.</p></details><details><summary>Posso fazer um pedido?</summary><p>Ainda não. As lojas, os valores e os prazos são demonstrativos.</p></details><details><summary>Onde ficam meus favoritos?</summary><p>Os pratos marcados com coração ficam na seção Favoritos e são salvos neste navegador.</p></details></>}
      {modal.type === 'profile' && <ProfilePanel modal={modal} setModal={setModal} />}
    </div></motion.section></Dialog.Content>
  </Dialog.Portal>}</AnimatePresence></Dialog.Root>
}

export function CatalogPage() {
  const reducedMotion = useReducedMotion()
  const account = useAccount()
  const [page, setPage] = useState('home'), [category, setCategory] = useState('all'), [query, setQuery] = useState(''), [sort, setSort] = useState('recommended')
  const [free, setFree] = useState(false), [fast, setFast] = useState(false), [filters, setFilters] = useState(false)
  const [favorites, setFavorites] = useState(() => { const saved = readSaved('tigre-favorites', []); return Array.isArray(saved) ? saved.filter(id => products.some(p => p.id === id)) : [] })
  const [cart, setCart] = useState(() => { const saved = readSaved('tigre-cart', {}); return Object.fromEntries(products.map(p => [p.id, Math.max(0, Math.min(99, Number.isInteger(saved?.[p.id]) ? saved[p.id] : 0))])) })
  const [cartExtras, setCartExtras] = useState(() => { const saved = readSaved('tigre-cart-extras', {}); return saved && typeof saved === 'object' ? saved : {} })
  const [selectedProduct, setSelectedProduct] = useState(products[0])
  const [address, setAddress] = useState(() => { const saved = readSaved('tigre-address', null); return typeof saved === 'string' ? { label: saved } : saved })
  const [couponCode, setCouponCode] = useState('')
  const [fulfillment, setFulfillment] = useState('delivery')
  const [addressReturn, setAddressReturn] = useState('home')
  const [modal, setModal] = useState(null), [toast, setToast] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false), [checkoutError, setCheckoutError] = useState('')
  const [deliveryQuote, setDeliveryQuote] = useState(null)
  const authUser = account.user
  const chromeRef = useScrollChrome(!reducedMotion && !modal && !['cart', 'payment', 'product', 'address', 'profile'].includes(page), page)
  const results = useRef(null), searchInput = useRef(null)
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0)
  const subtotal = products.reduce((sum, item) => {
    const extras = Array.isArray(cartExtras[item.id]) ? cartExtras[item.id] : []
    const unitPrice = item.price + extras.reduce((extraSum, extra) => extraSum + Number(extra.price || 0), 0)
    return sum + (cart[item.id] || 0) * unitPrice
  }, 0)
  const selectedStoreName = products.find(item => cart[item.id] > 0)?.shop || ''
  const quoteKey = `${selectedStoreName}:${Array.isArray(address?.point) ? address.point.map(value => Number(value).toFixed(5)).join(',') : ''}`
  const deliveryTotal = fulfillment === 'pickup' ? 0 : deliveryQuote?.key === quoteKey ? deliveryQuote.fee : products.filter(item => cart[item.id]).reduce((sum, item) => sum + item.delivery, 0)
  const serviceFee = count ? 2.49 : 0
  const discount = couponCode ? Math.min(couponCode === 'PRIMEIRA' ? 12 : subtotal * .1, 15) : 0
  const orderTotal = Math.max(0, subtotal + deliveryTotal + serviceFee - discount)

  useEffect(() => { document.title = 'TigreFood — O que vai ser hoje?' }, [])
  useEffect(() => { localStorage.setItem('tigre-favorites', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('tigre-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem('tigre-cart-extras', JSON.stringify(cartExtras)) }, [cartExtras])
  useEffect(() => { localStorage.setItem('tigre-address', JSON.stringify(address)) }, [address])
  useEffect(() => {
    if (fulfillment !== 'delivery' || !selectedStoreName || !Array.isArray(address?.point) || !supabase) return undefined
    let active = true
    supabase.rpc('quote_delivery_fee', { p_store_name: selectedStoreName, p_latitude: Number(address.point[0]), p_longitude: Number(address.point[1]) }).then(({ data, error }) => {
      if (!active) return
      const quote = Array.isArray(data) ? data[0] : data
      setDeliveryQuote(!error && quote ? { key: quoteKey, fee: Number(quote.delivery_fee), distance: Number(quote.distance_km), minutes: Number(quote.estimated_minutes) } : null)
    })
    return () => { active = false }
  }, [address, fulfillment, quoteKey, selectedStoreName])
  useEffect(() => {
    if (!authUser || !supabase) return undefined
    let active = true
    supabase.from('customer_addresses').select('label, street, number, complement, neighborhood, city, state, postal_code, latitude, longitude').eq('is_default', true).maybeSingle().then(({ data }) => {
      if (!active || !data) return
      setAddress({ label: data.label, street: data.street, number: data.number, complement: data.complement || '', neighborhood: data.neighborhood || '', city: data.city, state: data.state || '', cep: formatCep(data.postal_code || ''), point: [Number(data.latitude), Number(data.longitude)] })
    })
    return () => { active = false }
  }, [authUser])
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 2400); return () => clearTimeout(timeout) }, [toast])
  useEffect(() => { const onKey = event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !modal) { event.preventDefault(); searchInput.current?.focus() } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [modal])

  const visible = useMemo(() => {
    const search = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const filtered = products.filter(p => (category === 'all' || p.category === category) && (page !== 'favorites' || favorites.includes(p.id)) && (page !== 'offers' || p.original) && (!free || p.delivery === 0) && (!fast || p.time + 10 <= 30) && `${p.name} ${p.shop} ${p.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search))
    if (sort === 'price') filtered.sort((a, b) => a.price - b.price); if (sort === 'time') filtered.sort((a, b) => a.time - b.time); if (sort === 'rating') filtered.sort((a, b) => parseFloat(b.rating.replace(',', '.')) - parseFloat(a.rating.replace(',', '.')))
    return filtered
  }, [category, query, page, favorites, free, fast, sort])

  function navigate(next) { setPage(next); setCategory('all'); setQuery(''); setFree(false); setFast(false); setFilters(false); setModal(null); window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }
  function add(item, amount = 1, extras = []) {
    const existing = products.find(product => cart[product.id] > 0)
    if (existing && existing.shop !== item.shop) {
      setCart(Object.fromEntries(products.map(product => [product.id, product.id === item.id ? amount : 0])))
      setCartExtras({ [item.id]: extras.filter(Boolean) })
      setToast(`Sua sacola agora é de ${item.shop}`)
      return
    }
    setCart(previous => ({ ...previous, [item.id]: Math.min(99, (previous[item.id] || 0) + amount) }))
    setCartExtras(previous => ({ ...previous, [item.id]: extras.filter(Boolean) }))
    setToast(`${item.name} adicionado à sacola`)
  }
  function changeQuantity(id, amount) { setCart(previous => ({ ...previous, [id]: Math.max(0, Math.min(99, (previous[id] || 0) + amount)) })) }
  function toggleFavorite(id) { setFavorites(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]) }
  function browse(next = 'all') { setPage('home'); setCategory(next); setQuery(''); setFree(false); setFast(false); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })) }
  function openProduct(item) { setSelectedProduct(item); setPage('product'); setModal(null); window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }
  function openAddress(returnTo = 'home') { setAddressReturn(returnTo); navigate('address') }
  async function saveAddress(value) {
    setAddress(value)
    if (authUser && supabase) {
      const { error } = await supabase.rpc('save_customer_address', {
        p_label: value.label,
        p_street: value.street,
        p_number: value.number,
        p_complement: value.complement || null,
        p_neighborhood: value.neighborhood || null,
        p_city: value.city,
        p_state: value.state || null,
        p_postal_code: value.cep || null,
        p_latitude: Number(value.point?.[0]),
        p_longitude: Number(value.point?.[1]),
      })
      setToast(error ? 'Endereço salvo neste aparelho' : 'Endereço salvo na sua conta')
    } else setToast('Endereço salvo')
    navigate(addressReturn)
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setModal(null); setToast('Você saiu da conta') }

  async function placeOrder(method) {
    if (!authUser || !supabase || placingOrder) return
    if (fulfillment === 'delivery' && !address) { setCheckoutError('Informe o endereço de entrega.'); return }
    const selectedItems = products.filter(item => cart[item.id] > 0)
    if (!selectedItems.length) { setCheckoutError('Sua sacola está vazia.'); return }
    const items = selectedItems.map(item => {
      const extras = Array.isArray(cartExtras[item.id]) ? cartExtras[item.id] : []
      return { name: item.name, quantity: cart[item.id], unit_price: Number((item.price + extras.reduce((sum, extra) => sum + Number(extra.price || 0), 0)).toFixed(2)), options: extras.map(extra => ({ name: extra.name, price: extra.price })) }
    })
    setPlacingOrder(true)
    setCheckoutError('')
    const { error } = await supabase.rpc('place_demo_order', {
      p_store_name: selectedItems[0].shop,
      p_items: items,
      p_delivery_address: fulfillment === 'delivery' ? { ...address, recipient_name: account.profile?.full_name || authUser.user_metadata?.full_name || 'Cliente' } : {},
      p_fulfillment: fulfillment,
      p_payment_method: method,
      p_subtotal: Number(subtotal.toFixed(2)),
      p_delivery_fee: Number(deliveryTotal.toFixed(2)),
      p_service_fee: Number(serviceFee.toFixed(2)),
      p_discount: Number(discount.toFixed(2)),
      p_total: Number(orderTotal.toFixed(2)),
    })
    setPlacingOrder(false)
    if (error) {
      setCheckoutError(error.message.includes('no_driver_available') || error.message.includes('no_driver_online') ? 'Ainda não há motorista online perto deste endereço.' : error.message.includes('demo_store_unavailable') ? 'Esta loja de demonstração está fechada.' : 'Não foi possível confirmar o pedido agora.')
      return
    }
    setCart(Object.fromEntries(products.map(product => [product.id, 0])))
    setCartExtras({})
    setCouponCode('')
    navigate('orders')
    setToast('Pedido confirmado e enviado ao motorista')
  }

  const nav = [{ id: 'home', name: 'Explorar', icon: House }, { id: 'offers', name: 'Ofertas', icon: Tag }, { id: 'favorites', name: 'Favoritos', icon: Heart }, { id: 'orders', name: 'Meus pedidos', icon: Receipt }]
  const heading = page === 'favorites' ? 'Favoritos' : page === 'offers' ? 'Ofertas' : page === 'orders' ? 'Seus pedidos' : page === 'cart' ? 'Sua sacola' : page === 'payment' ? 'Pagamento' : page === 'product' ? selectedProduct.name : page === 'address' ? 'Endereços' : 'Explore o cardápio'
  const sectionTitle = query ? `Resultados para “${query}”` : page === 'favorites' ? 'Pratos salvos' : page === 'offers' ? 'Pratos em oferta' : category !== 'all' ? categories.find(cat => cat.id === category).label : 'Ofertas para você'
  const discovery = page === 'home' && category === 'all' && !query.trim() && !free && !fast && sort === 'recommended'

  const openProfilePage = () => { setModal(null); navigate('profile') }
  const openProfile = () => setModal({ type: 'profile', navigate, openAddress: () => openAddress('home'), openFullProfile: openProfilePage, user: authUser, account, refresh: account.refresh, signOut })

  return <MotionConfig reducedMotion="user"><Tooltip.Provider delayDuration={500} skipDelayDuration={200}><div ref={chromeRef} className={`${styles.layout} relative isolate`}>
    <aside className={styles.sidebar}><a href="#catalogo" className={styles.brand} onClick={() => navigate('home')} aria-label="TigreFood, início"><img src="/tiger.svg" alt="" /><span>Tigre<span>Food</span></span></a><nav aria-label="Menu principal">{nav.map(item => <Tooltip.Root key={item.id}><Tooltip.Trigger asChild><motion.button whileTap={tap} className={page === item.id ? styles.navActive : ''} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon icon={item.icon} weight={page === item.id ? 'fill' : 'regular'} /><span>{item.name}</span>{item.id === 'favorites' && favorites.length > 0 && <small>{favorites.length}</small>}</motion.button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className={styles.tooltip} side="right" sideOffset={10}>{item.name}<Tooltip.Arrow className={styles.tooltipArrow} /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>)}</nav><div className={styles.sidebarBottom}><button className={styles.help} onClick={() => setModal({ type: 'help' })}><Icon icon={Question} />Precisa de ajuda?</button><span className={styles.sidebarCopyright}>TigreFood</span></div></aside>

    <div className={`${styles.workspace} ${page === 'profile' ? styles.profileWorkspace : ''}`}><header className={styles.topbar}><motion.button whileTap={tap} className={`${styles.iconButton} ${styles.menuButton}`} onClick={openProfile} aria-label="Abrir perfil" aria-expanded={modal?.type === 'profile'}>{authUser?.user_metadata?.avatar_url ? <img className={styles.headerAvatar} src={authUser.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" /> : <Icon icon={User} />}</motion.button><motion.button whileTap={tap} className={styles.address} onClick={() => openAddress('home')}><span className={styles.pin}><Icon icon={MapPin} /></span><span><strong>{address?.label || 'Informe seu endereço'}</strong></span><Icon icon={CaretDown} /></motion.button><label className={styles.search}><Icon icon={MagnifyingGlass} /><input ref={searchInput} aria-label="Buscar pratos ou restaurantes" placeholder="Busque um prato ou restaurante" value={query} onChange={event => { setQuery(event.target.value); if (page === 'orders') setPage('home') }} />{query && <motion.button whileTap={tap} onClick={() => setQuery('')} aria-label="Limpar busca"><Icon icon={X} /></motion.button>}<kbd>/</kbd></label>{authUser ? <button className={styles.account} onClick={openProfile}><Icon icon={User} /><span>{authUser.user_metadata?.full_name?.split(' ')[0] || 'Minha conta'}</span></button> : <a className={styles.account} href="#entrar"><Icon icon={User} /><span>Entrar</span></a>}<motion.button whileTap={tap} className={styles.mobileFilter} aria-label="Filtrar cardápio" aria-expanded={filters} onClick={() => { if (page === 'orders') setPage('menu'); setFilters(!filters); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })) }}><Icon icon={SlidersHorizontal} />{(free || fast) && <i />}</motion.button><motion.button whileTap={{ scale: .92 }} className={styles.bag} onClick={() => navigate('cart')} aria-label={`Abrir sacola, ${count} itens`}><Icon icon={Bag} /><span>Sacola</span><AnimatePresence mode="popLayout" initial={false}><motion.b key={count} initial={{ scale: .45, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 1.3, opacity: 0 }} transition={spring}>{count}</motion.b></AnimatePresence></motion.button></header>
      <main className={styles.main}><AnimatePresence mode="wait" initial={false}><motion.div key={page} className={`${styles.pageContent} min-w-0`} initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }} transition={{ duration: .24, ease: [0.22, 1, 0.36, 1] }}>
        {page !== 'profile' && (page !== 'home' || query) && <div className={`${styles.greeting} ${['cart', 'payment', 'product', 'address'].includes(page) ? styles.cartGreeting : ''}`}><h1>{heading}</h1></div>}
        {page === 'home' && !query && <HeroCarousel onBrowse={browse} />}
        {page === 'profile' ? <ProfilePage account={account} navigate={navigate} onBack={() => navigate('home')} onAddress={() => openAddress('profile')} onHelp={() => setModal({ type: 'help' })} signOut={signOut} />
          : page === 'address' ? <AddressPage address={address} onBack={() => navigate(addressReturn)} onSave={saveAddress} />
          : page === 'product' ? <ProductPage key={selectedProduct.id} product={selectedProduct} favorite={favorites.includes(selectedProduct.id)} onFavorite={() => toggleFavorite(selectedProduct.id)} onBack={() => navigate('home')} onAdd={(item, amount, extras) => { add(item, amount, extras); navigate('cart') }} />
            : page === 'cart' ? <CartPage count={count} cart={cart} cartExtras={cartExtras} subtotal={subtotal} deliveryTotal={deliveryTotal} serviceFee={serviceFee} discount={discount} total={orderTotal} couponCode={couponCode} fulfillment={fulfillment} changeQuantity={changeQuantity} browse={browse} onBack={() => navigate('home')} user={authUser} onCoupon={setCouponCode} onFulfillment={setFulfillment} onCheckout={() => navigate('payment')} />
              : page === 'payment' ? <PaymentPage address={address} subtotal={subtotal} deliveryTotal={deliveryTotal} serviceFee={serviceFee} discount={discount} total={orderTotal} fulfillment={fulfillment} storeName={products.find(item => cart[item.id] > 0)?.shop || 'Brasa Burger'} onFulfillment={setFulfillment} onBack={() => navigate('cart')} onAddress={() => openAddress('payment')} onConfirm={placeOrder} loading={placingOrder} error={checkoutError} />
                : page !== 'orders' ? <><CategoryCarousel value={category} onChange={setCategory} /><section ref={results} className={styles.results} aria-label="Cardápio"><div className={styles.sectionHeading}><div><h2>{sectionTitle}</h2><p>{visible.length} {visible.length === 1 ? 'opção' : 'opções'}</p></div><motion.button whileTap={tap} className={`${styles.filterButton} ${filters ? styles.filterActive : ''}`} onClick={() => setFilters(!filters)} aria-expanded={filters}><Icon icon={SlidersHorizontal} />Filtros{(free || fast) && <b>{Number(free) + Number(fast)}</b>}</motion.button></div><div className={`${styles.filterRow} ${filters ? styles.filtersExpanded : ''}`}><motion.button whileTap={tap} className={free ? styles.chipActive : ''} aria-pressed={free} onClick={() => setFree(!free)}>Entrega grátis</motion.button><motion.button whileTap={tap} className={fast ? styles.chipActive : ''} aria-pressed={fast} onClick={() => setFast(!fast)}><Icon className={styles.filterBolt} icon={Lightning} />Até 30 min</motion.button><SortControl value={sort} onChange={setSort} /></div><AnimatePresence mode="popLayout">{visible.length ? <CatalogSections items={visible} discovery={discovery} favorites={favorites} toggleFavorite={toggleFavorite} openProduct={openProduct} add={add} browse={browse} neighborhood={address?.neighborhood} /> : <motion.div className={styles.empty} initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}><Icon icon={page === 'favorites' ? Heart : MagnifyingGlass} /><h3>{page === 'favorites' && !favorites.length ? 'Nenhum favorito salvo.' : 'Não encontramos essa combinação.'}</h3><p>{page === 'favorites' && !favorites.length ? 'Toque no coração de um prato para encontrá-lo aqui depois.' : 'Experimente outro nome ou remova alguns filtros.'}</p><button onClick={() => navigate('home')}>Explorar o cardápio<Icon icon={ArrowRight} /></button></motion.div>}</AnimatePresence></section></> : <OrdersPage user={authUser} onBrowse={() => navigate('home')} />}
        {!['cart', 'payment', 'product', 'address', 'profile'].includes(page) && <footer className={styles.footer}><strong>TigreFood</strong><p>Fotos ilustrativas · Lojas, preços e prazos de demonstração.</p><button onClick={() => setModal({ type: 'help' })}>Ajuda e informações<Icon icon={ArrowRight} /></button></footer>}
      </motion.div></AnimatePresence></main>
    </div>

    <CatalogDialog modal={modal} setModal={setModal} />
    <nav className={styles.bottomNav} aria-label="Navegação do celular">{bottomNavItems.map(item => <BottomNavItem key={item.id} item={item} active={item.id === 'profile' ? page === 'profile' || modal?.type === 'profile' : page === item.id && modal?.type !== 'profile'} onClick={item.id === 'profile' ? openProfile : () => navigate(item.id)} />)}</nav>
    <AnimatePresence>{toast && <motion.div className={styles.toast} role="status" initial={{ opacity: 0, y: 16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }}><span><Icon icon={Bag} weight="fill" />{toast}</span></motion.div>}</AnimatePresence>
  </div></Tooltip.Provider></MotionConfig>
}




